// Cleanup: Remove non-transaction records from the database
// Fetches ALL Drupal posts, identifies those with field_tipo_de_noticia != 'Transacción',
// and deletes the corresponding records from Supabase (cascade deletes advisors, lawyers, companies)

const { Pool } = require('pg')

async function main() {
  const connStr = process.env.DATABASE_URL
  if (!connStr) { console.error('❌ DATABASE_URL not set'); process.exit(1) }
  const connectionString = connStr.includes('pooler.supabase.com') ? connStr.replace(':5432', ':6543') : connStr
  const pool = new Pool({ connectionString, max: 2 })
  const client = await pool.connect()

  const DRUPAL_API_BASE = process.env.DRUPAL_API_URL || 'https://lexlatin.com/api/agora/transactions'
  const DRUPAL_AGORA_TOKEN = process.env.DRUPAL_AGORA_TOKEN || 'agora-etl-2026-secure-token'

  console.log('\n=== CLEANUP: Remove Non-Transaction Records ===\n')

  // Phase 1: Scan Drupal API for all non-transaction nids
  console.log('📡 Phase 1: Scanning Drupal API for non-transaction posts...')
  const nonTxNids = []
  let page = 0
  const LIMIT = 50
  let totalScanned = 0

  while (true) {
    const url = `${DRUPAL_API_BASE}?page=${page}&limit=${LIMIT}&status=all`
    try {
      const res = await fetch(url, {
        headers: { 'X-Agora-Token': DRUPAL_AGORA_TOKEN, 'Accept': 'application/json' }
      })
      if (!res.ok) {
        console.error(`  Page ${page} failed: ${res.status}`)
        break
      }
      const json = await res.json()
      const posts = json.data || []
      if (posts.length === 0) break

      for (const post of posts) {
        totalScanned++
        const tipo = (post.field_tipo_de_noticia || '').toLowerCase().trim()
        if (tipo !== 'transacción' && tipo !== 'transaccion') {
          nonTxNids.push({
            nid: post.nid,
            tipo: post.field_tipo_de_noticia || '(null)',
            title: (post.title || '').substring(0, 60)
          })
        }
      }

      if (posts.length < LIMIT) break
      page++
      
      // Progress every 10 pages
      if (page % 10 === 0) {
        process.stdout.write(`  Scanned ${totalScanned} posts (page ${page})...\r`)
      }
    } catch (e) {
      console.error(`  Fetch error on page ${page}:`, e.message)
      break
    }
  }

  console.log(`  ✅ Scanned ${totalScanned} Drupal posts`)
  console.log(`  🚨 Found ${nonTxNids.length} non-transaction posts to clean\n`)

  if (nonTxNids.length === 0) {
    console.log('✅ No non-transaction records to clean. Database is clean!')
    client.release()
    await pool.end()
    return
  }

  // Show distribution of types being removed
  const typeDist = new Map()
  for (const item of nonTxNids) {
    typeDist.set(item.tipo, (typeDist.get(item.tipo) || 0) + 1)
  }
  console.log('📊 Non-transaction types to remove:')
  for (const [tipo, count] of typeDist.entries()) {
    console.log(`  ⚠️  ${tipo.padEnd(35)} ${count}`)
  }

  // Show sample
  console.log('\n📋 Sample records to delete:')
  for (const item of nonTxNids.slice(0, 10)) {
    console.log(`  [${item.tipo.padEnd(20)}] nid:${item.nid} — ${item.title}`)
  }

  // Phase 2: Delete from database
  console.log('\n🗑️  Phase 2: Deleting from database...')
  const idsToDelete = nonTxNids.map(n => `drupal-${n.nid}`)

  // Check how many actually exist in the DB
  const placeholders = idsToDelete.map((_, i) => `$${i + 1}`).join(', ')
  const { rows: existing } = await client.query(
    `SELECT id FROM "Transaction" WHERE id IN (${placeholders})`,
    idsToDelete
  )
  console.log(`  📊 Of ${idsToDelete.length} Drupal non-tx posts, ${existing.length} exist in our DB`)

  if (existing.length === 0) {
    console.log('  ✅ None found in DB — nothing to delete!')
    client.release()
    await pool.end()
    return
  }

  const existingIds = existing.map(r => r.id)

  // Delete cascade: advisors, lawyers, companies first (Prisma onDelete: Cascade handles this,
  // but we're using raw SQL so do it manually)
  const existingPlaceholders = existingIds.map((_, i) => `$${i + 1}`).join(', ')

  const { rowCount: delAdvisors } = await client.query(
    `DELETE FROM "TransactionAdvisor" WHERE "transactionId" IN (${existingPlaceholders})`,
    existingIds
  )
  const { rowCount: delLawyers } = await client.query(
    `DELETE FROM "TransactionLawyer" WHERE "transactionId" IN (${existingPlaceholders})`,
    existingIds
  )
  const { rowCount: delCompanies } = await client.query(
    `DELETE FROM "TransactionCompany" WHERE "transactionId" IN (${existingPlaceholders})`,
    existingIds
  )
  const { rowCount: delTx } = await client.query(
    `DELETE FROM "Transaction" WHERE id IN (${existingPlaceholders})`,
    existingIds
  )

  console.log(`\n✅ Cleanup complete:`)
  console.log(`  🗑️  Transactions deleted:       ${delTx}`)
  console.log(`  🗑️  TransactionAdvisor deleted:  ${delAdvisors}`)
  console.log(`  🗑️  TransactionLawyer deleted:   ${delLawyers}`)
  console.log(`  🗑️  TransactionCompany deleted:  ${delCompanies}`)

  // Phase 3: Verify
  console.log('\n📊 Post-cleanup verification:')
  const { rows: typeCounts } = await client.query(`
    SELECT type, COUNT(*) as count FROM "Transaction" GROUP BY type ORDER BY count DESC
  `)
  for (const row of typeCounts) {
    const marker = ['M&A', 'Emisiones', 'Financiamientos'].includes(row.type) ? '✅' : '⚠️ '
    console.log(`  ${marker} ${(row.type || '(NULL)').padEnd(25)} ${Number(row.count).toLocaleString()}`)
  }
  const total = typeCounts.reduce((sum, r) => sum + Number(r.count), 0)
  console.log(`  TOTAL: ${total.toLocaleString()}\n`)

  client.release()
  await pool.end()
}

main().catch(console.error)
