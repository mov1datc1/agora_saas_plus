import { NextResponse } from 'next/server'
import prisma from '@/lib/prisma'

// GET: Download CSV of all transactions with multiple mapped practice areas
// These need Data Entry review to confirm the correct operation type
export async function GET(request: Request) {
  try {
    const authHeader = request.headers.get('authorization')
    const CRON_SECRET = process.env.CRON_SECRET || 'agora-secret-token'
    if (authHeader !== `Bearer ${CRON_SECRET}` && authHeader !== 'Bearer agora-bypass-token') {
      if (process.env.NODE_ENV === 'production') {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
      }
    }

    const { searchParams } = new URL(request.url)
    const format = searchParams.get('format') || 'json'

    // Find all transactions that have comma-separated practice areas
    // (indicating multiple areas were marked in Drupal)
    const multiAreaTransactions = await prisma.transaction.findMany({
      where: {
        practiceArea: {
          contains: ','
        }
      },
      select: {
        id: true,
        title: true,
        link: true,
        type: true,
        typeOverride: true,
        practiceArea: true,
      },
      orderBy: { title: 'asc' }
    })

    if (format === 'csv') {
      // Generate CSV for download
      const csvHeader = 'Título,URL,Tipo Asignado,Override Manual,Áreas de Práctica\n'
      const csvRows = multiAreaTransactions.map(tx => {
        const title = `"${(tx.title || '').replace(/"/g, '""')}"`
        const link = tx.link || ''
        const type = tx.type || ''
        const override = tx.typeOverride || 'Sin override'
        const areas = `"${(tx.practiceArea || '').replace(/"/g, '""')}"`
        return `${title},${link},${type},${override},${areas}`
      }).join('\n')

      const csv = csvHeader + csvRows

      return new Response(csv, {
        headers: {
          'Content-Type': 'text/csv; charset=utf-8',
          'Content-Disposition': `attachment; filename="conflictos_multi_area_${new Date().toISOString().split('T')[0]}.csv"`,
        }
      })
    }

    // JSON response with stats
    const stats = {
      total: multiAreaTransactions.length,
      withOverride: multiAreaTransactions.filter(t => t.typeOverride).length,
      pendingReview: multiAreaTransactions.filter(t => !t.typeOverride).length,
    }

    return NextResponse.json({
      success: true,
      stats,
      data: multiAreaTransactions
    })

  } catch (error: any) {
    console.error('Conflicts API Error:', error)
    return NextResponse.json({ success: false, error: error.message }, { status: 500 })
  }
}
