import { NextResponse } from 'next/server'
import prisma from '@/lib/prisma'

export const revalidate = 0

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)

    const type = searchParams.get('type')
    const country = searchParams.get('country')
    const search = searchParams.get('search')
    const dateStart = searchParams.get('dateStart')
    const dateEnd = searchParams.get('dateEnd')
    const page = parseInt(searchParams.get('page') || '1')
    const limit = parseInt(searchParams.get('limit') || '50')

    const today = new Date()
    today.setHours(23, 59, 59, 999)

    const txWhere: any = {
      type: { in: ['M&A', 'Emisiones', 'Financiamientos'] },
      dateAnnounced: { gte: new Date('1990-01-01'), lte: today },
      industryId: { not: null },
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

    // Get industry aggregates using groupBy
    const transactions = await prisma.transaction.findMany({
      where: txWhere,
      select: {
        id: true,
        value: true,
        type: true,
        country: true,
        industry: { select: { name: true } },
      }
    })

    // Aggregate by industry
    const industryMap: Record<string, { deals: number; totalValue: number; countries: Set<string> }> = {}
    transactions.forEach((tx: any) => {
      const name = tx.industry?.name || 'Sin Industria'
      if (!industryMap[name]) industryMap[name] = { deals: 0, totalValue: 0, countries: new Set() }
      industryMap[name].deals++
      industryMap[name].totalValue += tx.value ? Number(tx.value) : 0
      if (tx.country) tx.country.split(',').forEach((c: string) => industryMap[name].countries.add(c.trim()))
    })

    let tableData = Object.entries(industryMap)
      .map(([name, data]) => ({
        industria: name,
        operaciones: data.deals,
        valorAcumulado: data.totalValue,
        paises: data.countries.size,
      }))
      .sort((a, b) => b.operaciones - a.operaciones)

    // Search filter
    if (search && search.trim()) {
      const s = search.trim().toLowerCase()
      tableData = tableData.filter(r => r.industria.toLowerCase().includes(s))
    }

    const totalCount = tableData.length
    const totalValue = tableData.reduce((sum, r) => sum + r.valorAcumulado, 0)
    const ranking = tableData.slice(0, 100)

    // Paginate
    const paginatedData = tableData.slice((page - 1) * limit, page * limit)

    // Collect unique countries
    const allCountries = new Set<string>()
    transactions.forEach((tx: any) => {
      if (tx.country) tx.country.split(',').forEach((c: string) => allCountries.add(c.trim()))
    })

    return NextResponse.json({
      data: paginatedData,
      metadata: { page, limit, totalCount, totalPages: Math.ceil(totalCount / limit) },
      stats: { totalValue, totalIndustries: totalCount },
      ranking,
      countries: Array.from(allCountries).sort(),
    })

  } catch (error: any) {
    console.error('API Error in /api/metrics/industries:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
