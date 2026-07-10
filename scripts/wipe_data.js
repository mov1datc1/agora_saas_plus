// Wipe all transactional data for clean re-sync with Classification Engine v2.0
const { Pool } = require('pg')

let connectionString = process.env.DATABASE_URL
if (connectionString.includes('pooler.supabase.com')) {
  connectionString = connectionString.replace(':5432', ':6543')
}

const pool = new Pool({ connectionString, ssl: { rejectUnauthorized: false } })

async function wipe() {
  const client = await pool.connect()
  try {
    console.log('🧹 Starting data wipe...')
    
    // Order matters: bridge tables first, then entities
    const tables = [
      'TransactionAdvisor',
      'TransactionCompany', 
      'TransactionLawyer',
      'Transaction',
      'Lawyer',
      'Firm',
      'Company',
      'Industry',
      'SyncJob',
    ]
    
    for (const table of tables) {
      const res = await client.query(`DELETE FROM "${table}"`)
      console.log(`  ✓ ${table}: ${res.rowCount} rows deleted`)
    }
    
    console.log('\n✅ Data wipe complete. Ready for re-sync.')
  } catch (err) {
    console.error('❌ Error:', err.message)
  } finally {
    client.release()
    await pool.end()
  }
}

wipe()
