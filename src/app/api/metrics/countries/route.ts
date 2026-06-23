import { NextResponse } from 'next/server'
import prisma from '@/lib/prisma'

export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    const transactions = await prisma.transaction.findMany({
      select: {
        country: true,
        value: true,
        type: true,
        industry: { select: { name: true } },
        companies: { select: { company: { select: { name: true } } } },
        advisors: { select: { firm: { select: { name: true } } } },
        lawyers: { select: { lawyer: { select: { name: true } } } }
      }
    })

    const countryMap: Record<string, any> = {}

    transactions.forEach(tx => {
      if (!tx.country) return
      
      const countriesList = tx.country.split(',').map(c => c.trim()).filter(Boolean)
      
      countriesList.forEach(cName => {
        if (!countryMap[cName]) {
          countryMap[cName] = {
            id: cName,
            pais: cName,
            monto: 0,
            operaciones: 0,
            firmas: new Set<string>(),
            industrias: new Set<string>(),
            empresas: new Set<string>(),
            abogados: new Set<string>(),
            tiposOperacion: new Set<string>(),
          }
        }

        countryMap[cName].operaciones += 1
        if (tx.value) {
          countryMap[cName].monto += Number(tx.value)
        }
        if (tx.type) {
          countryMap[cName].tiposOperacion.add(tx.type)
        }
        if (tx.industry?.name) {
          countryMap[cName].industrias.add(tx.industry.name)
        }

        tx.companies.forEach((c: any) => {
          if (c.company?.name) countryMap[cName].empresas.add(c.company.name)
        })

        tx.advisors.forEach((a: any) => {
          if (a.firm?.name) countryMap[cName].firmas.add(a.firm.name)
        })

        tx.lawyers.forEach((l: any) => {
          if (l.lawyer?.name) countryMap[cName].abogados.add(l.lawyer.name)
        })
      })
    })

    const tableData = Object.values(countryMap).map((c: any) => ({
      ...c,
      firmas: Array.from(c.firmas),
      industrias: Array.from(c.industrias),
      empresas: Array.from(c.empresas),
      abogados: Array.from(c.abogados),
      tiposOperacion: Array.from(c.tiposOperacion)
    }))

    // Sort by operations desc
    tableData.sort((a, b) => b.operaciones - a.operaciones)

    return NextResponse.json(tableData)
  } catch (error: any) {
    console.error('API Error in /api/metrics/countries:', error)
    return NextResponse.json({ error: error.message || 'Error loading data' }, { status: 500 })
  }
}
