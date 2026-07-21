import { NextResponse } from 'next/server'
import prisma from '@/lib/prisma'

export const revalidate = 0

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)

    // Filters
    const type = searchParams.get('type')
    const country = searchParams.get('country')
    const search = searchParams.get('search')
    const dateStart = searchParams.get('dateStart')
    const dateEnd = searchParams.get('dateEnd')
    const page = parseInt(searchParams.get('page') || '1')
    const limit = parseInt(searchParams.get('limit') || '50')

    // Date boundary
    const today = new Date()
    today.setHours(23, 59, 59, 999)

    // Build WHERE for transaction relation
    const txWhere: any = {
      type: { in: ['M&A', 'Emisiones', 'Financiamientos'] },
      dateAnnounced: { gte: new Date('1990-01-01'), lte: today },
    }
    if (type && type !== 'Todas') txWhere.type = type
    if (country && country !== 'Todos') {
      txWhere.country = { contains: country, mode: 'insensitive' }
    }
    if (dateStart) {
      txWhere.dateAnnounced = { ...txWhere.dateAnnounced, gte: new Date(dateStart + 'T00:00:00.000Z') }
    }
    if (dateEnd) {
      const nextDay = new Date(dateEnd + 'T00:00:00.000Z')
      nextDay.setUTCDate(nextDay.getUTCDate() + 1)
      txWhere.dateAnnounced = { ...txWhere.dateAnnounced, lt: nextDay < today ? nextDay : today }
    }

    // Fetch advisors with filtered transactions
    const advisors = await prisma.transactionAdvisor.findMany({
      where: { transaction: txWhere },
      select: {
        id: true,
        firm: { select: { name: true } },
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
            companies: { select: { company: { select: { name: true } } } },
            lawyers: { select: { lawyer: { select: { name: true } } } }
          }
        }
      },
      orderBy: { transaction: { dateAnnounced: 'desc' } }
    })

    // Build aggregated firm ranking
    const firmMap: Record<string, { deals: number; totalValue: number }> = {}
    advisors.forEach((adv: any) => {
      const name = adv.firm?.name || 'Sin firma'
      if (!firmMap[name]) firmMap[name] = { deals: 0, totalValue: 0 }
      firmMap[name].deals++
      firmMap[name].totalValue += adv.transaction?.value ? Number(adv.transaction.value) : 0
    })

    const ranking = Object.entries(firmMap)
      .map(([name, data]) => ({ name, ...data }))
      .sort((a, b) => b.deals - a.deals)

    // Format helpers
    const fmtVal = (v: any, vs: string | null) => {
      if (!v || Number(v) === 0) return 'Valor confidencial'
      const n = Number(v)
      if (n >= 1e9) return `USD ${(n / 1e9).toFixed(1)}B`
      if (n >= 1e6) return `USD ${(n / 1e6).toFixed(1)}M`
      return `USD ${n.toLocaleString()}`
    }

    // Apply search filter and paginate
    let tableData = advisors.map((adv: any) => {
      const tx = adv.transaction
      return {
        id: adv.id,
        firma: adv.firm?.name || 'Sin firma',
        monto: fmtVal(tx.value, tx.valueString),
        volumen: tx.value ? Number(tx.value) : null,
        tipoOperacion: tx.type || 'M&A',
        pais: tx.country || 'N/D',
        abogados: tx.lawyers?.map((l: any) => l.lawyer?.name).filter(Boolean).join(', ') || 'N/D',
        industria: tx.industry?.name || 'Varios / Sin Clasificar',
        empresa: tx.companies?.map((c: any) => c.company?.name).filter(Boolean).join(', ') || 'N/D',
        fecha: tx.dateAnnounced?.toISOString() || tx.dateClosed?.toISOString() || null,
        transactionId: tx.id
      }
    })

    // Search filter
    if (search && search.trim()) {
      const s = search.trim().toLowerCase()
      tableData = tableData.filter(r =>
        r.firma.toLowerCase().includes(s) || r.monto.toLowerCase().includes(s)
      )
    }

    const totalCount = tableData.length
    const totalValue = tableData.reduce((sum, r) => sum + (r.volumen || 0), 0)

    // Paginate
    const paginatedData = tableData.slice((page - 1) * limit, page * limit)

    // Unique countries for filter dropdown
    const countries = new Set<string>()
    advisors.forEach((adv: any) => {
      const c = adv.transaction?.country
      if (c) c.split(',').forEach((x: string) => countries.add(x.trim()))
    })

    return NextResponse.json({
      data: paginatedData,
      metadata: { page, limit, totalCount, totalPages: Math.ceil(totalCount / limit) },
      stats: { totalValue, totalFirms: ranking.length },
      ranking: ranking.slice(0, 100),
      countries: Array.from(countries).sort(),
    })

  } catch (error: any) {
    console.error('API Error in /api/metrics/firms:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
