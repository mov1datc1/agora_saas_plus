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

    const countryParam = searchParams.get('country') || 'México'
    const type = searchParams.get('type') || 'Todas'
    const search = searchParams.get('search') || ''
    const dateStart = searchParams.get('dateStart')
    const dateEnd = searchParams.get('dateEnd')

    const nowUTC = new Date()
    const endOfTodayUTC = new Date(Date.UTC(nowUTC.getUTCFullYear(), nowUTC.getUTCMonth(), nowUTC.getUTCDate() + 1))

    // Base filter for dates and operation types (canonical with /api/operations)
    const baseTxWhere: any = {
      type: { in: ['M&A', 'Emisiones', 'Financiamientos'] },
      dateAnnounced: {
        gte: new Date('1990-01-01T00:00:00Z'),
        lt: endOfTodayUTC,
      },
    }
    if (type && type !== 'Todas' && type !== 'Todos') baseTxWhere.type = type

    if (dateStart || dateEnd) {
      const dateGte = dateStart ? new Date(dateStart + 'T00:00:00.000Z') : new Date('1990-01-01T00:00:00.000Z')
      let dateLt = endOfTodayUTC
      if (dateEnd) {
        dateLt = new Date(dateEnd + 'T00:00:00.000Z')
        dateLt.setUTCDate(dateLt.getUTCDate() + 1)
      }
      delete baseTxWhere.dateAnnounced
      baseTxWhere.AND = [
        {
          OR: [
            { dateClosed: { gte: dateGte, lt: dateLt } },
            { dateClosed: null, dateAnnounced: { gte: dateGte, lt: dateLt } },
          ]
        }
      ]
    }

    // Specific country transaction filter
    const countryTxWhere: any = {
      ...baseTxWhere,
      ...(countryParam && countryParam !== 'Todos' ? { country: { contains: countryParam, mode: 'insensitive' } } : {})
    }

    // Run parallel queries: Global map data + Selected country deep transaction data + available countries
    const [mapTxs, countryTxs, rawCountries] = await Promise.all([
      prisma.transaction.findMany({
        where: {
          ...baseTxWhere,
          country: { not: null },
        },
        select: {
          country: true,
          value: true,
        }
      }),
      prisma.transaction.findMany({
        where: countryTxWhere,
        select: {
          id: true,
          title: true,
          type: true,
          value: true,
          valueString: true,
          country: true,
          dateAnnounced: true,
          dateClosed: true,
          industry: { select: { id: true, name: true } },
          industries: { select: { industry: { select: { id: true, name: true } } } },
          companies: { select: { company: { select: { name: true } } } },
          lawyers: { select: { lawyer: { select: { name: true } } } },
          advisors: {
            select: {
              firm: { select: { id: true, name: true, country: true } }
            }
          }
        }
      }),
      prisma.firm.findMany({
        where: { country: { not: null } },
        select: { country: true },
        distinct: ['country']
      })
    ])

    // 1. Process Global Map Data
    const mapDataMap: Record<string, { pais: string; operaciones: number; valorAcumulado: number }> = {}
    mapTxs.forEach((tx: any) => {
      if (!tx.country) return
      const uniqueCountries = [...new Set(tx.country.split(',').map((c: string) => c.trim()).filter(Boolean))] as string[]
      uniqueCountries.forEach((name: string) => {
        if (!mapDataMap[name]) {
          mapDataMap[name] = { pais: name, operaciones: 0, valorAcumulado: 0 }
        }
        mapDataMap[name].operaciones++
        const v = tx.value ? Number(tx.value) : 0
        if (v > 0) mapDataMap[name].valorAcumulado += v
      })
    })
    const mapData = Object.values(mapDataMap).sort((a, b) => b.operaciones - a.operaciones)

    // 2. Process Industry and Firm Breakdown for Selected Country
    const totalCountryDeals = countryTxs.length
    const indMap = new Map<string, any>()

    countryTxs.forEach((tx: any) => {
      const rawInds: string[] = tx.industries?.map((ti: any) => ti.industry?.name).filter(Boolean) || []
      if (rawInds.length === 0 && tx.industry?.name) {
        rawInds.push(tx.industry.name)
      }
      const txIndNames = rawInds.length > 0 ? [...new Set(rawInds)] : ['Varios / Sin Clasificar']

      for (const indName of txIndNames) {
        if (!indMap.has(indName)) {
          indMap.set(indName, {
            nombre: indName,
            operaciones: 0,
            operacionesPublicas: 0,
            operacionesConfidenciales: 0,
            montoAcumulado: 0,
            firmsMap: new Map<string, any>()
          })
        }

        const ind = indMap.get(indName)
        ind.operaciones++
        const val = tx.value ? Number(tx.value) : 0
        if (val > 0) {
          ind.montoAcumulado += val
          ind.operacionesPublicas++
        } else {
          ind.operacionesConfidenciales++
        }

        // Track advising firms inside this industry for this country
        tx.advisors?.forEach((adv: any) => {
          const fn = adv.firm?.name
          if (!fn) return
          if (!ind.firmsMap.has(fn)) {
            ind.firmsMap.set(fn, {
              firma: fn,
              pais: adv.firm?.country || countryParam,
              operaciones: 0,
              montoAcumulado: 0,
              txIds: new Set<string>(),
              transacciones: []
            })
          }
          const firmData = ind.firmsMap.get(fn)
          if (!firmData.txIds.has(tx.id)) {
            firmData.txIds.add(tx.id)
            firmData.operaciones++
            if (val > 0) firmData.montoAcumulado += val
            firmData.transacciones.push({
              id: tx.id,
              title: tx.title,
              type: tx.type || 'M&A',
              monto: val > 0 ? val : null,
              montoString: tx.valueString || (val > 0 ? `USD ${val.toLocaleString()}` : 'Valor confidencial'),
              fecha: tx.dateAnnounced?.toISOString() || tx.dateClosed?.toISOString() || null,
              empresa: tx.companies?.map((c: any) => c.company?.name).filter(Boolean).join(', ') || 'N/D',
              abogados: tx.lawyers?.map((l: any) => l.lawyer?.name).filter(Boolean).join(', ') || 'N/D'
            })
          }
        })
      }
    })

    // Convert industries to array with percentages and sorted firm ranking
    let industries = Array.from(indMap.values()).map(ind => {
      const porcentaje = totalCountryDeals > 0 
        ? Number(((ind.operaciones / totalCountryDeals) * 100).toFixed(1)) 
        : 0

      // Sort firms inside this industry by deals desc, value desc
      const sortedFirms = Array.from(ind.firmsMap.values())
        .sort((a: any, b: any) => {
          const diff = b.operaciones - a.operaciones
          if (diff !== 0) return diff
          return b.montoAcumulado - a.montoAcumulado
        })
        .map((f: any, i: number) => ({
          posicion: i + 1,
          firma: f.firma,
          pais: f.pais,
          operaciones: f.operaciones,
          montoAcumulado: f.montoAcumulado,
          transacciones: f.transacciones
        }))

      return {
        nombre: ind.nombre,
        operaciones: ind.operaciones,
        operacionesPublicas: ind.operacionesPublicas,
        operacionesConfidenciales: ind.operacionesConfidenciales,
        montoAcumulado: ind.montoAcumulado,
        porcentaje,
        firmasCount: sortedFirms.length,
        firmas: sortedFirms
      }
    }).sort((a, b) => b.operaciones - a.operaciones)

    // Filter by search query if provided
    if (search && search.trim()) {
      const q = search.trim().toLowerCase()
      industries = industries.filter(ind => ind.nombre.toLowerCase().includes(q))
    }

    // Compute canonical country value without double-counting multi-industry transactions
    const totalCountryPublicVal = countryTxs.reduce((acc: number, tx: any) => {
      const v = tx.value ? Number(tx.value) : 0
      return v > 0 ? acc + v : acc
    }, 0)

    // 3. Prioritized Countries List
    const existingCountries = new Set(rawCountries.map((c: any) => c.country).filter(Boolean) as string[])
    // Also include any countries found in mapData
    mapData.forEach(m => existingCountries.add(m.pais))

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
      country: countryParam,
      stats: {
        totalValue: totalCountryPublicVal,
        totalDeals: totalCountryDeals,
        totalIndustries: industries.length,
      },
      mapData,
      industries,
      countries: finalCountriesList,
      filters: {
        country: countryParam,
        type,
        dateStart,
        dateEnd
      }
    })

  } catch (error: any) {
    console.error('API Error in /api/metrics/countries:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
