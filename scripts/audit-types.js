// Audit: check for empty/null fields that might display as "none" in the UI
const { Pool } = require('pg')

async function main() {
  const connStr = process.env.DATABASE_URL
  if (!connStr) { console.error('❌ DATABASE_URL not set'); process.exit(1) }
  const connectionString = connStr.includes('pooler.supabase.com') ? connStr.replace(':5432', ':6543') : connStr
  const pool = new Pool({ connectionString, max: 2 })
  const client = await pool.connect()

  const validTypes = "('M&A', 'Emisiones', 'Financiamientos')"

  console.log('\n=== AUDIT: Potential "None" Display Issues ===\n')

  // 1. Transactions with NULL or empty type (would bypass the IN filter)
  const { rows: nullType } = await client.query(`SELECT COUNT(*) as c FROM "Transaction" WHERE type IS NULL OR type = ''`)
  console.log(`⚠️  Transactions with NULL/empty type: ${nullType[0].c}`)

  // 2. Transactions with NULL industry (shows as empty in UI)
  const { rows: nullIndustry } = await client.query(`
    SELECT COUNT(*) as c FROM "Transaction" WHERE type IN ${validTypes} AND "industryId" IS NULL
  `)
  console.log(`📊 Valid transactions with no industry: ${nullIndustry[0].c}`)

  // 3. Transactions with no country
  const { rows: nullCountry } = await client.query(`
    SELECT COUNT(*) as c FROM "Transaction" WHERE type IN ${validTypes} AND (country IS NULL OR country = '')
  `)
  console.log(`📊 Valid transactions with no country: ${nullCountry[0].c}`)

  // 4. Transactions with no advisors (firms)
  const { rows: noFirms } = await client.query(`
    SELECT COUNT(*) as c FROM "Transaction" t 
    WHERE t.type IN ${validTypes}
    AND NOT EXISTS (SELECT 1 FROM "TransactionAdvisor" ta WHERE ta."transactionId" = t.id)
  `)
  console.log(`📊 Valid transactions with no firm advisors: ${noFirms[0].c}`)

  // 5. Transactions with no lawyers
  const { rows: noLawyers } = await client.query(`
    SELECT COUNT(*) as c FROM "Transaction" t 
    WHERE t.type IN ${validTypes}
    AND NOT EXISTS (SELECT 1 FROM "TransactionLawyer" tl WHERE tl."transactionId" = t.id)
  `)
  console.log(`📊 Valid transactions with no lawyers: ${noLawyers[0].c}`)

  // 6. Check what the Drupal API field_tipo_de_noticia looks like for records that DID get imported
  // We can check by looking at the title patterns
  console.log('\n=== CHECK: Do any valid transactions look like non-transactions? ===\n')
  
  const { rows: suspicious } = await client.query(`
    SELECT id, title, type, "practiceArea", "isPublished"
    FROM "Transaction" 
    WHERE type IN ${validTypes}
    AND (
      LOWER(title) LIKE '%nombr%' OR
      LOWER(title) LIKE '%fichaje%' OR
      LOWER(title) LIKE '%refuerza%' OR
      LOWER(title) LIKE '%incorpora%' OR
      LOWER(title) LIKE '%evento%' OR
      LOWER(title) LIKE '%movimiento%' OR
      LOWER(title) LIKE '%acción judicial%'
    )
    ORDER BY "dateAnnounced" DESC NULLS LAST
    LIMIT 15
  `)
  
  if (suspicious.length > 0) {
    console.log(`🚨 Found ${suspicious.length} suspicious "editorial" records classified as transactions:`)
    console.log('─'.repeat(120))
    for (const s of suspicious) {
      console.log(`  [${s.type.padEnd(15)}] ${(s.title || '').substring(0, 80)} | PA: ${(s.practiceArea || 'none').substring(0, 25)}`)
    }
  } else {
    console.log('✅ No suspicious editorial records found in valid transactions.')
  }

  // 7. Check what the MassiveSync has been doing — are records being synced today?
  console.log('\n=== RECENT SYNC ACTIVITY ===\n')
  const { rows: recentCron } = await client.query(`
    SELECT "jobName", status, trigger, "startedAt", "completedAt", "recordsProcessed", "recordsSkipped", "errorMessage"
    FROM "CronLog"
    ORDER BY "startedAt" DESC
    LIMIT 5
  `)
  for (const cl of recentCron) {
    const duration = cl.completedAt ? Math.round((new Date(cl.completedAt) - new Date(cl.startedAt)) / 1000) : '?'
    console.log(`  [${cl.status}] ${cl.jobName} (${cl.trigger}) — ${new Date(cl.startedAt).toISOString()} — ${cl.recordsProcessed} processed, ${cl.recordsSkipped} skipped, ${duration}s`)
    if (cl.errorMessage) console.log(`    ⚠️  Error: ${cl.errorMessage.substring(0, 100)}`)
  }

  client.release()
  await pool.end()
}

main().catch(console.error)
