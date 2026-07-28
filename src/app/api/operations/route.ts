import { NextResponse } from 'next/server'
import prisma from '@/lib/prisma'

export const revalidate = 0

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)

    // Pagination
    const page = parseInt(searchParams.get('page') || '1')
    const limit = parseInt(searchParams.get('limit') || '50')
    const offset = (page - 1) * limit
    const sortBy = searchParams.get('sortBy') || 'date'
    const sortDir = searchParams.get('sortDir') || 'desc'

    // Filters
    const type = searchParams.get('type') // M&A, Emisiones, Financiamientos
    const industry = searchParams.get('industry')
    const country = searchParams.get('country')
    const firm = searchParams.get('firm')
    const lawyer = searchParams.get('lawyer')
    const search = searchParams.get('search')
    const dateStart = searchParams.get('dateStart')
    const dateEnd = searchParams.get('dateEnd')
    const valueRange = searchParams.get('valueRange')

    // Date boundary: exclude future dates and invalid dates (all in UTC)
    const nowUTC = new Date()
    const endOfTodayUTC = new Date(Date.UTC(nowUTC.getUTCFullYear(), nowUTC.getUTCMonth(), nowUTC.getUTCDate() + 1)) // Start of tomorrow UTC

    // Build WHERE clause
    const where: any = {
      type: { in: ['M&A', 'Emisiones', 'Financiamientos'] },
      dateAnnounced: {
        gte: new Date('1990-01-01T00:00:00Z'),
        lt: endOfTodayUTC, // Exclude future dates
      }
    }

    // Type filter
    if (type && type !== 'Todos') {
      where.type = type
    }

    // Industry filter
    if (industry && industry !== 'Todas') {
      where.industry = { name: industry }
    }

    // Country filter
    if (country && country !== 'Todos') {
      where.country = { contains: country, mode: 'insensitive' }
    }

    // Firm filter (via advisors relation)
    // Dropdown now sends full name with sede (e.g., "Cuatrecasas - Santiago")
    // so we use equals for exact matching
    if (firm && firm !== 'Todas') {
      where.advisors = {
        some: { firm: { name: { equals: firm, mode: 'insensitive' } } }
      }
    }

    // Lawyer filter (via lawyers relation)
    if (lawyer && lawyer !== 'Todos') {
      where.lawyers = {
        some: { lawyer: { name: { contains: lawyer, mode: 'insensitive' } } }
      }
    }

    // Search filter (title, company name)
    if (search && search.trim()) {
      const s = search.trim()
      where.OR = [
        { title: { contains: s, mode: 'insensitive' } },
        { companies: { some: { company: { name: { contains: s, mode: 'insensitive' } } } } },
        { advisors: { some: { firm: { name: { contains: s, mode: 'insensitive' } } } } },
      ]
    }

    // ── Date range filter (v3.2 — July 28 2026) ──
    // The UI displays COALESCE(dateClosed, dateAnnounced) as the "effective date".
    // The filter MUST use the same logic so results are consistent with what the
    // user sees. Previously we used OR(dateAnnounced IN range, dateClosed IN range)
    // which caused mismatches when dateAnnounced (from post.created fallback) was
    // in range but dateClosed (the real date) was from a different year.
    if (dateStart || dateEnd) {
      const dateGte = dateStart ? new Date(dateStart + 'T00:00:00.000Z') : new Date('1990-01-01T00:00:00Z')
      let dateLt = endOfTodayUTC
      if (dateEnd) {
        dateLt = new Date(dateEnd + 'T00:00:00.000Z')
        dateLt.setUTCDate(dateLt.getUTCDate() + 1)
      }

      // Remove the base dateAnnounced filter since we'll use COALESCE logic
      delete where.dateAnnounced

      // Use the effective date: dateClosed if available, otherwise dateAnnounced
      // This matches the UI display: fmtDate(tx.dateClosed || tx.dateAnnounced)
      const dateCondition = {
        AND: [
          {
            OR: [
              // Case 1: dateClosed exists → filter by dateClosed
              { dateClosed: { gte: dateGte, lt: dateLt } },
              // Case 2: dateClosed is null → filter by dateAnnounced
              { dateClosed: null, dateAnnounced: { gte: dateGte, lt: dateLt } },
            ]
          }
        ]
      }

      // Merge with existing AND conditions
      if (where.AND) {
        where.AND.push(dateCondition)
      } else if (where.OR) {
        // There's already an OR (from search), wrap everything properly
        const existingOr = where.OR
        delete where.OR
        where.AND = [
          { OR: existingOr },
          dateCondition,
        ]
      } else {
        where.AND = [dateCondition]
      }
    }

    // Value range filter
    if (valueRange && valueRange !== 'Todos') {
      const ranges: Record<string, { gte?: number; lt?: number; gt?: number }> = {
        'Menos de $10M': { gt: 0, lt: 10000000 },
        '$10M - $50M': { gte: 10000000, lt: 50000000 },
        '$50M - $100M': { gte: 50000000, lt: 100000000 },
        '$100M - $500M': { gte: 100000000, lt: 500000000 },
        'Más de $500M': { gte: 500000000 },
      }
      if (ranges[valueRange]) {
        where.value = ranges[valueRange]
      }
    }

    // Build ORDER BY
    let orderBy: any = { dateAnnounced: 'desc' }
    if (sortBy === 'amount') {
      orderBy = { value: sortDir }
    } else if (sortBy === 'date') {
      orderBy = { dateAnnounced: sortDir }
    }

    // Execute queries in parallel for max performance
    const [dbTransactions, totalCount, aggregates] = await Promise.all([
      // Paginated data
      prisma.transaction.findMany({
        where,
        select: {
          id: true,
          title: true,
          type: true,
          status: true,
          value: true,
          country: true,
          isPublished: true,
          excerpt: true,
          dateAnnounced: true,
          dateClosed: true,
          link: true,
          industry: { select: { name: true } },
          advisors: { select: { role: true, firm: { select: { name: true } } } },
          lawyers: { select: { role: true, lawyer: { select: { name: true } } } },
          companies: { select: { role: true, company: { select: { name: true } } } }
        },
        orderBy,
        take: limit,
        skip: offset,
      }),
      // Total count (for pagination)
      prisma.transaction.count({ where }),
      // Aggregate stats (value sum, distinct counts)
      prisma.transaction.aggregate({
        where: { ...where, value: { ...where.value, gt: 0 } },
        _sum: { value: true },
        _avg: { value: true },
        _count: true,
      }),
    ])

    // Format monetary value
    const fmtVal = (v: any) => {
      if (!v || Number(v) === 0) return 'Valor confidencial'
      const n = Number(v)
      if (n >= 1e9) return `USD ${(n / 1e9).toFixed(1)}B`
      if (n >= 1e6) return `USD ${(n / 1e6).toFixed(1)}M`
      if (n >= 1e3) return `USD ${(n / 1e3).toFixed(0)}K`
      return `USD ${n.toLocaleString()}`
    }

    const fmtDate = (d: Date | null) => {
      if (!d) return ''
      const y = d.getFullYear()
      if (y < 1990 || y > 2030) return ''
      return d.toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit', year: 'numeric' })
    }

    // Helper: extract base name and sede from firm name
    const extractFirmSede = (fullName: string): { base: string; sede: string } => {
      if (fullName.includes(' - ')) {
        const lastDash = fullName.lastIndexOf(' - ')
        return {
          base: fullName.substring(0, lastDash).trim(),
          sede: fullName.substring(lastDash + 3).trim(),
        }
      }
      return { base: fullName, sede: '' }
    }

    const data = dbTransactions.map((tx: any) => {
      const firmNames: string[] = tx.advisors?.map((a: any) => a.firm?.name).filter(Boolean) || []
      const firmParts = firmNames.map(extractFirmSede)
      // Base names (deduplicated)
      const baseNames = [...new Set(firmParts.map(f => f.base))]
      // Sedes (deduplicated, non-empty)
      const sedes = [...new Set(firmParts.map(f => f.sede).filter(Boolean))]

      return {
        id: tx.id,
        date: fmtDate(tx.dateClosed || tx.dateAnnounced),
        title: tx.title,
        type: tx.type,
        status: tx.status || 'Completada',
        isPublished: tx.isPublished,
        amount: fmtVal(tx.value),
        amountRaw: tx.value ? Number(tx.value) : 0,
        industry: tx.industry?.name || '',
        country: tx.country || '',
        firm: baseNames.join(', ') || '',
        firmSede: sedes.join(', ') || '',
        lawyer: tx.lawyers?.map((l: any) => l.lawyer?.name).filter(Boolean).join(', ') || '',
        company: tx.companies?.map((c: any) => c.company?.name).filter(Boolean).join(', ') || '',
        link: tx.link || '',
        excerpt: tx.excerpt || null,
      }
    })

    // Stats
    const totalValue = aggregates._sum?.value ? Number(aggregates._sum.value) : 0
    const avgTicket = aggregates._avg?.value ? Number(aggregates._avg.value) : 0

    return NextResponse.json({
      data,
      metadata: {
        page,
        limit,
        totalCount,
        totalPages: Math.ceil(totalCount / limit),
      },
      stats: {
        totalValue,
        avgTicket,
        txWithValue: aggregates._count || 0,
      }
    })

  } catch (error: any) {
    console.error('[API_OPERATIONS_ERROR]', error)
    return NextResponse.json(
      { error: 'Internal Server Error', message: error.message },
      { status: 500 }
    )
  }
}
