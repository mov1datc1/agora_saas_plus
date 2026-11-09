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

    // Date boundary (canonical UTC boundary matching /api/operations)
    const nowUTC = new Date()
    const endOfTodayUTC = new Date(Date.UTC(nowUTC.getUTCFullYear(), nowUTC.getUTCMonth(), nowUTC.getUTCDate() + 1))

    // Build WHERE for transactions (canonical COALESCE(dateClosed, dateAnnounced) logic)
    const txWhere: any = {
      type: { in: ['M&A', 'Emisiones', 'Financiamientos'] },
      dateAnnounced: {
        gte: new Date('1990-01-01T00:00:00Z'),
        lt: endOfTodayUTC,
      },
    }
    if (type && type !== 'Todas' && type !== 'Todos') txWhere.type = type

    if (dateStart || dateEnd) {
      const dateGte = dateStart ? new Date(dateStart + 'T00:00:00.000Z') : new Date('1990-01-01T00:00:00.000Z')
      let dateLt = endOfTodayUTC
      if (dateEnd) {
        dateLt = new Date(dateEnd + 'T00:00:00.000Z')
        dateLt.setUTCDate(dateLt.getUTCDate() + 1)
      }
      delete txWhere.dateAnnounced
      txWhere.AND = [
        {
          OR: [
            { dateClosed: { gte: dateGte, lt: dateLt } },
            { dateClosed: null, dateAnnounced: { gte: dateGte, lt: dateLt } },
          ]
        }
      ]
    }

    // Canonical country transaction filter so KPI totals match /api/operations and /api/metrics/countries
    const canonicalCountryTxWhere: any = {
      ...txWhere,
      ...(countryParam && countryParam !== 'Todos' ? { country: { contains: countryParam, mode: 'insensitive' } } : {})
    }

    // Build WHERE for firm
    const firmWhere: any = {}
    if (countryParam && countryParam !== 'Todos') {
      firmWhere.country = { equals: countryParam, mode: 'insensitive' }
    } else {
      firmWhere.country = { not: null }
    }

    // Query firms, canonical country transaction stats, and countries list in parallel
    const [firms, countryAggregate, rawCountries] = await Promise.all([
      prisma.firm.findMany({
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
                  excerpt: true,
                  industry: { select: { name: true } },
                  industries: { select: { industry: { select: { name: true } } } },
                  companies: { select: { company: { select: { name: true } } } },
                  lawyers: { select: { lawyer: { select: { name: true } } } }
                }
              }
            }
          }
        }
      }),
      prisma.transaction.aggregate({
        where: canonicalCountryTxWhere,
        _count: { id: true },
        _sum: { value: true }
      }),
      prisma.firm.findMany({
        where: { country: { not: null } },
        select: { country: true },
        distinct: ['country']
      })
    ])

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
          fecha: tx.dateClosed?.toISOString() || tx.dateAnnounced?.toISOString() || null,
          industria: (tx.industries?.length > 0 ? [...new Set(tx.industries.map((ti: any) => ti.industry?.name).filter(Boolean))].join(', ') : tx.industry?.name) || 'Varios / Sin Clasificar',
          empresa: tx.companies?.map((c: any) => c.company?.name).filter(Boolean).join(', ') || 'N/D',
          abogados: tx.lawyers?.map((l: any) => l.lawyer?.name).filter(Boolean).join(', ') || 'N/D',
          excerpt: tx.excerpt ? tx.excerpt.replace(/<[^>]+>/g, '').replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/\s+/g, ' ').trim() : ''
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
    const totalValue = countryAggregate._sum.value ? Number(countryAggregate._sum.value) : 0
    const totalDeals = countryAggregate._count.id || 0

    // Paginate
    const paginatedData = rankedWithPos.slice((page - 1) * limit, page * limit)

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
