import prisma from '@/lib/prisma'
import CountriesClient from './CountriesClient'

export const revalidate = 43200 // 12 hours cache

export default async function MetricsCountriesPage({
  searchParams
}: {
  searchParams: Promise<{ country?: string, year?: string }>
}) {
  const params = await searchParams
  const selectedCountry = params.country
  const selectedYear = params.year

  const whereClause = selectedCountry && selectedCountry !== 'Todos'
    ? { country: { contains: selectedCountry } }
    : {}

  // 1. Obtener transacciones filtradas para los gráficos
  const transactions = await prisma.transaction.findMany({
    where: whereClause,
    include: {
      industry: true,
      advisors: { include: { firm: true } }
    }
  })

  // Obtener TODAS las transacciones para extraer la lista de países para el dropdown
  const allTransactions = await prisma.transaction.findMany({
    select: { country: true }
  })

  const uniqueCountriesSet = new Set<string>()
  allTransactions.forEach(tx => {
    if (tx.country) {
      tx.country.split(',').map(c => c.trim()).filter(Boolean).forEach(c => uniqueCountriesSet.add(c))
    }
  })
  const availableCountries = Array.from(uniqueCountriesSet).sort()

  // 2. Agrupar por año (Últimos 10 años continuos)
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

  const crossBorderData = Object.entries(yearCounts)
    .map(([year, count]) => ({ year, count }))
    .sort((a, b) => a.year.localeCompare(b.year))

  // Filtrar transacciones por año para los Tops
  const filteredTransactions = transactions.filter(tx => {
    if (!selectedYear) return true
    const d = tx.dateAnnounced || tx.dateClosed
    if (!d) return false
    return d.getFullYear().toString() === selectedYear
  })

  // 3. Top Industrias (Basado en el año/país filtrado)
  const industryCounts: Record<string, number> = {}
  filteredTransactions.forEach(tx => {
    const indName = tx.industry?.name || 'Varios'
    industryCounts[indName] = (industryCounts[indName] || 0) + 1
  })

  const topIndustries = Object.entries(industryCounts)
    .map(([name, deals]) => ({ name, deals }))
    .sort((a, b) => b.deals - a.deals)
    .slice(0, 2)

  // 4. Top Firmas Reales (Basado en el año/país filtrado)
  const firmCounts: Record<string, number> = {}
  filteredTransactions.forEach(tx => {
    tx.advisors?.forEach(adv => {
      if (adv.firm?.name) {
        firmCounts[adv.firm.name] = (firmCounts[adv.firm.name] || 0) + 1
      }
    })
  })

  const topFirms = Object.entries(firmCounts)
    .map(([name, deals]) => ({ name, deals }))
    .sort((a, b) => b.deals - a.deals)
    .slice(0, 5)

  // 5. Top Países (Basado en el año/país filtrado)
  const countryCounts: Record<string, number> = {}
  filteredTransactions.forEach(tx => {
    if (tx.country) {
      const cList = tx.country.split(',').map(c => c.trim()).filter(Boolean)
      cList.forEach(c => {
        countryCounts[c] = (countryCounts[c] || 0) + 1
      })
    }
  })

  const topCountries = Object.entries(countryCounts)
    .map(([name, deals]) => ({ name, deals }))
    .sort((a, b) => b.deals - a.deals)
    .slice(0, 5)

  return (
    <div className="flex flex-col h-full space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-700">
      <CountriesClient 
        crossBorderData={crossBorderData} 
        topFirms={topFirms} 
        topIndustries={topIndustries}
        topCountries={topCountries}
        availableCountries={availableCountries}
      />
    </div>
  )
}
