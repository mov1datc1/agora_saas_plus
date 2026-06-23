import { loadEnvConfig } from '@next/env'
loadEnvConfig(process.cwd())

async function run() {
  console.log("Iniciando sincronización masiva desde script local...")
  let offset = 0
  let keepSyncing = true

  while (keepSyncing) {
    console.log(`Procesando chunk offset: ${offset}...`)
    try {
      const res = await fetch(`http://localhost:3000/api/sync-drupal?offset=${offset}`, {
        method: 'POST',
        headers: {
          'Authorization': 'Bearer agora-bypass-token'
        }
      })
      
      const data = await res.json()
      console.log(`Respuesta offset ${offset}:`, data)

      if (data.message === 'No posts found to sync.') {
        console.log('Sincronización completada.')
        keepSyncing = false
      } else if (data.success && data.processedCount > 0) {
        offset += 150
      } else {
        console.error('Error o respuesta inesperada:', data)
        keepSyncing = false
      }
    } catch (e) {
      console.error("Fallo la llamada fetch:", e)
      keepSyncing = false
    }
  }
}

run()
