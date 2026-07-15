import { NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { createClient } from '@/utils/supabase/server'

export const revalidate = 0 // Disable caching for realtime massive data sync compatibility

export async function GET(request: Request) {
  try {
    // 1. Opcional: Proteger la ruta (Buenas prácticas 2026)
    // const supabase = await createClient()
    // const { data: { session } } = await supabase.auth.getSession()
    // if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    // 2. Extraer parámetros de paginación
    const { searchParams } = new URL(request.url)
    const limitParam = searchParams.get('limit')
    const limit = limitParam === 'all' ? undefined : parseInt(limitParam || '500')
    const offset = parseInt(searchParams.get('offset') || '0')

    // 3. Date boundary: exclude future dates and invalid dates
    const today = new Date()
    today.setHours(23, 59, 59, 999)

    // 4. Consulta de Base de Datos Eficiente
    const dbTransactions = await prisma.transaction.findMany({
      where: {
        type: {
          in: ['M&A', 'Emisiones', 'Financiamientos']
        },
        dateAnnounced: {
          gte: new Date('1990-01-01'),
          lte: today,
        }
      },
      select: {
        id: true,
        title: true,
        type: true,
        value: true,
        valueString: true,
        status: true,
        country: true,
        dateAnnounced: true,
        dateClosed: true,
        link: true,
        industry: {
          select: { name: true }
        },
        advisors: {
          select: {
            firm: {
              select: { name: true }
            }
          }
        },
        lawyers: {
          select: {
            lawyer: {
              select: { name: true }
            }
          }
        },
        companies: {
          select: {
            company: {
              select: { name: true }
            }
          }
        }
      },
      orderBy: {
        dateAnnounced: 'desc',
      },
      take: limit,
      skip: offset,
    })

    // 4. Mapeo Agresivo para el Cliente
    // Format monetary value for display
    const formatValue = (val: any, valStr: string | null) => {
      if (!val || Number(val) === 0) return 'Valor confidencial'
      const num = Number(val)
      if (num >= 1e9) return `USD ${(num / 1e9).toFixed(1)}B`
      if (num >= 1e6) return `USD ${(num / 1e6).toFixed(1)}M`
      if (num >= 1e3) return `USD ${(num / 1e3).toFixed(0)}K`
      return `USD ${num.toLocaleString()}`
    }

    const formatDate = (d: Date | null) => {
      if (!d) return 'Sin fecha'
      const year = d.getFullYear()
      if (year < 1990 || year > 2030) return 'Sin fecha'
      return d.toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit', year: 'numeric' })
    }

    const mappedTransactions = dbTransactions.map((tx: any) => ({
      id: tx.id,
      date: formatDate(tx.dateClosed || tx.dateAnnounced),
      title: tx.title,
      type: tx.type,
      amount: formatValue(tx.value, tx.valueString),
      amountRaw: tx.value ? Number(tx.value) : 0,
      industry: tx.industry?.name || '',
      country: tx.country || '',
      firm: tx.advisors?.map((a: any) => a.firm?.name).filter(Boolean).join(', ') || '', 
      lawyer: tx.lawyers?.map((l: any) => l.lawyer?.name).filter(Boolean).join(', ') || '',
      company: tx.companies?.map((c: any) => c.company?.name).filter(Boolean).join(', ') || '',
      link: tx.link || ''
    }))

    // Get total count for summary (fast separate query)
    const totalCount = await prisma.transaction.count({
      where: {
        type: { in: ['M&A', 'Emisiones', 'Financiamientos'] },
        dateAnnounced: { gte: new Date('1990-01-01'), lte: today }
      }
    })

    return NextResponse.json({ 
      data: mappedTransactions,
      metadata: {
        count: mappedTransactions.length,
        totalCount,
        offset,
        limit
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
