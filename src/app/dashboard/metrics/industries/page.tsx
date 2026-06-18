import prisma from '@/lib/prisma'
import IndustriesClient from './IndustriesClient'

export const dynamic = 'force-dynamic'

export default async function MetricsIndustriesPage({
  searchParams
}: {
  searchParams: Promise<{ industry?: string }>
}) {
  const params = await searchParams
  const selectedIndustry = params.industry

  const whereClause = selectedIndustry && selectedIndustry !== 'Todas' 
    ? { industry: { name: selectedIndustry } } 
    : {}

  // 1. Obtener todas las transacciones (filtradas)
  const transactions = await prisma.transaction.findMany({
    where: whereClause,
    include: {
      industry: true
    }
  })

  // 2. Obtener industrias más activas (sin filtrar, para el dropdown y el listado de Top Industrias)
  // Siempre queremos ver el Top global independientemente del filtro actual
  const allTransactions = await prisma.transaction.findMany({
    include: { industry: true }
  })

  // 2. Agrupar por "Quarter/Trimestre" para la gráfica lineal (Últimos 4 cuartiles)
  // Crear estructura base continua de los últimos 6 quarters para asegurar línea continua
  const d = new Date()
  const currentYear = d.getFullYear()
  const currentMonth = d.getMonth()
  let currentQuarter = 1
  if (currentMonth >= 3 && currentMonth <= 5) currentQuarter = 2
  if (currentMonth >= 6 && currentMonth <= 8) currentQuarter = 3
  if (currentMonth >= 9) currentQuarter = 4

  const baseQuarters: Record<string, number> = {}
  for (let i = 5; i >= 0; i--) {
    let q = currentQuarter - i
    let y = currentYear
    while (q <= 0) {
      q += 4
      y -= 1
    }
    baseQuarters[`Q${q} ${y}`] = 0
  }

  const quarterCounts: Record<string, number> = { ...baseQuarters }
  
  transactions.forEach(tx => {
    const date = tx.dateAnnounced || tx.dateClosed
    if (date) {
      const month = date.getMonth()
      const year = date.getFullYear()
      let quarter = 'Q1'
      if (month >= 3 && month <= 5) quarter = 'Q2'
      if (month >= 6 && month <= 8) quarter = 'Q3'
      if (month >= 9) quarter = 'Q4'
      
      const label = `${quarter} ${year}`
      if (quarterCounts[label] !== undefined) {
        quarterCounts[label] += 1
      }
    }
  })

  // Conservar solo los que están en baseQuarters (los últimos 6 quarters) para mantener coherencia temporal
  const historyData = Object.keys(baseQuarters).map(quarter => ({
    quarter,
    volume: quarterCounts[quarter]
  }))

  // 3. Obtener industrias más activas
  const industryCounts: Record<string, number> = {}
  allTransactions.forEach(tx => {
    const indName = tx.industry?.name || 'Otras'
    industryCounts[indName] = (industryCounts[indName] || 0) + 1
  })

  const topIndustries = Object.entries(industryCounts)
    .map(([name, deals]) => ({ name, deals }))
    .sort((a, b) => b.deals - a.deals)
    .slice(0, 5)

  // 4. Empresa más activa
  const dbCompanies = await prisma.company.findMany({
    include: { _count: { select: { transactions: true } } },
    orderBy: { transactions: { _count: 'desc' } },
    take: 1
  })

  const topCompany = dbCompanies.length > 0 ? dbCompanies[0].name : "Sin registros"

  return (
    <div className="flex flex-col h-full space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-700">
      <IndustriesClient 
        historyData={historyData} 
        topIndustries={topIndustries}
        topCompany={topCompany}
      />
    </div>
  )
}
