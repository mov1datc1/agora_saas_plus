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
    const [industries, countriesRaw, firms, lawyers] = await Promise.all([
      // Unique industries
      prisma.industry.findMany({
        where: { transactions: { some: baseWhere } },
        select: { name: true },
        orderBy: { name: 'asc' },
      }),
      // Country strings (may contain combined values like "Brasil, Chile")
      prisma.transaction.findMany({
        where: { ...baseWhere, country: { not: null } },
        select: { country: true },
        distinct: ['country'],
      }),
      // All firms with valid transactions (searchable dropdown handles large lists)
      prisma.firm.findMany({
        where: { transactions: { some: { transaction: baseWhere } } },
        select: { name: true },
        orderBy: { name: 'asc' },
      }),
      // All lawyers with valid transactions
      prisma.lawyer.findMany({
        where: { transactions: { some: { transaction: baseWhere } } },
        select: { name: true },
        orderBy: { name: 'asc' },
      }),
    ])

    // Split combined country strings ("Brasil, Chile") into individual countries
    // and deduplicate for clean dropdown options
    const countrySet = new Set<string>()
    for (const c of countriesRaw) {
      if (!c.country) continue
      const parts = c.country.split(',').map((p: string) => p.trim()).filter(Boolean)
      for (const part of parts) {
        countrySet.add(part)
      }
    }
    const countries = [...countrySet].sort((a, b) => a.localeCompare(b, 'es'))

    return NextResponse.json({
      industries: industries.map((i: any) => i.name).filter(Boolean),
      countries,
      // Group firms by base name — strip " - Sede" suffix so all sedes
      // (e.g., "Philippi - Chile", "Philippi - Colombia") appear as one entry.
      // Users combine with country filter to narrow by specific sede.
      firms: (() => {
        const baseNames = new Set<string>()
        for (const f of firms) {
          if (!f.name) continue
          // Strip sede suffix: "Firm Name - Country/Region" → "Firm Name"
          const baseName = f.name.includes(' - ')
            ? f.name.substring(0, f.name.lastIndexOf(' - ')).trim()
            : f.name
          baseNames.add(baseName)
        }
        return [...baseNames].sort((a, b) => a.localeCompare(b, 'es'))
      })(),
      lawyers: lawyers.map((l: any) => l.name).filter(Boolean),
    })
  } catch (error: any) {
    console.error('[API_FILTERS_ERROR]', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
