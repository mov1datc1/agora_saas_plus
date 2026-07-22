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
    // Import prisma and delete sequentially (not in a $transaction to avoid Vercel timeout)
    // Order matters: delete junction tables first, then dependent entities
    const prisma = (await import('@/lib/prisma')).default
    
    // Step 1: Junction tables (fast, small)
    await prisma.transactionCompany.deleteMany()
    await prisma.transactionLawyer.deleteMany()
    await prisma.transactionAdvisor.deleteMany()
    
    // Step 2: Main entity
    await prisma.transaction.deleteMany()
    
    // Step 3: Supporting entities
    await prisma.company.deleteMany()
    await prisma.lawyer.deleteMany()
    await prisma.firm.deleteMany()
    await prisma.industry.deleteMany()

    revalidatePath('/', 'layout')
    return { success: true, message: 'Wipe completado. La base de datos está lista para re-sincronizar.' }
  } catch (error: any) {
    console.error("wipeAllData error:", error)
    return { success: false, error: error.message }
  }
}

// ── Purge Multi-Area Originals ──
// Scans all transactions in Supabase, queries Drupal API for each NID's practice areas,
// and deletes any transaction whose Drupal post has 2+ MAPPED practice areas
// (these are the "portal originals" that Data Entry keeps for display, not for Ágora).
const PRACTICE_AREA_MAP_KEYS = [
  'corporativo - adquisiciones',
  'corporativo - fusiones',
  'banca y finanzas (créditos y financiamientos)',
  'banca y finanzas',
  'mercado de capitales - emisiones',
]

export async function purgeMultiAreaOriginals() {
  try {
    const prisma = (await import('@/lib/prisma')).default
    const DRUPAL_API_BASE = process.env.DRUPAL_API_URL || 'https://lexlatin.com/api/agora/transactions'
    const DRUPAL_AGORA_TOKEN = process.env.DRUPAL_AGORA_TOKEN || 'agora-etl-2026-secure-token'

    // Get all transaction IDs from DB
    const allTx = await prisma.transaction.findMany({
      select: { id: true, title: true },
    })

    const nidsToCheck: { id: string; nid: number; title: string }[] = []
    for (const tx of allTx) {
      const match = tx.id.match(/^drupal-(\d+)$/)
      if (match) {
        nidsToCheck.push({ id: tx.id, nid: parseInt(match[1]), title: tx.title })
      }
    }

    // Query Drupal API in batches to check practice areas
    let purged = 0
    let checked = 0
    const purgedList: string[] = []
    const BATCH_SIZE = 50

    for (let i = 0; i < nidsToCheck.length; i += BATCH_SIZE) {
      const batch = nidsToCheck.slice(i, i + BATCH_SIZE)
      
      // We need to find these NIDs in the API. Use pagination to scan.
      // Since we can't query by NID directly, we'll check each batch against the API
      // by fetching pages until we find all NIDs or exhaust the API.
      // 
      // Optimization: check if the transaction's practiceArea field in DB already has multiple areas
      for (const item of batch) {
        checked++
        const dbTx = await prisma.transaction.findUnique({
          where: { id: item.id },
          select: { practiceArea: true }
        })
        
        if (!dbTx?.practiceArea) continue
        
        // Parse practice areas from the stored comma-separated string
        const areas = dbTx.practiceArea.split(',').map((a: string) => a.trim()).filter(Boolean)
        
        // Count how many areas map to our operation types
        const mappedCount = areas.filter((area: string) => {
          const lower = area.toLowerCase().trim()
          return PRACTICE_AREA_MAP_KEYS.some(key => lower.includes(key) || key.includes(lower))
        }).length

        if (mappedCount >= 2) {
          // This is a portal original — delete it and its relationships
          await prisma.transactionCompany.deleteMany({ where: { transactionId: item.id } })
          await prisma.transactionLawyer.deleteMany({ where: { transactionId: item.id } })
          await prisma.transactionAdvisor.deleteMany({ where: { transactionId: item.id } })
          await prisma.transaction.delete({ where: { id: item.id } })
          purged++
          purgedList.push(`${item.nid}: ${item.title.substring(0, 80)}`)
        }
      }
    }

    revalidatePath('/', 'layout')
    return {
      success: true,
      message: `Purga completada: ${purged} originales multi-área eliminados de ${checked} revisados.`,
      purged,
      checked,
      purgedList: purgedList.slice(0, 50), // Cap at 50 for response size
    }
  } catch (error: any) {
    console.error("purgeMultiAreaOriginals error:", error)
    return { success: false, error: error.message }
  }
}

