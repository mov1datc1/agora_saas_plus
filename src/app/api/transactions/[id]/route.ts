import { NextResponse } from 'next/server'
import prisma from '@/lib/prisma'

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params

    if (!id) {
      return NextResponse.json({ error: 'Falta el ID de la transacción' }, { status: 400 })
    }

    const transaction = await prisma.transaction.findUnique({
      where: { id },
      include: {
        industry: true,
        advisors: {
          include: { firm: true }
        },
        lawyers: {
          include: { lawyer: { include: { firm: true } } }
        },
        companies: {
          include: { company: true }
        }
      }
    })

    if (!transaction) {
      return NextResponse.json({ error: 'Transacción no encontrada' }, { status: 404 })
    }

    return NextResponse.json({ transaction })
  } catch (error) {
    console.error('Error fetching transaction detail:', error)
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 })
  }
}
