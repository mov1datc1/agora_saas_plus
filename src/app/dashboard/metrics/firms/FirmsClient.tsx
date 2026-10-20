'use client'

import { useState, useMemo, useEffect } from 'react'
import Link from 'next/link'
import { 
  Building2, 
  Users, 
  FileText, 
  ArrowUpDown, 
  ArrowUp, 
  ArrowDown, 
  X, 
  Globe, 
  Gavel, 
  Calendar, 
  Search, 
  Filter, 
  ChevronRight, 
  ChevronLeft, 
  Loader2, 
  Download, 
  Lock, 
  ExternalLink 
} from 'lucide-react'
import { checkTrialRestrictions, checkCanDownload } from '../../actions'
import PaywallModal from '@/components/ui/PaywallModal'
import EntityDetailModal from '@/components/ui/EntityDetailModal'
import SearchableSelect from '@/components/ui/SearchableSelect'
import ProDateRangePicker from '@/components/ui/ProDateRangePicker'
import { exportToExcel } from '@/lib/exportUtils'
import useSWR from 'swr'

const fetcher = (url: string) => fetch(url).then(res => res.json())

interface FirmTransaction {
  id: string
  title: string
  type: string
  monto: number | null
  montoString: string
  pais: string
  fecha: string | null
  industria: string
  empresa: string
  abogados: string
}

interface TableRow {
  id: string
  rankingPosition: number
  firma: string
  pais: string
  website: string | null
  numeroOperaciones: number
  operacionesPublicas: number
  operacionesConfidenciales: number
  montoAcumulado: number
  transacciones: FirmTransaction[]
}

// Debounce hook
function useDebounce<T>(value: T, delay: number): T {
  const [dv, setDv] = useState<T>(value)
  useEffect(() => { 
    const h = setTimeout(() => setDv(value), delay)
    return () => clearTimeout(h) 
  }, [value, delay])
  return dv
}

export default function FirmsClient() {
  const [isRankingModalOpen, setIsRankingModalOpen] = useState(false)
  const [filterType, setFilterType] = useState<string>('Todas')
  const [searchQuery, setSearchQuery] = useState('')
  const debouncedSearch = useDebounce(searchQuery, 400)
  
  // Default country: México as requested
  const [selectedCountry, setSelectedCountry] = useState('México')
  const [dateRange, setDateRange] = useState({ start: '', end: '' })
  
  // Sorting: Default by 'deals' (Número de Operaciones) desc
  const [sortBy, setSortBy] = useState<'deals' | 'value' | 'name'>('deals')
  const [sortOrder, setSortOrder] = useState<'desc' | 'asc'>('desc')
  
  const [selectedRow, setSelectedRow] = useState<TableRow | null>(null)
  const [selectedTxForModal, setSelectedTxForModal] = useState<FirmTransaction | null>(null)
  
  const [isPanelExpanded, setIsPanelExpanded] = useState(true)
  const [isDetailModalOpen, setIsDetailModalOpen] = useState(false)
  const [currentPage, setCurrentPage] = useState(1)
  const [rankingSearchQuery, setRankingSearchQuery] = useState('')
  const itemsPerPage = 50

  const [showPaywall, setShowPaywall] = useState(false)
  const [paywallTitle, setPaywallTitle] = useState('')
  const [paywallMessage, setPaywallMessage] = useState('')
  const [isDataAllowed, setIsDataAllowed] = useState(true)

  // Build server-side API URL
  const apiUrl = useMemo(() => {
    const p = new URLSearchParams()
    p.set('page', String(currentPage))
    p.set('limit', String(itemsPerPage))
    if (selectedCountry) p.set('country', selectedCountry)
    if (filterType !== 'Todas') p.set('type', filterType)
    if (debouncedSearch.trim()) p.set('search', debouncedSearch.trim())
    if (dateRange.start) p.set('dateStart', dateRange.start)
    if (dateRange.end) p.set('dateEnd', dateRange.end)
    p.set('sortBy', sortBy)
    p.set('sortOrder', sortOrder)
    return `/api/metrics/firms?${p.toString()}`
  }, [currentPage, selectedCountry, filterType, debouncedSearch, dateRange, sortBy, sortOrder])

  const { data: apiData, isLoading: isSwrLoading } = useSWR(apiUrl, fetcher, { keepPreviousData: true })
  const tableData: TableRow[] = apiData?.data || []
  const isLoading = isSwrLoading && !apiData
  const totalCount = apiData?.metadata?.totalCount || 0
  const totalPages = apiData?.metadata?.totalPages || 1
  const serverStats = apiData?.stats || {}
  const serverRanking = apiData?.ranking || []
  const serverCountries: string[] = apiData?.countries || []

  useEffect(() => {
    const checkLimits = async () => {
      const usageCheck = await checkTrialRestrictions()
      if (!usageCheck.allowed) {
        setIsDataAllowed(false)
        setPaywallTitle('Límite Diario Alcanzado')
        setPaywallMessage(usageCheck.message || 'Has llegado al máximo de consultas diarias.')
        setShowPaywall(true)
      }
    }
    checkLimits()
  }, [])

  // Reset page on filter changes
  useEffect(() => { 
    setCurrentPage(1) 
  }, [filterType, selectedCountry, debouncedSearch, dateRange])

  // Select first row when data loads
  useEffect(() => {
    if (tableData.length > 0 && (!selectedRow || !tableData.find(r => r.id === selectedRow.id))) {
      setSelectedRow(tableData[0])
    } else if (tableData.length === 0) {
      setSelectedRow(null)
    }
  }, [tableData, selectedRow])

  const handleSort = (column: 'deals' | 'value' | 'name') => {
    if (sortBy === column) {
      setSortOrder(prev => prev === 'desc' ? 'asc' : 'desc')
    } else {
      setSortBy(column)
      setSortOrder('desc')
    }
    setCurrentPage(1)
  }

  const handleDownloadExcel = async () => {
    const downloadCheck = await checkCanDownload()
    if (!downloadCheck.allowed) {
      setPaywallTitle('Descarga Bloqueada')
      setPaywallMessage(downloadCheck.message || 'Solo puedes descargar datos con una suscripción activa.')
      setShowPaywall(true)
      return
    }

    exportToExcel(tableData.map(row => ({
      'Clasificación': row.rankingPosition,
      'Firma': row.firma,
      'País': row.pais,
      'Número de Operaciones': row.numeroOperaciones,
      'Operaciones Públicas': row.operacionesPublicas,
      'Operaciones Confidenciales': row.operacionesConfidenciales,
      'Monto Acumulado (USD)': row.montoAcumulado > 0 ? row.montoAcumulado : 0
    })), `clasificacion_firmas_${selectedCountry.toLowerCase()}`)
  }

  const filterOptions = ['Todas', 'M&A', 'Financiamientos', 'Emisiones']

  const formatCurrency = (value: number | null | undefined) => {
    if (!value || value === 0) return 'Valor confidencial'
    if (value >= 1e9) return `$${(value / 1e9).toFixed(2)}B`
    if (value >= 1e6) return `$${(value / 1e6).toFixed(1)}M`
    return `$${value.toLocaleString()}`
  }

  const renderSortIndicator = (column: 'deals' | 'value' | 'name') => {
    if (sortBy !== column) {
      return <ArrowUpDown className="w-3.5 h-3.5 text-muted-foreground/40 ml-1.5 inline" />
    }
    return sortOrder === 'desc' 
      ? <ArrowDown className="w-3.5 h-3.5 text-brand ml-1.5 inline" />
      : <ArrowUp className="w-3.5 h-3.5 text-brand ml-1.5 inline" />
  }

  const totalFirms = serverStats.totalFirms || 0
  const totalVolume = serverStats.totalValue || 0
  const totalDeals = serverStats.totalDeals || 0
  const topFirmsList = serverRanking

  const filteredRankingList = useMemo(() => {
    if (!rankingSearchQuery) return topFirmsList
    return topFirmsList.filter((f: any) => f.firma.toLowerCase().includes(rankingSearchQuery.toLowerCase()))
  }, [topFirmsList, rankingSearchQuery])

  return (
    <>
      <PaywallModal 
        isOpen={showPaywall} 
        onClose={() => setShowPaywall(false)} 
        title={paywallTitle} 
        message={paywallMessage} 
      />

      {/* Modal de Detalle de Operación Individual */}
      {selectedTxForModal && (
        <EntityDetailModal 
          isOpen={isDetailModalOpen}
          onClose={() => { setIsDetailModalOpen(false); setSelectedTxForModal(null); }}
          title={selectedTxForModal.title}
          subtitle={`Operación asesorada por ${selectedRow?.firma || 'Firma'}`}
          amount={selectedTxForModal.montoString}
          iconType="firm"
          sections={[
            { label: 'Tipo de Operación', value: selectedTxForModal.type },
            { label: 'País Involucrado', value: selectedTxForModal.pais },
            { label: 'Empresas / Partes', value: selectedTxForModal.empresa },
            { label: 'Industria', value: selectedTxForModal.industria },
            { label: 'Abogados Involucrados', value: selectedTxForModal.abogados },
            { label: 'Fecha de Anuncio / Cierre', value: selectedTxForModal.fecha ? new Date(selectedTxForModal.fecha).toLocaleDateString('es-ES', { year: 'numeric', month: 'long', day: 'numeric' }) : 'No especificada' }
          ]}
        />
      )}

      {/* Header PRO */}
      <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-6 pb-2">
        <div>
          <h2 className="text-3xl font-bold tracking-tight text-foreground">Clasificación de Firmas</h2>
          <p className="mt-2 text-sm text-muted-foreground">
            Ranking analítico de firmas legales por volumen de transacciones y valor acumulado en dólares.
          </p>
        </div>
        
        <div className="flex items-center gap-3 w-full lg:w-auto">
          {/* Filtro de Fecha PRO */}
          <ProDateRangePicker 
            value={dateRange}
            onChange={setDateRange}
          />
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-surface rounded-2xl p-6 shadow-sm border border-border">
          <div className="flex items-center gap-3 text-muted-foreground mb-2">
            <FileText className="h-5 w-5" />
            <h3 className="text-sm font-semibold">Monto Acumulado (USD)</h3>
          </div>
          <p className="text-3xl font-bold text-foreground tracking-tight">
            {formatCurrency(totalVolume)}
          </p>
          <p className="text-xs text-muted-foreground mt-2">
            Transacciones públicas asesoradas por firmas de {selectedCountry}
          </p>
        </div>

        <div className="bg-surface rounded-2xl p-6 shadow-sm border border-border">
          <div className="flex items-center gap-3 text-muted-foreground mb-2">
            <Building2 className="h-5 w-5" />
            <h3 className="text-sm font-semibold">Operaciones Registradas</h3>
          </div>
          <p className="text-3xl font-bold text-foreground tracking-tight">
            {totalDeals.toLocaleString()}
          </p>
          <p className="text-xs text-muted-foreground mt-2">
            En el histórico de LexLatin para {selectedCountry}
          </p>
        </div>

        <div className="bg-surface rounded-2xl p-6 shadow-sm border border-border">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-3 text-muted-foreground">
              <Users className="h-5 w-5" />
              <h3 className="text-sm font-semibold">Firmas Clasificadas</h3>
            </div>
            {topFirmsList.length > 0 && (
              <button 
                onClick={() => setIsRankingModalOpen(true)}
                className="text-xs font-semibold text-brand hover:text-brand/80 transition-colors bg-brand/10 px-2 py-1 rounded"
              >
                Ver top 10
              </button>
            )}
          </div>
          <p className="text-3xl font-bold text-foreground tracking-tight">
            {totalFirms.toLocaleString()} <span className="text-sm font-normal text-muted-foreground">firmas</span>
          </p>
          <div className="mt-3 flex items-center gap-2 overflow-hidden text-xs text-muted-foreground truncate">
            {topFirmsList.slice(0, 2).map((f: any, i: number) => (
              <span key={i} className="inline-flex items-center gap-1 bg-muted px-2 py-0.5 rounded font-medium">
                #{i + 1} {f.firma}
              </span>
            ))}
          </div>
        </div>
      </div>

      {/* Main Content Area */}
      <div className="flex flex-col lg:flex-row gap-6 h-auto lg:h-[640px]">
        
        {/* Left: Table Container */}
        <div className="flex-1 bg-surface rounded-2xl shadow-sm border border-border flex flex-col overflow-hidden">
          
          {/* Toolbar: País PRO + Tipos + Buscador */}
          <div className="p-4 border-b border-border bg-muted/20 flex flex-col md:flex-row gap-4 justify-between items-start md:items-center">
            
            <div className="flex flex-wrap items-center gap-3 w-full md:w-auto">
              {/* Filtro de País con SearchableSelect integrado */}
              <div className="w-full sm:w-[220px]">
                <SearchableSelect 
                  value={selectedCountry}
                  onChange={(c) => { setSelectedCountry(c); setCurrentPage(1); }}
                  options={serverCountries.length > 0 ? serverCountries : ['México', 'Brasil', 'Chile', 'Colombia', 'Perú', 'Argentina']}
                  placeholder="Buscar país..."
                />
              </div>

              {/* Selector de Tipo de Operación */}
              <div className="flex items-center gap-1 bg-background p-1 rounded-xl border border-border">
                {filterOptions.map(option => (
                  <button
                    key={option}
                    onClick={() => setFilterType(option)}
                    className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-all ${
                      filterType === option 
                        ? 'bg-[#1C1F33] text-white shadow-sm' 
                        : 'text-muted-foreground hover:bg-muted hover:text-foreground'
                    }`}
                  >
                    {option}
                  </button>
                ))}
              </div>
            </div>

            <div className="relative w-full md:w-72 shrink-0 flex items-center gap-2">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <input 
                  type="text" 
                  placeholder={`Buscar firma en ${selectedCountry}...`} 
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  className="w-full pl-9 pr-4 py-2 text-sm bg-background border border-border rounded-xl focus:outline-none focus:ring-2 focus:ring-brand/20 focus:border-brand transition-all"
                />
              </div>
              <button
                onClick={handleDownloadExcel}
                title="Exportar Clasificación a Excel"
                className="p-2 border border-brand bg-brand/10 text-brand rounded-xl hover:bg-brand hover:text-white transition-colors shrink-0"
              >
                <Download className="w-4 h-4" />
              </button>
              <button 
                onClick={() => setIsPanelExpanded(!isPanelExpanded)}
                className="p-2 border border-border bg-background rounded-xl text-muted-foreground hover:bg-muted transition-colors lg:hidden shrink-0"
                title={isPanelExpanded ? "Ocultar panel" : "Mostrar panel"}
              >
                {isPanelExpanded ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
              </button>
            </div>
          </div>

          {/* Table */}
          <div className="flex-1 overflow-auto">
            <table className="w-full text-left border-collapse min-w-[620px]">
              <thead className="bg-muted/70 sticky top-0 z-10 backdrop-blur-sm border-b border-border">
                <tr>
                  <th className="px-4 py-3.5 text-center text-xs font-bold text-muted-foreground uppercase tracking-wider w-16">
                    #
                  </th>
                  <th 
                    onClick={() => handleSort('name')}
                    className="px-6 py-3.5 text-left text-xs font-bold text-muted-foreground uppercase tracking-wider cursor-pointer hover:text-foreground transition-colors select-none"
                  >
                    Firma {renderSortIndicator('name')}
                  </th>
                  <th 
                    onClick={() => handleSort('deals')}
                    className="px-6 py-3.5 text-left text-xs font-bold text-muted-foreground uppercase tracking-wider cursor-pointer hover:text-foreground transition-colors select-none"
                  >
                    Número de Operaciones {renderSortIndicator('deals')}
                  </th>
                  <th 
                    onClick={() => handleSort('value')}
                    className="px-6 py-3.5 text-right text-xs font-bold text-muted-foreground uppercase tracking-wider cursor-pointer hover:text-foreground transition-colors select-none"
                  >
                    Monto Acumulado (USD) {renderSortIndicator('value')}
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {isLoading ? (
                  <tr>
                    <td colSpan={4} className="px-6 py-16 text-center">
                      <div className="flex flex-col items-center justify-center text-muted-foreground">
                        <Loader2 className="h-8 w-8 animate-spin text-brand mb-2" />
                        <span className="text-sm font-medium">Cargando clasificación de {selectedCountry}...</span>
                      </div>
                    </td>
                  </tr>
                ) : !isDataAllowed ? (
                  <tr>
                    <td colSpan={4} className="px-6 py-16 text-center">
                      <div className="flex flex-col items-center justify-center text-muted-foreground bg-muted/20 rounded-xl p-8 max-w-sm mx-auto">
                        <Lock className="w-10 h-10 mb-3 text-muted-foreground/50" />
                        <span className="text-base font-semibold text-foreground mb-1">Datos Bloqueados</span>
                        <span className="text-sm">Has alcanzado el límite de consultas diarias en tu prueba.</span>
                      </div>
                    </td>
                  </tr>
                ) : (
                  <>
                    {tableData.map((row) => {
                      const isSelected = selectedRow?.id === row.id
                      return (
                        <tr 
                          key={row.id} 
                          onClick={() => setSelectedRow(row)}
                          className={`cursor-pointer transition-colors hover:bg-muted/50 ${isSelected ? 'bg-brand/5 border-l-4 border-l-brand' : 'border-l-4 border-l-transparent'}`}
                        >
                          {/* Numeración limpia sin emojis */}
                          <td className="px-4 py-4 text-center">
                            <span className="font-mono text-sm font-semibold text-muted-foreground">
                              {row.rankingPosition}
                            </span>
                          </td>

                          {/* Firma */}
                          <td className="px-6 py-4">
                            <div className="flex items-center gap-3">
                              <div className={`h-8 w-8 rounded-lg flex items-center justify-center shrink-0 transition-colors ${isSelected ? 'bg-brand text-white' : 'bg-muted text-muted-foreground'}`}>
                                <Building2 className="h-4 w-4" />
                              </div>
                              <div>
                                <span className={`text-sm font-semibold block ${isSelected ? 'text-brand' : 'text-foreground'}`}>
                                  {row.firma}
                                </span>
                                <span className="text-[11px] text-muted-foreground">
                                  {row.pais}
                                </span>
                              </div>
                            </div>
                          </td>

                          {/* Número de Operaciones */}
                          <td className="px-6 py-4">
                            <div className="flex flex-col">
                              <span className="text-sm font-bold text-foreground">
                                {row.numeroOperaciones} ops
                              </span>
                              <span className="text-[11px] text-muted-foreground">
                                {row.operacionesPublicas} públicas · {row.operacionesConfidenciales} confidenciales
                              </span>
                            </div>
                          </td>

                          {/* Monto Acumulado en USD */}
                          <td className="px-6 py-4 text-right">
                            {row.montoAcumulado > 0 ? (
                              <div className="flex flex-col items-end">
                                <span className="text-sm font-bold text-foreground">
                                  {formatCurrency(row.montoAcumulado)}
                                </span>
                                <span className="text-[11px] font-mono text-muted-foreground">
                                  ${row.montoAcumulado.toLocaleString()} USD
                                </span>
                              </div>
                            ) : (
                              <span className="text-xs font-medium text-muted-foreground italic">
                                Montos confidenciales
                              </span>
                            )}
                          </td>
                        </tr>
                      )
                    })}

                    {tableData.length === 0 && (
                      <tr>
                        <td colSpan={4} className="px-6 py-16 text-center text-muted-foreground text-sm">
                          No se encontraron firmas activas en {selectedCountry} para los filtros seleccionados.
                        </td>
                      </tr>
                    )}
                  </>
                )}
              </tbody>
            </table>
          </div>
          
          {/* Pagination Controls */}
          {totalCount > 0 && (
            <div className="p-4 border-t border-border bg-surface flex items-center justify-between">
              <span className="text-sm text-muted-foreground">
                Mostrando {((currentPage - 1) * itemsPerPage) + 1} - {Math.min(currentPage * itemsPerPage, totalCount)} de {totalCount.toLocaleString()} firmas
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

        {/* Right: Dynamic Details Panel for Selected Firm */}
        {isPanelExpanded ? (
          <div className="w-full lg:w-[350px] shrink-0 flex flex-col gap-4 relative animate-in slide-in-from-right-4 duration-300">
            <div className="bg-[#1C1F33] text-white rounded-2xl p-5 shadow-lg relative overflow-hidden h-full flex flex-col">
              
              {/* Toggle Button Inside Panel (Desktop) */}
              <button 
                onClick={() => setIsPanelExpanded(false)}
                className="hidden lg:flex absolute top-4 right-4 z-20 h-8 w-8 items-center justify-center rounded-full bg-white/10 hover:bg-white/20 transition-colors text-white/70 hover:text-white"
                title="Ocultar detalles"
              >
                <ChevronRight className="h-4 w-4" />
              </button>

              {/* Background decoration */}
              <div className="absolute top-0 right-0 -mr-8 -mt-8 w-32 h-32 rounded-full bg-white/5 blur-2xl pointer-events-none"></div>
            
              {selectedRow ? (
                <>
                  <div className="mb-5 z-10 pr-6">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-xs uppercase tracking-widest text-brand font-bold">
                        Posición #{selectedRow.rankingPosition}
                      </span>
                      <span className="text-white/40">•</span>
                      <span className="text-xs text-white/70 font-medium">
                        {selectedRow.pais}
                      </span>
                    </div>
                    <h3 className="text-xl font-bold leading-tight">{selectedRow.firma}</h3>
                  </div>

                  {/* Quick Metric Badges */}
                  <div className="grid grid-cols-2 gap-2 mb-4 z-10">
                    <div className="bg-white/5 rounded-xl p-3 border border-white/10">
                      <span className="text-[11px] text-white/60 block">Operaciones</span>
                      <span className="text-lg font-bold text-white">{selectedRow.numeroOperaciones}</span>
                    </div>
                    <div className="bg-white/5 rounded-xl p-3 border border-white/10">
                      <span className="text-[11px] text-white/60 block">Monto Público</span>
                      <span className="text-lg font-bold text-white truncate block">
                        {selectedRow.montoAcumulado > 0 ? formatCurrency(selectedRow.montoAcumulado) : 'Confidencial'}
                      </span>
                    </div>
                  </div>

                  <div className="mb-2 z-10 flex items-center justify-between">
                    <h4 className="text-xs uppercase tracking-wider text-white/60 font-semibold">
                      Operaciones Asesoradas ({selectedRow.transacciones?.length || 0})
                    </h4>
                  </div>

                  {/* Scrollable List of Transactions */}
                  <div className="space-y-2.5 flex-1 overflow-y-auto z-10 custom-scrollbar pr-1">
                    {selectedRow.transacciones?.map((tx) => (
                      <div 
                        key={tx.id} 
                        className="bg-white/5 rounded-xl p-3 border border-white/10 hover:border-brand/40 transition-all flex flex-col gap-2"
                      >
                        <div className="flex justify-between items-start gap-2">
                          <p className="text-xs font-semibold text-white/95 line-clamp-2 leading-snug">
                            {tx.title}
                          </p>
                          <span className="px-1.5 py-0.5 bg-brand text-white text-[10px] font-bold rounded shrink-0">
                            {tx.type}
                          </span>
                        </div>
                        
                        <div className="flex items-center justify-between text-[11px] text-white/60 pt-1 border-t border-white/5">
                          <span className="font-semibold text-white/80">
                            {tx.montoString}
                          </span>
                          <button
                            onClick={() => {
                              setSelectedTxForModal(tx)
                              setIsDetailModalOpen(true)
                            }}
                            className="inline-flex items-center gap-1 text-[11px] text-brand hover:text-white transition-colors"
                          >
                            <ExternalLink className="w-3 h-3" /> Ver detalle
                          </button>
                        </div>
                      </div>
                    ))}

                    {(!selectedRow.transacciones || selectedRow.transacciones.length === 0) && (
                      <p className="text-xs text-white/40 italic py-4 text-center">
                        No hay detalle de transacciones para los filtros actuales.
                      </p>
                    )}
                  </div>
                </>
              ) : (
                <div className="flex-1 flex flex-col items-center justify-center text-center text-white/40 z-10">
                  <Search className="h-12 w-12 mb-4 opacity-50" />
                  <p className="text-sm">Selecciona una firma de la tabla para ver su desglose de operaciones.</p>
                </div>
              )}
            </div>
          </div>
        ) : (
          <div className="hidden lg:flex w-12 shrink-0 flex-col gap-4 items-center animate-in slide-in-from-right-2">
            <button 
              onClick={() => setIsPanelExpanded(true)}
              className="bg-[#1C1F33] text-white rounded-xl p-3 shadow-lg hover:bg-[#252a42] transition-colors h-full flex items-center justify-center"
              title="Mostrar detalles de firma"
            >
              <ChevronLeft className="h-5 w-5" />
            </button>
          </div>
        )}
      </div>

      {/* Modal Top 10 Rápido */}
      {isRankingModalOpen && (
        <div 
          className="fixed inset-0 z-50 flex justify-end bg-black/60 backdrop-blur-sm animate-in fade-in" 
          onClick={() => setIsRankingModalOpen(false)}
        >
          <div 
            className="w-full max-w-md bg-[#1C1F33] h-full shadow-2xl p-6 flex flex-col animate-in slide-in-from-right relative overflow-hidden" 
            onClick={e => e.stopPropagation()}
          >
            <div className="flex justify-between items-center mb-6 shrink-0 relative z-10">
              <div className="flex items-center gap-2">
                <Users className="h-6 w-6 text-brand" />
                <h3 className="text-xl font-bold text-white">Top Firmas ({selectedCountry})</h3>
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
                  placeholder="Buscar firma..."
                  value={rankingSearchQuery}
                  onChange={e => setRankingSearchQuery(e.target.value)}
                  className="w-full bg-white/5 border border-white/10 rounded-lg pl-9 pr-4 py-2.5 text-sm text-white placeholder:text-white/40 focus:outline-none focus:ring-2 focus:ring-brand/50 focus:border-transparent transition-all"
                />
              </div>
            </div>
            
            <div className="flex-1 overflow-y-auto pr-2 space-y-3 custom-scrollbar relative z-10">
              {filteredRankingList.map((firm: any, i: number) => (
                <div 
                  key={firm.id || i}
                  onClick={() => {
                    setSelectedRow(firm)
                    setIsRankingModalOpen(false)
                  }}
                  className="flex justify-between items-center bg-white/5 p-4 rounded-xl border border-white/10 hover:border-brand/50 hover:bg-white/10 transition-all cursor-pointer group"
                >
                  <div className="flex items-center gap-4 overflow-hidden">
                    <span className="flex items-center justify-center shrink-0 h-8 w-8 rounded-full text-sm font-bold bg-[#252a42] text-white/80 border border-white/10 group-hover:bg-brand group-hover:text-white transition-colors">
                      {i + 1}
                    </span>
                    <span className="text-sm font-semibold text-white/90 group-hover:text-white transition-colors truncate">
                      {firm.firma}
                    </span>
                  </div>
                  <div className="text-right shrink-0">
                    <span className="text-xs font-bold text-brand block">
                      {firm.numeroOperaciones} ops
                    </span>
                    <span className="text-[10px] text-white/60">
                      {firm.montoAcumulado > 0 ? formatCurrency(firm.montoAcumulado) : 'Confidencial'}
                    </span>
                  </div>
                </div>
              ))}
              {filteredRankingList.length === 0 && (
                <p className="text-sm text-white/40 mt-8 text-center">No se encontraron firmas para este criterio.</p>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  )
}
