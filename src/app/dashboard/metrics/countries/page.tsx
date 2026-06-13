import prisma from '@/lib/prisma'
import CountriesClient from './CountriesClient'

export const dynamic = 'force-dynamic'

export default async function MetricsCountriesPage() {
  // 1. Obtener todas las transacciones
  const transactions = await prisma.transaction.findMany({
    include: {
      industry: true
    }
  })

  // 2. Agrupar por año
  const yearCounts: Record<string, number> = {}
  transactions.forEach(tx => {
    const dateToUse = tx.dateAnnounced || tx.dateClosed
    if (dateToUse) {
      const year = dateToUse.getFullYear().toString()
      yearCounts[year] = (yearCounts[year] || 0) + 1
    }
  })

  const crossBorderData = Object.entries(yearCounts)
    .map(([year, count]) => ({ year, count }))
    .sort((a, b) => a.year.localeCompare(b.year))

  // 3. Top Industrias
  const industryCounts: Record<string, number> = {}
  transactions.forEach(tx => {
    const indName = tx.industry?.name || 'Varios'
    industryCounts[indName] = (industryCounts[indName] || 0) + 1
  })

  const topIndustries = Object.entries(industryCounts)
    .map(([name, deals]) => ({ name, deals }))
    .sort((a, b) => b.deals - a.deals)
    .slice(0, 2)

  // 4. Top Firmas Reales
  const firms = await prisma.firm.findMany({
    include: {
      _count: {
        select: { transactions: true }
      }
    },
    orderBy: {
      transactions: {
        _count: 'desc'
      }
    },
    take: 5
  })

  const topFirms = firms.map(f => ({
    name: f.name,
    deals: f._count.transactions
  }))

  return (
    <div className="flex flex-col h-full space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-700">
      <CountriesClient 
        crossBorderData={crossBorderData} 
        topFirms={topFirms} 
        topIndustries={topIndustries} 
      />
    </div>
  )
}
