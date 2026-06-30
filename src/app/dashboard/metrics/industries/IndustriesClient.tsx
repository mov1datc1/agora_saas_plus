'use client'

import { useState, useMemo, useEffect } from 'react'
import Link from 'next/link'
import { Building2, Users, FileText, ArrowUpRight, X, Globe, Search, Filter, ChevronRight, ChevronLeft, Loader2, Briefcase, ChevronUp, ChevronDown, Download, Lock, ExternalLink } from 'lucide-react'
import { checkTrialRestrictions, checkCanDownload } from '../../actions'
import PaywallModal from '@/components/ui/PaywallModal'
import EntityDetailModal from '@/components/ui/EntityDetailModal'
import SearchableSelect from '@/components/ui/SearchableSelect'
import ProDateRangePicker from '@/components/ui/ProDateRangePicker'
import { exportToExcel } from '@/lib/exportUtils'
import useSWR from 'swr'

const fetcher = (url: string) => fetch(url).then(res => res.json())

interface TableRow {
  id: string
  industria: string
  monto: number
  operaciones: number
  paises: string[]
  empresas: string[]
  firmas: string[]
  firmasRanking?: { name: string, count: number }[]
  tiposOperacion: string[]
  transacciones?: any[]
}

export default function IndustriesClient() {
  const [transactions, setTransactions] = useState<any[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isRankingModalOpen, setIsRankingModalOpen] = useState(false)
  const [filterType, setFilterType] = useState<string>('Todas')
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedRow, setSelectedRow] = useState<TableRow | null>(null)
  
  const [selectedCountry, setSelectedCountry] = useState('Todos')
  const [dateRange, setDateRange] = useState({ start: '', end: '' })
  
  const [isPanelExpanded, setIsPanelExpanded] = useState(true)
  const [isDetailModalOpen, setIsDetailModalOpen] = useState(false)
  const [sortConfig, setSortConfig] = useState<{key: 'industria' | 'monto' | 'operaciones', direction: 'asc' | 'desc'} | null>(null)
  const [currentPage, setCurrentPage] = useState(1)
  const [rankingSearchQuery, setRankingSearchQuery] = useState('')
  const itemsPerPage = 50

  const [tooltipContent, setTooltipContent] = useState<{name: string, activeIndustries: string[], x: number, y: number} | null>(null)

  const [showPaywall, setShowPaywall] = useState(false)
  const [paywallTitle, setPaywallTitle] = useState('')
  const [paywallMessage, setPaywallMessage] = useState('')
  const [isDataAllowed, setIsDataAllowed] = useState(true)

  useEffect(() => {
    const checkLimits = async () => {
      const usageCheck = await checkTrialRestrictions()
      if (!usageCheck.allowed) {
        setIsDataAllowed(false)
        setPaywallTitle('Límite Diario Alcanzado')
        setPaywallMessage(usageCheck.message || 'Has llegado al máximo de consultas diarias, en 24hrs. tendrás una nueva oportunidad o suscríbete.')
        setShowPaywall(true)
      }
    }
    checkLimits()
  }, [])

  const handleDownloadExcel = async () => {
    const downloadCheck = await checkCanDownload()
    if (!downloadCheck.allowed) {
      setPaywallTitle('Descarga Bloqueada')
      setPaywallMessage(downloadCheck.message || 'Solo puedes descargar datos con una suscripción activa.')
      setShowPaywall(true)
      return
    }

    exportToExcel(filteredData.map(row => ({
      Industria: row.industria,
      Operaciones: row.operaciones,
      Monto_USD: row.monto
    })), 'industrias_agora_plus')
  }

  const { data: apiData, error, isLoading: isSwrLoading } = useSWR('/api/metrics/industries', fetcher)

  useEffect(() => {
    if (apiData) {
      setTransactions(apiData)
      setIsLoading(false)
    }
  }, [apiData])

  const filterOptions = ['Todas', 'M&A', 'Financiamientos', 'Emisiones']

  const uniqueCountries = useMemo(() => {
    const countries = new Set<string>()
    transactions.forEach(tx => {
      if (tx.country) {
        tx.country.split(',').forEach((c: string) => countries.add(c.trim()))
      }
    })
    return Array.from(countries).sort()
  }, [transactions])

  // Filtrado base de transacciones (Tipo, País, Fecha)
  const baseFilteredTransactions = useMemo(() => {
    return transactions.filter(tx => {
      const matchesType = filterType === 'Todas' || tx.type === filterType
      const matchesCountry = selectedCountry === 'Todos' || (tx.country || '').includes(selectedCountry)
      
      let matchesDate = true
      if (dateRange.start || dateRange.end) {
        const txDateStr = tx.dateAnnounced || tx.dateClosed
        if (txDateStr) {
          const txDate = new Date(txDateStr).getTime()
          const startDate = dateRange.start ? new Date(dateRange.start + 'T00:00:00').getTime() : 0
          const endDate = dateRange.end ? new Date(dateRange.end + 'T00:00:00').getTime() + 86399999 : Infinity
          matchesDate = txDate >= startDate && txDate <= endDate
        } else {
          matchesDate = false
        }
      }
      
      return matchesType && matchesCountry && matchesDate
    })
  }, [transactions, filterType, selectedCountry, dateRange])

  // Agrupar por industria
  const aggregatedIndustries = useMemo(() => {
    const industryMap: Record<string, any> = {}

    baseFilteredTransactions.forEach(tx => {
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
          firmasCount: {} as Record<string, number>,
          tiposOperacion: new Set<string>(),
          transacciones: [] as any[]
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

      tx.companies?.forEach((c: any) => {
        if (c.company?.name) industryMap[indName].empresas.add(c.company.name)
      })

      tx.advisors?.forEach((a: any) => {
        if (a.firm?.name) {
          industryMap[indName].firmas.add(a.firm.name)
          industryMap[indName].firmasCount[a.firm.name] = (industryMap[indName].firmasCount[a.firm.name] || 0) + 1
        }
      })

      industryMap[indName].transacciones.push(tx)
    })

    const tableData = Object.values(industryMap).map((ind: any) => ({
      ...ind,
      paises: Array.from(ind.paises),
      empresas: Array.from(ind.empresas),
      firmas: Array.from(ind.firmas),
      firmasRanking: Object.entries(ind.firmasCount)
        .map(([name, count]) => ({ name, count: count as number }))
        .sort((a, b) => b.count - a.count),
      tiposOperacion: Array.from(ind.tiposOperacion)
    }))

    return tableData
  }, [baseFilteredTransactions])

  // Filtrado final para la tabla y KPIs (búsqueda de texto)
  const filteredData = useMemo(() => {
    let result = aggregatedIndustries.filter(row => {
      return row.industria.toLowerCase().includes(searchQuery.toLowerCase())
    })

    if (sortConfig) {
      result.sort((a, b) => {
        if (sortConfig.key === 'industria') {
          return sortConfig.direction === 'asc' 
            ? a.industria.localeCompare(b.industria) 
            : b.industria.localeCompare(a.industria)
        } else if (sortConfig.key === 'monto') {
          return sortConfig.direction === 'asc' ? a.monto - b.monto : b.monto - a.monto
        } else if (sortConfig.key === 'operaciones') {
          return sortConfig.direction === 'asc' ? a.operaciones - b.operaciones : b.operaciones - a.operaciones
        }
        return 0
      })
    } else {
      result.sort((a, b) => b.operaciones - a.operaciones)
    }
    return result
  }, [aggregatedIndustries, searchQuery, sortConfig])

  const handleSort = (key: 'industria' | 'monto' | 'operaciones') => {
    let direction: 'asc' | 'desc' = 'asc'
    if (sortConfig && sortConfig.key === key && sortConfig.direction === 'asc') {
      direction = 'desc'
    }
    setSortConfig({ key, direction })
  }

  useEffect(() => {
    setCurrentPage(1)
  }, [filterType, searchQuery, sortConfig])

  const paginatedData = useMemo(() => {
    const startIndex = (currentPage - 1) * itemsPerPage
    return filteredData.slice(startIndex, startIndex + itemsPerPage)
  }, [filteredData, currentPage])

  const totalPages = Math.ceil(filteredData.length / itemsPerPage)

  useEffect(() => {
    if (paginatedData.length > 0 && (!selectedRow || !paginatedData.find(r => r.id === selectedRow.id))) {
      setSelectedRow(paginatedData[0])
    } else if (paginatedData.length === 0) {
      setSelectedRow(null)
    }
  }, [paginatedData])

  const formatCurrency = (value: number) => {
    if (value >= 1e9) return `$${(value / 1e9).toFixed(2)}B`
    if (value >= 1e6) return `$${(value / 1e6).toFixed(2)}M`
    if (value === 0) return 'No revelado'
    return `$${value.toLocaleString()}`
  }

  const totalIndustries = filteredData.length
  const totalVolume = filteredData.reduce((acc, row) => acc + (row.monto || 0), 0)

  const topIndustriesList = useMemo(() => {
    return [...filteredData].sort((a, b) => b.operaciones - a.operaciones)
  }, [filteredData])

  const filteredRankingList = useMemo(() => {
    if (!rankingSearchQuery) return topIndustriesList
    return topIndustriesList.filter(i => i.industria.toLowerCase().includes(rankingSearchQuery.toLowerCase()))
  }, [topIndustriesList, rankingSearchQuery])

  // Render array tags as PRO chips instead of cluttered strings
  const renderChipsArray = (items: string[], isDark: boolean = false) => {
    if (!items || items.length === 0) {
      return <p className={`text-sm font-medium ${isDark ? 'text-white' : 'text-foreground/80'}`}>No especificadas</p>
    }
    
    return (
      <div className="flex flex-wrap gap-1.5 mt-1">
        {items.map((item, i) => (
          <span 
            key={i} 
            className={`inline-flex items-center px-2 py-1 rounded-md text-[11px] font-semibold leading-none border transition-colors ${
              isDark 
                ? 'bg-white/5 border-white/10 text-white/90 hover:bg-white/10 hover:text-white' 
                : 'bg-brand/5 border-brand/20 text-brand hover:bg-brand/10'
            }`}
          >
            {item}
          </span>
        ))}
      </div>
    )
  }

  return (
    <>
      <PaywallModal 
        isOpen={showPaywall} 
        onClose={() => setShowPaywall(false)} 
        title={paywallTitle} 
        message={paywallMessage} 
      />
      {/* Header PRO con Filtros Globales */}
      <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-6 pb-2">
        <div>
          <h2 className="text-3xl font-bold tracking-tight text-foreground">Métricas: Industrias</h2>
          <p className="mt-2 text-sm text-muted-foreground">Analiza el desempeño y distribución global por sector.</p>
        </div>
        
        <div className="flex flex-wrap items-center gap-3 w-full lg:w-auto">
          {/* Filtro de País PRO */}
          <div className="w-[220px]">
            <SearchableSelect 
              value={selectedCountry}
              onChange={setSelectedCountry}
              options={['Todos', ...uniqueCountries]}
              placeholder="Seleccionar País..."
            />
          </div>

          {/* Filtro de Fecha PRO */}
          <ProDateRangePicker 
            value={dateRange}
            onChange={setDateRange}
          />
        </div>
      </div>

      {selectedRow && (
        <EntityDetailModal
          isOpen={isDetailModalOpen}
          onClose={() => setIsDetailModalOpen(false)}
          title={selectedRow.industria}
          subtitle="Análisis Sectorial"
          amount={formatCurrency(selectedRow.monto)}
          iconType="industry"
          sections={[
            {
              label: 'Países Involucrados',
              count: selectedRow.paises.length,
              value: renderChipsArray(selectedRow.paises, false)
            },
            {
              label: 'Empresas / Clientes',
              count: selectedRow.empresas.length,
              value: renderChipsArray(selectedRow.empresas, false)
            },
            {
              label: 'Firmas Asesoras',
              count: selectedRow.firmas.length,
              value: renderChipsArray(selectedRow.firmas, false)
            }
          ]}
        />
      )}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 items-stretch">
        <div className="bg-surface rounded-2xl p-6 shadow-sm border border-border flex flex-col justify-between">
          <div>
            <div className="flex items-center gap-3 text-muted-foreground mb-2">
              <FileText className="h-5 w-5" />
              <h3 className="text-sm font-semibold">Valor Total del Periodo (USD)</h3>
            </div>
            <p className="text-3xl font-bold text-foreground">{formatCurrency(totalVolume)}</p>
            <p className="text-sm text-green-600 flex items-center mt-2"><ArrowUpRight className="h-4 w-4 mr-1"/> Data sincronizada</p>
          </div>
          <button onClick={() => setFilterType('Todas')} className="mt-6 text-xs font-semibold text-[#E05C50] hover:text-[#D92B4F] transition-colors bg-brand/10 px-3 py-2 rounded-lg text-center w-full">
            Ver a detalles
          </button>
        </div>
        <div className="bg-surface rounded-2xl p-6 shadow-sm border border-border flex flex-col justify-between">
          <div>
            <div className="flex items-center gap-3 text-muted-foreground mb-2">
              <Briefcase className="h-5 w-5" />
              <h3 className="text-sm font-semibold">Industrias Registradas</h3>
            </div>
            <p className="text-3xl font-bold text-foreground">{topIndustriesList.length.toLocaleString()}</p>
            <p className="text-sm text-muted-foreground mt-2">Sectores activos analizados</p>
          </div>
          <button onClick={() => setIsRankingModalOpen(true)} className="mt-6 text-xs font-semibold text-[#E05C50] hover:text-[#D92B4F] transition-colors bg-brand/10 px-3 py-2 rounded-lg text-center w-full">
            Ver a detalles
          </button>
        </div>
        <div className="bg-surface rounded-2xl p-6 shadow-sm border border-border">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-3 text-muted-foreground">
              <Building2 className="h-5 w-5" />
              <h3 className="text-sm font-semibold">Sectores Top Ranking</h3>
            </div>
            {topIndustriesList.length > 0 && (
              <button 
                onClick={() => setIsRankingModalOpen(true)}
                className="text-xs font-semibold text-[#E05C50] hover:text-[#D92B4F] transition-colors bg-brand/10 px-2 py-1 rounded"
              >
                Ver todas
              </button>
            )}
          </div>
          <div className="mt-4 space-y-2">
            {topIndustriesList.slice(0, 3).map((ind, i) => (
              <div key={i} className="flex justify-between items-center bg-muted p-2 rounded-lg">
                <span className="text-xs font-semibold truncate max-w-[120px]" title={ind.industria}>{ind.industria}</span>
                <span className="text-xs bg-surface px-2 py-1 rounded">{ind.operaciones} ops</span>
              </div>
            ))}
            {topIndustriesList.length === 0 && (
              <p className="text-sm text-muted-foreground mt-2">Sin datos.</p>
            )}
          </div>
        </div>
      </div>


      <div className="flex flex-col lg:flex-row gap-6 h-auto lg:h-[600px]">
        <div className="flex-1 bg-surface rounded-2xl shadow-sm border border-border flex flex-col overflow-hidden">
          <div className="p-4 border-b border-border bg-muted/30 flex flex-col sm:flex-row gap-4 justify-between items-start sm:items-center">
            
            <div className="flex flex-wrap gap-2">
              <div className="flex items-center gap-2 mr-2">
                <Filter className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm font-semibold text-muted-foreground hidden sm:inline">Filtro:</span>
              </div>
              {filterOptions.map(option => (
                <button
                  key={option}
                  onClick={() => setFilterType(option)}
                  className={`px-3 py-1.5 text-xs font-medium rounded-full transition-all ${
                    filterType === option 
                      ? 'bg-[#1C1F33] text-white shadow-md' 
                      : 'bg-background text-muted-foreground hover:bg-muted border border-border'
                  }`}
                >
                  {option}
                </button>
              ))}
            </div>

            <div className="relative w-full sm:w-64 shrink-0 flex items-center gap-2">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <input 
                  type="text" 
                  placeholder="Buscar industria..." 
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  className="w-full pl-9 pr-4 py-2 text-sm bg-background border border-border rounded-xl focus:outline-none focus:ring-2 focus:ring-[#E05C50]/20 focus:border-[#E05C50] transition-all"
                />
              </div>
              <button
                onClick={handleDownloadExcel}
                title="Exportar a Excel"
                className="p-2 border border-brand bg-brand/10 text-brand rounded-xl hover:bg-brand hover:text-white transition-colors"
              >
                <Download className="w-4 h-4" />
              </button>
              <button 
                onClick={() => setIsPanelExpanded(!isPanelExpanded)}
                className="p-2 border border-border bg-background rounded-xl text-muted-foreground hover:bg-muted transition-colors lg:hidden"
                title={isPanelExpanded ? "Ocultar panel" : "Mostrar panel"}
              >
                {isPanelExpanded ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
              </button>
            </div>
          </div>

          <div className="flex-1 overflow-auto">
            <table className="w-full text-left border-collapse min-w-[500px]">
              <thead className="bg-muted">
                <tr>
                  <th 
                    className="px-6 py-4 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider cursor-pointer hover:bg-muted/80 transition-colors"
                    onClick={() => handleSort('industria')}
                  >
                    Industria {sortConfig?.key === 'industria' ? (sortConfig.direction === 'asc' ? '↑' : '↓') : ''}
                  </th>
                  <th 
                    className="px-6 py-4 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider cursor-pointer hover:bg-muted/80 transition-colors"
                    onClick={() => handleSort('monto')}
                  >
                    Valor Acumulado (USD) {sortConfig?.key === 'monto' ? (sortConfig.direction === 'asc' ? '↑' : '↓') : ''}
                  </th>
                  <th 
                    className="px-6 py-4 text-right text-xs font-semibold text-muted-foreground uppercase tracking-wider cursor-pointer hover:bg-muted/80 transition-colors"
                    onClick={() => handleSort('operaciones')}
                  >
                    Operaciones {sortConfig?.key === 'operaciones' ? (sortConfig.direction === 'asc' ? '↑' : '↓') : ''}
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {isLoading ? (
                  <tr>
                    <td colSpan={3} className="px-6 py-12 text-center">
                      <div className="flex flex-col items-center justify-center text-muted-foreground">
                        <Loader2 className="h-8 w-8 animate-spin text-[#E05C50] mb-2" />
                        <span className="text-sm font-medium">Cargando datos de industrias...</span>
                      </div>
                    </td>
                  </tr>
                ) : !isDataAllowed ? (
                  <tr>
                    <td colSpan={3} className="px-6 py-12 text-center">
                      <div className="flex flex-col items-center justify-center text-muted-foreground bg-muted/20 rounded-xl p-8 max-w-sm mx-auto">
                        <Lock className="w-10 h-10 mb-3 text-muted-foreground/50" />
                        <span className="text-base font-semibold text-foreground mb-1">Datos Bloqueados</span>
                        <span className="text-sm">Has alcanzado el límite de consultas diarias en tu prueba.</span>
                      </div>
                    </td>
                  </tr>
                ) : (
                  <>
                    {paginatedData.map(row => (
                      <tr 
                        key={row.id} 
                        onClick={() => setSelectedRow(row)}
                        className={`cursor-pointer transition-colors hover:bg-muted/50 ${selectedRow?.id === row.id ? 'bg-[#E05C50]/5 border-l-4 border-l-[#E05C50]' : 'border-l-4 border-l-transparent'}`}
                      >
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-3">
                            <div className={`h-8 w-8 rounded flex items-center justify-center shrink-0 ${selectedRow?.id === row.id ? 'bg-[#E05C50] text-white' : 'bg-muted text-muted-foreground'}`}>
                              <Briefcase className="h-4 w-4" />
                            </div>
                            <span className={`text-sm font-medium ${selectedRow?.id === row.id ? 'text-[#E05C50]' : 'text-foreground'}`}>
                              {row.industria}
                            </span>
                          </div>
                        </td>
                        <td className="px-6 py-4 text-sm font-semibold text-foreground">{formatCurrency(row.monto)}</td>
                        <td className="px-6 py-4 text-sm text-muted-foreground text-right">{row.operaciones} ops</td>
                      </tr>
                    ))}
                    {paginatedData.length === 0 && (
                      <tr>
                        <td colSpan={3} className="px-6 py-12 text-center text-muted-foreground text-sm">
                          No se encontraron industrias para los filtros seleccionados.
                        </td>
                      </tr>
                    )}
                  </>
                )}
              </tbody>
            </table>
          </div>
          
          {filteredData.length > 0 && (
            <div className="p-4 border-t border-border bg-surface flex items-center justify-between">
              <span className="text-sm text-muted-foreground">
                Mostrando {((currentPage - 1) * itemsPerPage) + 1} - {Math.min(currentPage * itemsPerPage, filteredData.length)} de {filteredData.length}
              </span>
              <div className="flex gap-2">
                <button 
                  onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                  disabled={currentPage === 1}
                  className="px-3 py-1.5 bg-background border border-border text-muted-foreground rounded-lg disabled:opacity-50 hover:bg-muted transition-colors text-xs font-semibold"
                >
                  Anterior
                </button>
                <button 
                  onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                  disabled={currentPage === totalPages}
                  className="px-3 py-1.5 bg-background border border-border text-foreground rounded-lg disabled:opacity-50 hover:bg-muted transition-colors text-xs font-semibold"
                >
                  Siguiente
                </button>
              </div>
            </div>
          )}
        </div>

        {isPanelExpanded ? (
          <div className="w-full lg:w-[320px] shrink-0 flex flex-col gap-4 relative animate-in slide-in-from-right-4 duration-300">
            <div className="bg-[#1C1F33] text-white rounded-2xl p-5 shadow-lg relative overflow-hidden h-full flex flex-col">
              <button 
                onClick={() => setIsPanelExpanded(false)}
                className="hidden lg:flex absolute top-4 right-4 z-20 h-8 w-8 items-center justify-center rounded-full bg-white/10 hover:bg-white/20 transition-colors text-white/70 hover:text-white"
                title="Ocultar detalles"
              >
                <ChevronRight className="h-4 w-4" />
              </button>

              <div className="absolute top-0 right-0 -mr-8 -mt-8 w-32 h-32 rounded-full bg-white/5 blur-2xl"></div>
            
            {selectedRow ? (
              <>
                <div className="mb-6 z-10">
                  <h3 className="text-xs uppercase tracking-widest text-white/60 font-semibold mb-1">Detalle del Sector</h3>
                  <p className="text-lg font-bold leading-tight line-clamp-2">{selectedRow.industria}</p>
                  <div className="flex items-center gap-2 mt-3">
                    <span className="inline-block px-2 py-1 bg-[#E05C50] text-white text-xs font-bold rounded">
                      {selectedRow.operaciones} Operaciones
                    </span>
                    <button 
                      onClick={() => setIsDetailModalOpen(true)}
                      className="inline-flex items-center gap-1 px-2 py-1 bg-white/10 hover:bg-white/20 text-white text-xs font-bold rounded transition-colors"
                    >
                      <ExternalLink className="w-3 h-3" /> Visualizar
                    </button>
                  </div>
                </div>

                <div className="space-y-4 flex-1 overflow-y-auto z-10 custom-scrollbar pr-2">
                  <div className="bg-white/10 rounded-xl p-3 backdrop-blur-sm border border-white/5">
                    <div className="flex items-center gap-2 text-white/60 mb-1">
                      <Globe className="h-4 w-4" />
                      <span className="text-xs font-semibold">Países Involucrados ({selectedRow.paises.length})</span>
                    </div>
                    <div className="max-h-32 overflow-y-auto custom-scrollbar">
                      {renderChipsArray(selectedRow.paises, true)}
                    </div>
                  </div>

                  <div className="bg-white/10 rounded-xl p-3 backdrop-blur-sm border border-white/5">
                    <div className="flex items-center gap-2 text-white/60 mb-1">
                      <Building2 className="h-4 w-4" />
                      <span className="text-xs font-semibold">Empresas / Clientes ({selectedRow.empresas.length})</span>
                    </div>
                    <div className="max-h-32 overflow-y-auto custom-scrollbar">
                      {renderChipsArray(selectedRow.empresas, true)}
                    </div>
                  </div>

                  <div className="bg-white/10 rounded-xl p-3 backdrop-blur-sm border border-white/5">
                    <div className="flex items-center gap-2 text-white/60 mb-1">
                      <Users className="h-4 w-4" />
                      <span className="text-xs font-semibold">Ranking Firmas Asesoras</span>
                    </div>
                    <div className="max-h-48 overflow-y-auto custom-scrollbar flex flex-col gap-2 mt-2">
                      {(selectedRow.firmasRanking && selectedRow.firmasRanking.length > 0) ? (
                        selectedRow.firmasRanking.slice(0, 10).map((firma: any, idx: number) => (
                          <div key={firma.name} className="flex justify-between items-center text-xs">
                            <div className="flex items-center gap-2 text-white">
                              <span className="text-white/40 font-mono w-4">{idx + 1}.</span>
                              <span className="truncate max-w-[150px]">{firma.name}</span>
                            </div>
                            <span className="bg-white/10 px-2 py-0.5 rounded text-white/80">{firma.count} ops</span>
                          </div>
                        ))
                      ) : (
                        <p className="text-xs text-white/40 italic">Sin firmas registradas</p>
                      )}
                    </div>
                  </div>

                  <div className="bg-white/10 rounded-xl p-3 backdrop-blur-sm border border-white/5">
                    <div className="flex items-center gap-2 text-white/60 mb-1">
                      <FileText className="h-4 w-4" />
                      <span className="text-xs font-semibold">Operaciones Recientes ({selectedRow.transacciones?.length})</span>
                    </div>
                    <div className="max-h-48 overflow-y-auto custom-scrollbar flex flex-col gap-3 mt-2">
                      {selectedRow.transacciones?.slice(0, 10).map((tx: any) => (
                        <div key={tx.id} className="text-xs border-b border-white/10 pb-2 last:border-0 last:pb-0">
                          <p className="font-semibold text-white leading-tight mb-1">{tx.title}</p>
                          <div className="flex justify-between text-white/60">
                            <span>{tx.date}</span>
                            <span className="font-mono text-[#E05C50]">{tx.amount !== 'Por definir' ? `USD ${tx.amount}` : tx.amount}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </>
            ) : (
              <div className="flex-1 flex flex-col items-center justify-center text-center text-white/40 z-10">
                <Search className="h-12 w-12 mb-4 opacity-50" />
                <p className="text-sm">Selecciona una industria en la tabla para ver los detalles del mercado.</p>
              </div>
            )}
            </div>
          </div>
        ) : (
          <div className="hidden lg:flex w-12 shrink-0 flex-col gap-4 items-center animate-in slide-in-from-right-2">
            <button 
              onClick={() => setIsPanelExpanded(true)}
              className="bg-[#1C1F33] text-white rounded-xl p-3 shadow-lg hover:bg-[#252a42] transition-colors h-full flex items-center justify-center"
              title="Mostrar detalles"
            >
              <ChevronLeft className="h-5 w-5" />
            </button>
          </div>
        )}
      </div>

      {isRankingModalOpen && (
        <div className="fixed inset-0 z-50 flex justify-end bg-black/60 backdrop-blur-sm animate-in fade-in" onClick={() => setIsRankingModalOpen(false)}>
          <div className="w-full max-w-md bg-[#1C1F33] h-full shadow-2xl p-6 flex flex-col animate-in slide-in-from-right relative overflow-hidden" onClick={e => e.stopPropagation()}>
            <div className="absolute top-0 right-0 -mr-8 -mt-8 w-32 h-32 rounded-full bg-white/5 blur-2xl pointer-events-none"></div>

            <div className="flex justify-between items-center mb-6 shrink-0 relative z-10">
              <div className="flex items-center gap-2">
                <Briefcase className="h-6 w-6 text-[#E05C50]" />
                <h3 className="text-xl font-bold text-white">Ranking Global</h3>
              </div>
              <button onClick={() => setIsRankingModalOpen(false)} className="p-2 text-white/50 hover:bg-white/10 rounded-full transition-colors">
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="mb-4 relative z-10 shrink-0">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-white/40" />
                <input
                  type="text"
                  placeholder="Buscar industria..."
                  value={rankingSearchQuery}
                  onChange={e => setRankingSearchQuery(e.target.value)}
                  className="w-full bg-white/5 border border-white/10 rounded-lg pl-9 pr-4 py-2.5 text-sm text-white placeholder:text-white/40 focus:outline-none focus:ring-2 focus:ring-[#E05C50]/50 focus:border-transparent transition-all"
                />
              </div>
            </div>
            
            <div className="flex-1 overflow-y-auto pr-2 space-y-3 custom-scrollbar relative z-10">
              {filteredRankingList.map((ind) => {
                const i = topIndustriesList.findIndex(x => x.id === ind.id)
                return (
                  <Link 
                    href={`/dashboard/operations?search=${encodeURIComponent(ind.industria)}`}
                    key={ind.id} 
                    className="flex justify-between items-center bg-white/5 p-4 rounded-xl border border-white/10 hover:border-[#E05C50]/50 hover:bg-white/10 transition-all cursor-pointer group"
                  >
                    <div className="flex items-center gap-4 overflow-hidden">
                      <span className={`flex items-center justify-center shrink-0 h-8 w-8 rounded-full text-sm font-bold shadow-sm transition-colors ${i < 3 ? 'bg-[#E05C50] text-white border-none' : 'bg-[#252a42] text-white/70 border border-white/10 group-hover:bg-[#E05C50] group-hover:text-white'}`}>
                        {i + 1}
                      </span>
                      <span className="text-sm font-semibold text-white/90 group-hover:text-white transition-colors truncate">{ind.industria}</span>
                    </div>
                    <span className="shrink-0 text-xs font-bold bg-[#E05C50]/20 text-[#E05C50] px-3 py-1.5 rounded-md border border-[#E05C50]/20">
                      {ind.operaciones} ops
                    </span>
                  </Link>
                )
              })}
              {filteredRankingList.length === 0 && (
                <p className="text-sm text-white/40 mt-8 text-center">No se encontraron industrias con ese nombre.</p>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  )
}
