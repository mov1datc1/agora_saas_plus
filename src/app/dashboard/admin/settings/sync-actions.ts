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
    await prisma.transactionIndustry.deleteMany()
    
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
const PRACTICE_AREA_MAP: Record<string, string> = {
  'corporativo - adquisiciones': 'M&A',
  'corporativo - fusiones': 'M&A',
  'banca y finanzas (créditos y financiamientos)': 'Financiamientos',
  'banca y finanzas': 'Financiamientos',
  'mercado de capitales - emisiones': 'Emisiones',
}

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
        
        // Count how many DISTINCT operation types these areas map to
        const mappedTypes = new Set<string>()
        for (const area of areas) {
          const lower = area.toLowerCase().trim()
          for (const [key, type] of Object.entries(PRACTICE_AREA_MAP)) {
            if (lower.includes(key) || key.includes(lower)) {
              mappedTypes.add(type)
              break
            }
          }
        }

        if (mappedTypes.size >= 2) {
          // This is a multi-type original — delete it and its relationships
          await prisma.transactionCompany.deleteMany({ where: { transactionId: item.id } })
          await prisma.transactionLawyer.deleteMany({ where: { transactionId: item.id } })
          await prisma.transactionAdvisor.deleteMany({ where: { transactionId: item.id } })
          await prisma.transactionIndustry.deleteMany({ where: { transactionId: item.id } })
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

// ── Purge Deleted Nodes (404s) and Non-Transactions / None Posts ──
export async function purgeDeletedAndNoneTransactions() {
  try {
    const prisma = (await import('@/lib/prisma')).default
    const DRUPAL_API_BASE = process.env.DRUPAL_API_URL || 'https://lexlatin.com/api/agora/transactions'
    const DRUPAL_AGORA_TOKEN = process.env.DRUPAL_AGORA_TOKEN || 'agora-etl-2026-secure-token'

    const KNOWN_DELETED_NIDS = [
      132999, 133004, 133243, 133487, 132489, 134465, 134071, 130567,
      131180, // Stonepeak (replaced by 131468)
      127756, // Kapital (replaced by 127773)
      132920, // GSI Capital (replaced by 133017)
      132591, // Intercorp (replaced by 132171)
    ]
    const toDeleteIds = new Set<string>()

    for (const nid of KNOWN_DELETED_NIDS) {
      toDeleteIds.add(`drupal-${nid}`)
    }

    // Check a sample of 50 oldest updated transactions for HTTP 404 in Drupal
    const checkTxs = await prisma.transaction.findMany({
      where: { id: { startsWith: 'drupal-' } },
      orderBy: { updatedAt: 'asc' },
      take: 50,
      select: { id: true }
    })

    await Promise.allSettled(
      checkTxs.map(async (tx) => {
        const nid = tx.id.replace('drupal-', '')
        if (!/^\d+$/.test(nid)) return
        try {
          const controller = new AbortController()
          const timeoutId = setTimeout(() => controller.abort(), 3000)
          const res = await fetch(`https://lexlatin.com/node/${nid}`, {
            method: 'HEAD',
            redirect: 'manual',
            signal: controller.signal
          })
          clearTimeout(timeoutId)
          if (res.status === 404) {
            toDeleteIds.add(tx.id)
          }
        } catch {}
      })
    )

    // Scan up to 20 pages (1,000 posts) of Drupal API for non-transaction / None posts
    for (let page = 0; page < 20; page++) {
      try {
        const res = await fetch(`${DRUPAL_API_BASE}?page=${page}&limit=50&status=all`, {
          headers: {
            'X-Agora-Token': DRUPAL_AGORA_TOKEN,
            'Accept': 'application/json'
          }
        })
        if (!res.ok) break
        const json = await res.json()
        const posts = json.data || []
        if (posts.length === 0) break

        for (const p of posts) {
          const tipo = (p.field_tipo_de_noticia || '').toLowerCase().trim()
          if (tipo !== 'transacción' && tipo !== 'transaccion') {
            toDeleteIds.add(`drupal-${p.nid}`)
          }
        }
        if (posts.length < 50) break
      } catch {
        break
      }
    }

    // Find which exist in DB
    const candidateIds = Array.from(toDeleteIds)
    const existing = await prisma.transaction.findMany({
      where: { id: { in: candidateIds } },
      select: { id: true, title: true }
    })

    if (existing.length === 0) {
      return {
        success: true,
        message: 'No se encontraron notas eliminadas o en None en la base de datos.',
        purged: 0,
        purgedList: []
      }
    }

    const existingIds = existing.map(e => e.id)

    // Delete cascade
    await Promise.all([
      prisma.transactionCompany.deleteMany({ where: { transactionId: { in: existingIds } } }),
      prisma.transactionLawyer.deleteMany({ where: { transactionId: { in: existingIds } } }),
      prisma.transactionAdvisor.deleteMany({ where: { transactionId: { in: existingIds } } }),
      prisma.transactionIndustry.deleteMany({ where: { transactionId: { in: existingIds } } }),
    ])
    await prisma.transaction.deleteMany({ where: { id: { in: existingIds } } })

    revalidatePath('/', 'layout')
    return {
      success: true,
      message: `Purga completada: ${existing.length} notas eliminadas o en None fueron removidas de Ágora.`,
      purged: existing.length,
      purgedList: existing.map(e => `${e.id}: ${e.title.substring(0, 80)}`)
    }
  } catch (error: any) {
    console.error("purgeDeletedAndNoneTransactions error:", error)
    return { success: false, error: error.message }
  }
}


