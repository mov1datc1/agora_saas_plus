'use server'

import { revalidatePath } from 'next/cache'

import { POST } from '@/app/api/sync-drupal/route'
import { NextRequest } from 'next/server'

export async function runSyncChunk(offset: number) {
  try {
    // Evitamos fetch de red usando invocación directa al handler de Next.js
    // Esto previene errores 500, bloqueos de firewall y problemas con process.env.VERCEL_URL
    const mockRequest = new NextRequest(`http://localhost/api/sync-drupal?offset=${offset}`, {
      method: 'POST',
      headers: {
        'authorization': `Bearer agora-bypass-token`
      }
    })

    const res = await POST(mockRequest)
    
    if (!res.ok) {
      let errorMsg = res.statusText
      try {
        const errorData = await res.json()
        errorMsg = errorData.error || errorData.message || errorMsg
      } catch (e) {}
      throw new Error(`HTTP ${res.status}: ${errorMsg}`)
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

export async function wipeAllData() {
  try {
    // Import prisma and delete in order (same logic as /api/sync-drupal/reset)
    const prisma = (await import('@/lib/prisma')).default
    
    await prisma.$transaction([
      prisma.transactionCompany.deleteMany(),
      prisma.transactionLawyer.deleteMany(),
      prisma.transactionAdvisor.deleteMany(),
      prisma.transaction.deleteMany(),
      prisma.company.deleteMany(),
      prisma.lawyer.deleteMany(),
      prisma.firm.deleteMany(),
      prisma.industry.deleteMany(),
    ])

    revalidatePath('/', 'layout')
    return { success: true, message: 'Wipe completado. La base de datos está lista para re-sincronizar.' }
  } catch (error: any) {
    console.error("wipeAllData error:", error)
    return { success: false, error: error.message }
  }
}
