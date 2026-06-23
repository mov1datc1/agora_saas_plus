'use server'

export async function runSyncChunk(offset: number) {
  try {
    const baseUrl = process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : 'http://localhost:3000'
    const res = await fetch(`${baseUrl}/api/sync-drupal?offset=${offset}`, {
      method: 'POST',
      headers: {
        'authorization': `Bearer ${process.env.CRON_SECRET || ''}`
      },
      // Avoid caching the sync request
      cache: 'no-store'
    })
    
    if (!res.ok) {
      throw new Error(`Error en el servidor: ${res.statusText}`)
    }
    
    const data = await res.json()
    return { success: true, ...data }
  } catch (error: any) {
    console.error("runSyncChunk error:", error)
    return { success: false, error: error.message }
  }
}
