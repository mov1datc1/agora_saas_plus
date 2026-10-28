import { NextResponse } from 'next/server'
import prisma from '@/lib/prisma'

export const revalidate = 0

// Prioritized Latin American countries list
const LATAM_PRIORITY = [
  'México',
  'Brasil',
  'Chile',
  'Colombia',
  'Perú',
  'Argentina',
  'Costa Rica',
  'Ecuador',
  'Uruguay',
  'Guatemala',
  'Panamá',
  'República Dominicana',
  'Venezuela',
  'Bolivia',
  'Paraguay',
  'El Salvador',
  'Honduras',
  'Nicaragua'
]

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)

    // Filters
    const countryParam = searchParams.get('country') || 'México'
    const type = searchParams.get('type') || 'Todas'
    const search = searchParams.get('search') || ''
    const dateStart = searchParams.get('dateStart')
    const dateEnd = searchParams.get('dateEnd')
    const sortBy = searchParams.get('sortBy') || 'deals' // 'deals' | 'value' | 'name'
    const sortOrder = searchParams.get('sortOrder') || 'desc' // 'desc' | 'asc'
    const page = parseInt(searchParams.get('page') || '1')
    const limit = parseInt(searchParams.get('limit') || '50')

    // Date boundary
    const today = new Date()
    today.setHours(23, 59, 59, 999)

    // Build WHERE for transactions
    const txWhere: any = {
      type: { in: ['M&A', 'Emisiones', 'Financiamientos'] },
      dateAnnounced: { gte: new Date('1990-01-01'), lte: today },
    }
    if (type && type !== 'Todas') txWhere.type = type
    if (dateStart) {
      txWhere.dateAnnounced = { ...txWhere.dateAnnounced, gte: new Date(dateStart + 'T00:00:00.000Z') }
    }
    if (dateEnd) {
      const nextDay = new Date(dateEnd + 'T00:00:00.000Z')
      nextDay.setUTCDate(nextDay.getUTCDate() + 1)
      txWhere.dateAnnounced = { ...txWhere.dateAnnounced, lt: nextDay < today ? nextDay : today }
    }

    // Build WHERE for firm
    const firmWhere: any = {}
    if (countryParam && countryParam !== 'Todos') {
      firmWhere.country = { equals: countryParam, mode: 'insensitive' }
    } else {
      firmWhere.country = { not: null }
    }

    // Query firms with their transactions in one batch
    const firms = await prisma.firm.findMany({
      where: firmWhere,
      select: {
        id: true,
        name: true,
        country: true,
        website: true,
        transactions: {
          where: {
            transaction: txWhere
          },
          select: {
            id: true,
            role: true,
            transaction: {
              select: {
                id: true,
                title: true,
                type: true,
                value: true,
                valueString: true,
                country: true,
                dateAnnounced: true,
                dateClosed: true,
                industry: { select: { name: true } },
                industries: { select: { industry: { select: { name: true } } } },
                companies: { select: { company: { select: { name: true } } } },
                lawyers: { select: { lawyer: { select: { name: true } } } }
              }
            }
          }
        }
      }
    })

    // Set of all unique transactions in the filtered scope
    const uniqueTxIds = new Set<string>()

    // Aggregate data per firm
    let ranked = firms.map(f => {
      const txMap = new Map<string, any>()
      f.transactions.forEach((adv: any) => {
        if (adv.transaction) {
          txMap.set(adv.transaction.id, adv.transaction)
          uniqueTxIds.add(adv.transaction.id)
        }
      })

      const txs = Array.from(txMap.values())
      let publicVal = 0
      let pubCount = 0
      let confCount = 0

      txs.forEach(tx => {
        const v = tx.value ? Number(tx.value) : 0
        if (v > 0) {
          publicVal += v
          pubCount++
        } else {
          confCount++
        }
      })

      return {
        id: f.id,
        firma: f.name,
        pais: f.country || countryParam,
        website: f.website || null,
        numeroOperaciones: txs.length,
        operacionesPublicas: pubCount,
        operacionesConfidenciales: confCount,
        montoAcumulado: publicVal,
        transacciones: txs.map(tx => ({
          id: tx.id,
          title: tx.title,
          type: tx.type || 'M&A',
          monto: tx.value && Number(tx.value) > 0 ? Number(tx.value) : null,
          montoString: tx.valueString || (tx.value && Number(tx.value) > 0 ? `USD ${Number(tx.value).toLocaleString()}` : 'Valor confidencial'),
          pais: tx.country || 'N/D',
          fecha: tx.dateAnnounced?.toISOString() || tx.dateClosed?.toISOString() || null,
          industria: (tx.industries?.length > 0 ? [...new Set(tx.industries.map((ti: any) => ti.industry?.name).filter(Boolean))].join(', ') : tx.industry?.name) || 'Varios / Sin Clasificar',
          empresa: tx.companies?.map((c: any) => c.company?.name).filter(Boolean).join(', ') || 'N/D',
          abogados: tx.lawyers?.map((l: any) => l.lawyer?.name).filter(Boolean).join(', ') || 'N/D'
        }))
      }
    }).filter(f => f.numeroOperaciones > 0)

    // Primary Sorting
    ranked.sort((a, b) => {
      if (sortBy === 'value') {
        const diff = b.montoAcumulado - a.montoAcumulado
        if (diff !== 0) return sortOrder === 'asc' ? -diff : diff
        return sortOrder === 'asc' ? a.numeroOperaciones - b.numeroOperaciones : b.numeroOperaciones - a.numeroOperaciones
      } else if (sortBy === 'name') {
        const cmp = a.firma.localeCompare(b.firma)
        return sortOrder === 'asc' ? cmp : -cmp
      } else {
        // default: 'deals' (Número de Operaciones)
        const diff = b.numeroOperaciones - a.numeroOperaciones
        if (diff !== 0) return sortOrder === 'asc' ? -diff : diff
        return sortOrder === 'asc' ? a.montoAcumulado - b.montoAcumulado : b.montoAcumulado - a.montoAcumulado
      }
    })

    // Assign ranking position (#1, #2, #3...) based on current sort
    let rankedWithPos = ranked.map((r, i) => ({
      ...r,
      rankingPosition: i + 1
    }))

    // Search filter (filters by firm name while retaining the true ranking position)
    if (search && search.trim()) {
      const q = search.trim().toLowerCase()
      rankedWithPos = rankedWithPos.filter(r => r.firma.toLowerCase().includes(q))
    }

    const totalCount = rankedWithPos.length
    const totalValue = ranked.reduce((acc, r) => acc + r.montoAcumulado, 0)
    const totalDeals = uniqueTxIds.size

    // Paginate
    const paginatedData = rankedWithPos.slice((page - 1) * limit, page * limit)

    // Fetch distinct countries from all firms with deals for the dropdown
    const rawCountries = await prisma.firm.findMany({
      where: { country: { not: null } },
      select: { country: true },
      distinct: ['country']
    })
    const existingCountries = new Set(rawCountries.map(c => c.country).filter(Boolean) as string[])

    // Sort countries: LatAm priority first, then others alphabetically
    const orderedCountries: string[] = []
    LATAM_PRIORITY.forEach(c => {
      if (existingCountries.has(c)) {
        orderedCountries.push(c)
        existingCountries.delete(c)
      }
    })
    const otherCountries = Array.from(existingCountries).sort((a, b) => a.localeCompare(b))
    const finalCountriesList = [...orderedCountries, ...otherCountries]

    return NextResponse.json({
      data: paginatedData,
      metadata: {
        page,
        limit,
        totalCount,
        totalPages: Math.ceil(totalCount / limit) || 1
      },
      stats: {
        totalValue,
        totalDeals,
        totalFirms: ranked.length
      },
      ranking: ranked.slice(0, 10),
      countries: finalCountriesList,
      currentFilters: {
        country: countryParam,
        type,
        sortBy,
        sortOrder
      }
    })

  } catch (error: any) {
    console.error('API Error in /api/metrics/firms:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
