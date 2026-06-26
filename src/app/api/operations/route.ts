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

    // 2. Extraer parámetros de paginación (Preparado para Infinite Scroll en RN)
    const limitParam = searchParams.get('limit')
    const limit = limitParam === 'all' ? undefined : parseInt(limitParam || '500')
    const offset = parseInt(searchParams.get('offset') || '0')

    // 3. Consulta de Base de Datos Eficiente
    const dbTransactions = await prisma.transaction.findMany({
      select: {
        id: true,
        title: true,
        type: true,
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
        }
      },
      orderBy: {
        dateAnnounced: 'desc',
      },
      take: limit,
      skip: offset,
    })

    // 4. Mapeo Agresivo para el Cliente
    const mappedTransactions = dbTransactions.map(tx => ({
      id: tx.id,
      date: tx.dateClosed ? new Date(tx.dateClosed).toLocaleDateString('es-ES') : 
            tx.dateAnnounced ? new Date(tx.dateAnnounced).toLocaleDateString('es-ES') : 'Sin fecha',
      title: tx.title,
      type: tx.type || 'M&A',
      amount: tx.valueString || 'Por definir',
      status: tx.status || 'Completada',
      industry: tx.industry?.name || 'Varios',
      country: tx.country || 'Latinoamérica',
      firm: tx.advisors?.map(a => a.firm?.name).filter(Boolean).join(', ') || 'Sin firmas listadas', 
      lawyer: tx.lawyers?.map(l => l.lawyer?.name).filter(Boolean).join(', ') || 'Sin abogados listados',
      link: tx.link || '#'
    }))

    return NextResponse.json({ 
      data: mappedTransactions,
      metadata: {
        count: mappedTransactions.length,
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
