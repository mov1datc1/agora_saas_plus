import { NextResponse } from 'next/server'
import prisma from '@/lib/prisma'

export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    const transactions = await prisma.transaction.findMany({
      select: {
        id: true,
        country: true,
        value: true,
        type: true,
        dateAnnounced: true,
        dateClosed: true,
        industry: { select: { name: true } },
        companies: { select: { company: { select: { name: true } } } },
        advisors: { select: { firm: { select: { name: true } } } },
        lawyers: { select: { lawyer: { select: { name: true } } } }
      }
    })

    return NextResponse.json(transactions)
  } catch (error: any) {
    console.error('API Error in /api/metrics/countries:', error)
    return NextResponse.json({ error: error.message || 'Error loading data' }, { status: 500 })
  }
}
