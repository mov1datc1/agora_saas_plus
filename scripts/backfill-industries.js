require('dotenv').config({ path: require('path').resolve(__dirname, '../.env') })
const { Pool } = require('pg')
const crypto = require('crypto')

const DRUPAL_API_BASE = process.env.DRUPAL_API_URL || 'https://lexlatin.com/api/agora/transactions'
const DRUPAL_AGORA_TOKEN = process.env.DRUPAL_AGORA_TOKEN || 'agora-etl-2026-secure-token'

async function main() {
  const connStr = process.env.DATABASE_URL
  if (!connStr) {
    console.error('❌ DATABASE_URL not set')
    process.exit(1)
  }
  const connectionString = connStr.includes('pooler.supabase.com')
    ? connStr.replace(':5432', ':6543')
    : connStr

  const pool = new Pool({ connectionString, max: 4 })
  const client = await pool.connect()

  try {
    console.log('🚀 Step 1: Seeding TransactionIndustry from existing Transaction.industryId...')
    const seedRes = await client.query(`
      INSERT INTO "TransactionIndustry" (id, "transactionId", "industryId")
      SELECT gen_random_uuid()::text, id, "industryId"
      FROM "Transaction"
      WHERE "industryId" IS NOT NULL
      ON CONFLICT ("transactionId", "industryId") DO NOTHING
    `)
    console.log(`  ✅ Seeded ${seedRes.rowCount} base TransactionIndustry links.`)

    // Load all existing transaction IDs and industries into memory
    const { rows: txRows } = await client.query(`SELECT id, "industryId" FROM "Transaction"`)
    const existingTxMap = new Map(txRows.map(r => [r.id, r.industryId]))
    console.log(`  📊 Total transactions in DB: ${existingTxMap.size}`)

    const { rows: indRows } = await client.query(`SELECT id, name FROM "Industry"`)
    const industryByName = new Map(indRows.map(r => [r.name, r.id]))

    console.log('\n🚀 Step 2: Fetching transactions from Drupal API to backfill multi-industry associations...')
    // Fetch first page to get total count
    const firstRes = await fetch(`${DRUPAL_API_BASE}?page=0&limit=100&status=all`, {
      headers: { 'X-Agora-Token': DRUPAL_AGORA_TOKEN, 'Accept': 'application/json' }
    })
    if (!firstRes.ok) {
      throw new Error(`Drupal API failed with status ${firstRes.status}`)
    }
    const firstJson = await firstRes.json()
    const totalPosts = firstJson.total || 0
    const totalPages = Math.ceil(totalPosts / 100)
    console.log(`  🌐 Drupal API reports ${totalPosts} posts across ${totalPages} pages (limit=100).`)

    let multiIndustryPostsFound = 0
    let multiIndustryTxUpdated = 0
    let newLinksInserted = 0

    const processPosts = async (posts) => {
      const linksToInsert = []
      const txPrimaryUpdates = []

      for (const post of posts) {
        const txId = `drupal-${post.nid}`
        if (!existingTxMap.has(txId)) continue

        const rawInds = (post.industries || []).map(i => (i || '').trim()).filter(Boolean)
        const uniqueIndNames = [...new Set(rawInds)]
        if (uniqueIndNames.length === 0) continue

        if (uniqueIndNames.length > 1) {
          multiIndustryPostsFound++
        }

        const indIds = []
        for (const indName of uniqueIndNames) {
          let indId = industryByName.get(indName)
          if (!indId) {
            const newId = crypto.randomUUID()
            const upsertInd = await client.query(
              `INSERT INTO "Industry" (id, name) VALUES ($1, $2) ON CONFLICT (name) DO UPDATE SET name = EXCLUDED.name RETURNING id`,
              [newId, indName]
            )
            indId = upsertInd.rows[0].id
            industryByName.set(indName, indId)
          }
          indIds.push(indId)
          linksToInsert.push({ txId, indId })
        }

        if (!existingTxMap.get(txId) && indIds[0]) {
          txPrimaryUpdates.push({ txId, indId: indIds[0] })
        }

        if (uniqueIndNames.length > 1) {
          multiIndustryTxUpdated++
        }
      }

      if (linksToInsert.length > 0) {
        // Batch insert into TransactionIndustry
        const valuesSql = linksToInsert
          .map((_, idx) => `($${idx * 3 + 1}, $${idx * 3 + 2}, $${idx * 3 + 3})`)
          .join(',')
        const params = []
        for (const item of linksToInsert) {
          params.push(crypto.randomUUID(), item.txId, item.indId)
        }
        const ins = await client.query(
          `INSERT INTO "TransactionIndustry" (id, "transactionId", "industryId") VALUES ${valuesSql} ON CONFLICT ("transactionId", "industryId") DO NOTHING`,
          params
        )
        newLinksInserted += ins.rowCount || 0
      }

      for (const upd of txPrimaryUpdates) {
        await client.query(`UPDATE "Transaction" SET "industryId" = $1 WHERE id = $2 AND "industryId" IS NULL`, [upd.indId, upd.txId])
      }
    }

    // Process page 0
    await processPosts(firstJson.data || [])

    // Process remaining pages in parallel chunks of 5
    const CONCURRENCY = 5
    for (let page = 1; page < totalPages; page += CONCURRENCY) {
      const pagesToFetch = []
      for (let p = page; p < Math.min(page + CONCURRENCY, totalPages); p++) {
        pagesToFetch.push(p)
      }
      const results = await Promise.all(
        pagesToFetch.map(async (p) => {
          try {
            const r = await fetch(`${DRUPAL_API_BASE}?page=${p}&limit=100&status=all`, {
              headers: { 'X-Agora-Token': DRUPAL_AGORA_TOKEN, 'Accept': 'application/json' }
            })
            if (!r.ok) return []
            const j = await r.json()
            return j.data || []
          } catch {
            return []
          }
        })
      )
      for (const posts of results) {
        if (posts.length > 0) {
          await processPosts(posts)
        }
      }
      if ((page - 1) % 25 === 0 || page + CONCURRENCY >= totalPages) {
        console.log(`  ⏳ Processed up to page ${Math.min(page + CONCURRENCY, totalPages)}/${totalPages} (multi-industry tx found: ${multiIndustryTxUpdated}, new links added: ${newLinksInserted})`)
      }
    }

    console.log('\n✅ Backfill Summary:')
    console.log(`  • Multi-industry transactions in Ágora DB updated: ${multiIndustryTxUpdated}`)
    console.log(`  • Additional TransactionIndustry links inserted: ${newLinksInserted}`)

    // Verify Tidewater case (drupal-131758)
    const { rows: tidewater } = await client.query(`
      SELECT t.id, t.title, i.name as industry_name
      FROM "Transaction" t
      JOIN "TransactionIndustry" ti ON ti."transactionId" = t.id
      JOIN "Industry" i ON i.id = ti."industryId"
      WHERE t.id = 'drupal-131758' OR LOWER(t.title) LIKE '%tidewater%'
      ORDER BY t.id, i.name
    `)
    console.log('\n🔍 Verification — Caso Tidewater in DB:')
    for (const row of tidewater) {
      console.log(`  [${row.id}] ${row.title.substring(0, 50)}... -> ${row.industry_name}`)
    }
  } finally {
    client.release()
    await pool.end()
  }
}

main().catch(err => {
  console.error('❌ Backfill error:', err)
  process.exit(1)
})

