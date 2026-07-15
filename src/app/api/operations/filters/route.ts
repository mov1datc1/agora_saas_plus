import { NextResponse } from 'next/server'
import prisma from '@/lib/prisma'

// Cache filter options for 5 minutes (they don't change often)
export const revalidate = 300

export async function GET() {
  try {
    const today = new Date()
    today.setHours(23, 59, 59, 999)

    const baseWhere = {
      type: { in: ['M&A', 'Emisiones', 'Financiamientos'] },
      dateAnnounced: { gte: new Date('1990-01-01'), lte: today },
    }

    // Parallel queries for filter options
    const [industries, countries, firms] = await Promise.all([
      // Unique industries
      prisma.industry.findMany({
        where: { transactions: { some: baseWhere } },
        select: { name: true },
        orderBy: { name: 'asc' },
      }),
      // Unique countries
      prisma.transaction.findMany({
        where: { ...baseWhere, country: { not: null } },
        select: { country: true },
        distinct: ['country'],
        orderBy: { country: 'asc' },
      }),
      // Top firms (limit to 200 most active)
      prisma.firm.findMany({
        where: { transactions: { some: { transaction: baseWhere } } },
        select: { name: true },
        orderBy: { name: 'asc' },
        take: 200,
      }),
    ])

    return NextResponse.json({
      industries: industries.map((i: any) => i.name).filter(Boolean),
      countries: countries.map((c: any) => c.country).filter(Boolean).sort(),
      firms: firms.map((f: any) => f.name).filter(Boolean),
    })
  } catch (error: any) {
    console.error('[API_FILTERS_ERROR]', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
