import { NextResponse } from 'next/server'
import prisma from '@/lib/prisma'

export const revalidate = 0

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)

    const type = searchParams.get('type')
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
      country: { not: null },
    }
    if (type && type !== 'Todas') txWhere.type = type
    if (dateStart) {
      txWhere.dateAnnounced = { ...txWhere.dateAnnounced, gte: new Date(dateStart + 'T00:00:00') }
    }
    if (dateEnd) {
      const end = new Date(dateEnd + 'T23:59:59')
      txWhere.dateAnnounced = { ...txWhere.dateAnnounced, lte: end < today ? end : today }
    }

    const transactions = await prisma.transaction.findMany({
      where: txWhere,
      select: {
        id: true,
        country: true,
        value: true,
        type: true,
      }
    })

    // Aggregate by country (splitting multi-country transactions)
    const countryMap: Record<string, { deals: number; totalValue: number }> = {}
    transactions.forEach((tx: any) => {
      if (!tx.country) return
      tx.country.split(',').forEach((c: string) => {
        const name = c.trim()
        if (!name) return
        if (!countryMap[name]) countryMap[name] = { deals: 0, totalValue: 0 }
        countryMap[name].deals++
        countryMap[name].totalValue += tx.value ? Number(tx.value) : 0
      })
    })

    let tableData = Object.entries(countryMap)
      .map(([name, data]) => ({
        pais: name,
        operaciones: data.deals,
        valorAcumulado: data.totalValue,
      }))
      .sort((a, b) => b.operaciones - a.operaciones)

    // Search filter
    if (search && search.trim()) {
      const s = search.trim().toLowerCase()
      tableData = tableData.filter(r => r.pais.toLowerCase().includes(s))
    }

    const totalCount = tableData.length
    const totalValue = tableData.reduce((sum, r) => sum + r.valorAcumulado, 0)
    const ranking = tableData.slice(0, 100)

    // Paginate
    const paginatedData = tableData.slice((page - 1) * limit, page * limit)

    return NextResponse.json({
      data: paginatedData,
      metadata: { page, limit, totalCount, totalPages: Math.ceil(totalCount / limit) },
      stats: { totalValue, totalCountries: totalCount },
      ranking,
    })

  } catch (error: any) {
    console.error('API Error in /api/metrics/countries:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
