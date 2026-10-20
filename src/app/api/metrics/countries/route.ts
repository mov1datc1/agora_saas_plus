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

    const today = new Date()
    today.setHours(23, 59, 59, 999)

    // Base filter for dates and operation types
    const baseTxWhere: any = {
      type: { in: ['M&A', 'Emisiones', 'Financiamientos'] },
      dateAnnounced: { gte: new Date('1990-01-01'), lte: today },
    }
    if (type && type !== 'Todas') baseTxWhere.type = type
    if (dateStart) {
      baseTxWhere.dateAnnounced = { ...baseTxWhere.dateAnnounced, gte: new Date(dateStart + 'T00:00:00.000Z') }
    }
    if (dateEnd) {
      const nextDay = new Date(dateEnd + 'T00:00:00.000Z')
      nextDay.setUTCDate(nextDay.getUTCDate() + 1)
      baseTxWhere.dateAnnounced = { ...baseTxWhere.dateAnnounced, lt: nextDay < today ? nextDay : today }
    }

    // Specific country transaction filter
    const countryTxWhere: any = {
      ...baseTxWhere,
      country: { contains: countryParam, mode: 'insensitive' }
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
      tx.country.split(',').forEach((c: string) => {
        const name = c.trim()
        if (!name) return
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
      const indName = tx.industry?.name || 'Varios / Sin Clasificar'
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

    const totalCountryPublicVal = industries.reduce((acc, i) => acc + i.montoAcumulado, 0)

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
