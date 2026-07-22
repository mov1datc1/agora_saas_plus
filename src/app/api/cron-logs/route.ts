import { NextResponse } from 'next/server'
import prisma from '@/lib/prisma'

export const dynamic = 'force-dynamic'

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    
    // Date filter
    const dateStart = searchParams.get('dateStart')
    const dateEnd = searchParams.get('dateEnd')
    const jobName = searchParams.get('jobName') // "sync-drupal", "check-subscriptions", etc.
    const status = searchParams.get('status') // "SUCCESS", "FAILED", "RUNNING"
    const limit = parseInt(searchParams.get('limit') || '50', 10)
    const page = parseInt(searchParams.get('page') || '1', 10)

    // Build where clause
    const where: any = {}

    if (jobName) {
      where.jobName = jobName
    }
    if (status) {
      where.status = status
    }
    if (dateStart || dateEnd) {
      where.startedAt = {}
      if (dateStart) {
        where.startedAt.gte = new Date(dateStart + 'T00:00:00Z')
      }
      if (dateEnd) {
        // Use start of next day for inclusive range
        const nextDay = new Date(dateEnd + 'T00:00:00Z')
        nextDay.setUTCDate(nextDay.getUTCDate() + 1)
        where.startedAt.lt = nextDay
      }
    }

    const [logs, totalCount] = await Promise.all([
      prisma.cronLog.findMany({
        where,
        orderBy: { startedAt: 'desc' },
        take: limit,
        skip: (page - 1) * limit,
      }),
      prisma.cronLog.count({ where }),
    ])

    // Summary stats
    const stats = await prisma.cronLog.groupBy({
      by: ['status'],
      where: {
        ...(dateStart || dateEnd ? { startedAt: where.startedAt } : {}),
      },
      _count: true,
    })

    return NextResponse.json({
      success: true,
      data: logs,
      metadata: {
        totalCount,
        totalPages: Math.ceil(totalCount / limit),
        page,
        limit,
      },
      stats: stats.reduce((acc: any, s) => {
        acc[s.status] = s._count
        return acc
      }, {}),
    })
  } catch (error: any) {
    console.error('CronLog API Error:', error)
    return NextResponse.json({ success: false, error: error.message }, { status: 500 })
  }
}
