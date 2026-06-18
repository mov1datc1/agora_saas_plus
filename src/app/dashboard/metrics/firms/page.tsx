import prisma from '@/lib/prisma'
import FirmsClient from './FirmsClient'

export const dynamic = 'force-dynamic'

export default async function MetricsFirmsPage() {
  // 1. Obtener todas las transacciones con su industria
  const transactions = await prisma.transaction.findMany({
    include: {
      industry: true
    }
  })

  const totalTransactions = transactions.length
  
  // Conteo de Firmas reales en la DB
  const totalFirms = await prisma.firm.count()

  // 2. Agrupar por Año para la gráfica del Histórico (Últimos 10 años)
  const currentYearNum = new Date().getFullYear()
  const yearCounts: Record<string, number> = {}
  
  for (let y = currentYearNum - 10; y <= currentYearNum; y++) {
    yearCounts[y.toString()] = 0
  }
  
  transactions.forEach(tx => {
    const dateToUse = tx.dateAnnounced || tx.dateClosed
    if (dateToUse) {
      const year = dateToUse.getFullYear().toString()
      if (yearCounts[year] !== undefined) {
        yearCounts[year] += 1
      }
    }
  })

  // Convertir el objeto a Array ordenado por año
  const historyData = Object.entries(yearCounts)
    .map(([year, count]) => ({ year, transacciones: count }))
    .sort((a, b) => a.year.localeCompare(b.year))

  // 3. Agrupar por Industria para la gráfica Circular
  const industryCounts: Record<string, number> = {}

  transactions.forEach(tx => {
    const indName = tx.industry?.name || 'Varios / Sin Clasificar'
    industryCounts[indName] = (industryCounts[indName] || 0) + 1
  })

  // Convertir a Array y ordenar de mayor a menor (top 5)
  const practiceData = Object.entries(industryCounts)
    .map(([name, count]) => ({ name, value: count }))
    .sort((a, b) => b.value - a.value)
    .slice(0, 5) // Mostrar solo el Top 5 en la gráfica circular

  // 4. Firmas Top
  const firmsData = await prisma.firm.findMany({
    include: { _count: { select: { transactions: true } } },
    orderBy: { transactions: { _count: 'desc' } },
    take: 5
  })
  
  const topFirmsList = firmsData.map(f => ({
    name: f.name,
    deals: f._count.transactions
  }))

  return (
    <div className="flex flex-col h-full space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-700">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-3xl font-bold tracking-tight text-foreground">Metricas del Mercado Global</h2>
          <p className="mt-2 text-sm text-muted-foreground">Analiza el desempeño y volumen histórico de transacciones.</p>
        </div>
      </div>

      <FirmsClient 
        totalTransactions={totalTransactions} 
        totalFirms={totalFirms}
        historyData={historyData} 
        practiceData={practiceData} 
        topFirmsList={topFirmsList}
      />
    </div>
  )
}
