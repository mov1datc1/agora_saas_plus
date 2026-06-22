import { NextResponse } from 'next/server'
import prisma from '@/lib/prisma'

export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    const transactions = await prisma.transaction.findMany({
      include: {
        industry: true,
        companies: { include: { company: true } },
        advisors: { include: { firm: true } }
      }
    })

    const industryMap: Record<string, any> = {}

    transactions.forEach(tx => {
      const indName = tx.industry?.name || 'Varios / Sin Clasificar'
      
      if (!industryMap[indName]) {
        industryMap[indName] = {
          id: indName,
          industria: indName,
          monto: 0,
          operaciones: 0,
          paises: new Set<string>(),
          empresas: new Set<string>(),
          firmas: new Set<string>(),
          tiposOperacion: new Set<string>(),
        }
      }

      industryMap[indName].operaciones += 1
      if (tx.value) {
        industryMap[indName].monto += Number(tx.value)
      }
      if (tx.country) {
        tx.country.split(',').map((c: string) => c.trim()).forEach((c: string) => {
          if (c) industryMap[indName].paises.add(c)
        })
      }
      if (tx.type) {
        industryMap[indName].tiposOperacion.add(tx.type)
      }

      tx.companies.forEach((c: any) => {
        if (c.company?.name) industryMap[indName].empresas.add(c.company.name)
      })

      tx.advisors.forEach((a: any) => {
        if (a.firm?.name) industryMap[indName].firmas.add(a.firm.name)
      })
    })

    const tableData = Object.values(industryMap).map((ind: any) => ({
      ...ind,
      paises: Array.from(ind.paises),
      empresas: Array.from(ind.empresas),
      firmas: Array.from(ind.firmas),
      tiposOperacion: Array.from(ind.tiposOperacion)
    }))

    // Sort by operations desc
    tableData.sort((a, b) => b.operaciones - a.operaciones)

    return NextResponse.json(tableData)
  } catch (error: any) {
    console.error('API Error in /api/metrics/industries:', error)
    return NextResponse.json({ error: error.message || 'Error loading data' }, { status: 500 })
  }
}
