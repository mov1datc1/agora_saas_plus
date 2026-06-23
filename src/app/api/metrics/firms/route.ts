import { NextResponse } from 'next/server'
import prisma from '@/lib/prisma'

export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    const rawAdvisors = await prisma.transactionAdvisor.findMany({
      select: {
        firm: { select: { name: true } },
        transaction: {
          select: {
            id: true,
            title: true,
            dateClosed: true,
            dateAnnounced: true,
            value: true,
            type: true,
            country: true,
            industry: { select: { name: true } },
            companies: { select: { company: { select: { name: true } } } },
            lawyers: { select: { lawyer: { select: { name: true } } } }
          }
        }
      },
      orderBy: {
        transaction: { dateAnnounced: 'desc' }
      }
    })

    const tableData = rawAdvisors.map(adv => {
      const tx = adv.transaction
      return {
        id: adv.id,
        firma: adv.firm.name,
        monto: tx.valueString || 'No revelado',
        volumen: tx.value ? Number(tx.value) : null,
        tipoOperacion: tx.type || 'M&A',
        pais: tx.country || 'N/D',
        abogados: tx.lawyers.map(l => l.lawyer.name).join(', ') || 'N/D',
        industria: tx.industry?.name || 'Varios / Sin Clasificar',
        empresa: tx.companies.map(c => c.company.name).join(', ') || 'N/D',
        fecha: tx.dateAnnounced ? tx.dateAnnounced.toISOString() : (tx.dateClosed ? tx.dateClosed.toISOString() : null),
        transactionId: tx.id
      }
    })

    return NextResponse.json(tableData)
  } catch (error: any) {
    console.error('API Error in /api/metrics/firms:', error)
    return NextResponse.json({ error: error.message || 'Error loading data' }, { status: 500 })
  }
}
