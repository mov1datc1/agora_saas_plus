'use server'

import { revalidatePath } from 'next/cache'

export async function runSyncChunk(offset: number) {
  try {
    const baseUrl = process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : 'http://localhost:3000'
    const res = await fetch(`${baseUrl}/api/sync-drupal?offset=${offset}`, {
      method: 'POST',
      headers: {
        'authorization': `Bearer agora-bypass-token`
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

export async function clearSystemCache() {
  try {
    revalidatePath('/', 'layout') // Limpia la caché de todas las rutas de la app
    return { success: true, message: "Caché de Next.js liberada correctamente. Los datos en vivo han sido actualizados." }
  } catch (error: any) {
    console.error("clearSystemCache error:", error)
    return { success: false, error: error.message }
  }
}
