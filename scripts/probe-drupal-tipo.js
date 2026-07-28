// Probe: Check what Drupal API actually returns for field_tipo_de_noticia
// Fetches a sample of posts and shows the raw field values

async function main() {
  const DRUPAL_API_BASE = process.env.DRUPAL_API_URL || 'https://lexlatin.com/api/agora/transactions'
  const DRUPAL_AGORA_TOKEN = process.env.DRUPAL_AGORA_TOKEN || 'agora-etl-2026-secure-token'

  console.log('\n=== PROBE: Drupal API field_tipo_de_noticia values ===\n')
  console.log(`API: ${DRUPAL_API_BASE}\n`)

  // Fetch 3 pages (50 records each) to get a good sample
  const tipoValues = new Map() // value → count
  let totalChecked = 0
  
  for (let page = 0; page < 6; page++) {
    const url = `${DRUPAL_API_BASE}?page=${page}&limit=50&status=all`
    try {
      const res = await fetch(url, {
        headers: {
          'X-Agora-Token': DRUPAL_AGORA_TOKEN,
          'Accept': 'application/json'
        }
      })
      if (!res.ok) {
        console.error(`Page ${page} failed: ${res.status}`)
        break
      }
      const json = await res.json()
      const posts = json.data || []
      if (posts.length === 0) break

      for (const post of posts) {
        totalChecked++
        const tipo = post.field_tipo_de_noticia
        const key = tipo === null ? '(null)' : tipo === undefined ? '(undefined)' : tipo === '' ? '(empty string)' : tipo
        tipoValues.set(key, (tipoValues.get(key) || 0) + 1)
      }

      // Also check first page for all available fields
      if (page === 0 && posts.length > 0) {
        console.log('📋 Available fields in first post:')
        console.log('─'.repeat(60))
        for (const key of Object.keys(posts[0]).sort()) {
          const val = posts[0][key]
          const display = typeof val === 'string' ? val.substring(0, 50) : JSON.stringify(val)?.substring(0, 50)
          console.log(`  ${key.padEnd(35)} ${display}`)
        }
        console.log('')
      }
    } catch (e) {
      console.error(`Fetch error on page ${page}:`, e.message)
      break
    }
  }

  console.log(`\n📊 field_tipo_de_noticia distribution (${totalChecked} posts sampled):`)
  console.log('─'.repeat(60))
  const sorted = [...tipoValues.entries()].sort((a, b) => b[1] - a[1])
  for (const [val, count] of sorted) {
    const pct = ((count / totalChecked) * 100).toFixed(1)
    const marker = val === 'Transacción' ? '✅' : '⚠️ '
    console.log(`  ${marker} ${val.padEnd(35)} ${count.toString().padStart(5)} (${pct}%)`)
  }
  console.log('')
}

main().catch(console.error)
