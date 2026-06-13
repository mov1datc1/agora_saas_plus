import prisma from '@/lib/prisma'
import IndustriesClient from './IndustriesClient'

export const dynamic = 'force-dynamic'

export default async function MetricsIndustriesPage() {
  // 1. Obtener todas las transacciones
  const transactions = await prisma.transaction.findMany({
    include: {
      industry: true
    }
  })

  // 2. Agrupar por "Quarter/Trimestre" para la gráfica lineal
  const quarterCounts: Record<string, number> = {}
  
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
      quarterCounts[label] = (quarterCounts[label] || 0) + 1
    }
  })

  // Ordenar cronológicamente asumiendo un formato "Q1 2026"
  const historyData = Object.entries(quarterCounts)
    .map(([quarter, volume]) => ({ quarter, volume }))
    .sort((a, b) => {
      const [qa, ya] = a.quarter.split(' ')
      const [qb, yb] = b.quarter.split(' ')
      if (ya !== yb) return ya.localeCompare(yb)
      return qa.localeCompare(qb)
    })

  // 3. Obtener industrias más activas
  const industryCounts: Record<string, number> = {}
  transactions.forEach(tx => {
    const indName = tx.industry?.name || 'Otras'
    industryCounts[indName] = (industryCounts[indName] || 0) + 1
  })

  const topIndustries = Object.entries(industryCounts)
    .map(([name, deals]) => ({ name, deals }))
    .sort((a, b) => b.deals - a.deals)
    .slice(0, 5)

  // 4. Empresa más activa (Fake por ahora hasta que ETL mapee las empresas)
  const topCompany = "Por recolectar en ETL"

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
