'use client'

import { useState, useEffect, useMemo, useCallback } from 'react'
import { useSearchParams } from 'next/navigation'
import { Filter, Building2, Briefcase, ChevronRight, X, ArrowUpRight, ArrowUpDown, ArrowUp, ArrowDown, Download, FileText, Lock, Loader2, RotateCcw, Bookmark, Trash2, Plus, Save } from 'lucide-react'
import { checkTrialRestrictions, checkCanDownload } from '../actions'
import PaywallModal from '@/components/ui/PaywallModal'
import AlertModal from '@/components/ui/AlertModal'
import { exportToExcel, exportToPDF } from '@/lib/exportUtils'

import useSWR from 'swr'
import SearchableSelect from '@/components/ui/SearchableSelect'
import ProDateRangePicker from '@/components/ui/ProDateRangePicker'

// Debounce hook for search input
function useDebounce<T>(value: T, delay: number): T {
  const [debouncedValue, setDebouncedValue] = useState<T>(value)
  useEffect(() => {
    const handler = setTimeout(() => setDebouncedValue(value), delay)
    return () => clearTimeout(handler)
  }, [value, delay])
  return debouncedValue
}

export type UITransaction = {
  id: string
  date: string
  title: string
  type: string
  amount: string
  amountRaw: number
  status: string
  industry: string
  country: string
  firm: string
  lawyer: string
  company: string
  link: string
}

const fetcher = (url: string) => fetch(url).then(res => res.json())

export default function OperationsClient() {
  // Filter options from server (cached)
  const { data: filterOptions } = useSWR('/api/operations/filters', fetcher)
  const [selectedTx, setSelectedTx] = useState<UITransaction | null>(null)
  const [isExporting, setIsExporting] = useState(false)
  const [txDetails, setTxDetails] = useState<any>(null)
  const [isLoadingDetails, setIsLoadingDetails] = useState(false)

  const [showPaywall, setShowPaywall] = useState(false)
  const [paywallTitle, setPaywallTitle] = useState('')
  const [paywallMessage, setPaywallMessage] = useState('')

  const [alertConfig, setAlertConfig] = useState({ isOpen: false, title: '', message: '' })
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

  const handleSelectTx = async (tx: UITransaction) => {
    if (!isDataAllowed) {
      setShowPaywall(true)
      return
    }

    setSelectedTx(tx)
    setIsLoadingDetails(true)
    setTxDetails(null)
    
    try {
      const res = await fetch(`/api/transactions/${tx.id}`)
      if (res.ok) {
        const data = await res.json()
        setTxDetails(data.transaction)
      }
    } catch (e) {
      console.error(e)
    } finally {
      setIsLoadingDetails(false)
    }
  }
  
  // Estados para los filtros
  const searchParams = useSearchParams()
  const initialSearch = searchParams.get('search') || ''
  
  const [selectedType, setSelectedType] = useState('Todos')
  const [selectedIndustry, setSelectedIndustry] = useState('Todas')
  const [searchQuery, setSearchQuery] = useState(initialSearch)
  const debouncedSearch = useDebounce(searchQuery, 400)
  
  // Nuevos filtros PRO
  const [dateRange, setDateRange] = useState({ start: '', end: '' })
  const [selectedValueRange, setSelectedValueRange] = useState('Todos')
  const [selectedFirm, setSelectedFirm] = useState('Todas')
  const [selectedCountry, setSelectedCountry] = useState('Todos')
  const [selectedLawyer, setSelectedLawyer] = useState('Todos')
  
  // Sidebar expandible
  const [isSidebarOpen, setIsSidebarOpen] = useState(true)

  // Favoritas y Reset
  type SavedSearch = {
    id: string
    name: string
    filters: {
      selectedType: string
      selectedIndustry: string
      searchQuery: string
      dateRange: { start: string, end: string }
      selectedValueRange: string
      selectedFirm: string
      selectedCountry: string
      selectedLawyer: string
    }
  }

  const [savedSearches, setSavedSearches] = useState<SavedSearch[]>([])
  const [showSavedDropdown, setShowSavedDropdown] = useState(false)
  const [newSearchName, setNewSearchName] = useState('')
  const [isSavingSearch, setIsSavingSearch] = useState(false)

  // Cargar búsquedas guardadas al montar
  useEffect(() => {
    const saved = localStorage.getItem('agora_saved_searches')
    if (saved) {
      try {
        setSavedSearches(JSON.parse(saved))
      } catch(e) {}
    }
  }, [])

  const saveCurrentSearch = () => {
    if (!newSearchName.trim()) return
    const newSearch: SavedSearch = {
      id: Date.now().toString(),
      name: newSearchName.trim(),
      filters: {
        selectedType, selectedIndustry, searchQuery, dateRange, selectedValueRange, selectedFirm, selectedCountry, selectedLawyer
      }
    }
    const updated = [...savedSearches, newSearch]
    setSavedSearches(updated)
    localStorage.setItem('agora_saved_searches', JSON.stringify(updated))
    setNewSearchName('')
    setIsSavingSearch(false)
  }

  const loadSearch = (search: SavedSearch) => {
    setSelectedType(search.filters.selectedType)
    setSelectedIndustry(search.filters.selectedIndustry)
    setSearchQuery(search.filters.searchQuery)
    setDateRange(search.filters.dateRange)
    setSelectedValueRange(search.filters.selectedValueRange)
    setSelectedFirm(search.filters.selectedFirm)
    setSelectedCountry(search.filters.selectedCountry)
    setSelectedLawyer(search.filters.selectedLawyer)
    setShowSavedDropdown(false)
  }

  const deleteSearch = (id: string, e: React.MouseEvent) => {
    e.stopPropagation()
    const updated = savedSearches.filter(s => s.id !== id)
    setSavedSearches(updated)
    localStorage.setItem('agora_saved_searches', JSON.stringify(updated))
  }

  const resetFilters = () => {
    setSelectedType('Todos')
    setSelectedIndustry('Todas')
    setSearchQuery('')
    setDateRange({ start: '', end: '' })
    setSelectedValueRange('Todos')
    setSelectedFirm('Todas')
    setSelectedCountry('Todos')
    setSelectedLawyer('Todos')
  }

  // Paginación
  const [page, setPage] = useState(1)
  const ITEMS_PER_PAGE = 50

  // Resetea a la página 1 cuando cambian los filtros
  useEffect(() => {
    setPage(1)
  }, [selectedType, selectedIndustry, debouncedSearch, dateRange, selectedValueRange, selectedFirm, selectedCountry, selectedLawyer])

  // Actualizar search query si cambia la URL
  useEffect(() => {
    const q = searchParams.get('search')
    if (q !== null) {
      setSearchQuery(q)
      setPage(1)
    }
  }, [searchParams])
  const [sortConfig, setSortConfig] = useState<{ key: 'date' | 'amount' | null, direction: 'asc' | 'desc' }>({ key: 'date', direction: 'desc' })

  // Build server-side API URL with all filters
  const apiUrl = useMemo(() => {
    const params = new URLSearchParams()
    params.set('page', String(page))
    params.set('limit', String(ITEMS_PER_PAGE))
    if (sortConfig.key) {
      params.set('sortBy', sortConfig.key)
      params.set('sortDir', sortConfig.direction)
    }
    if (selectedType !== 'Todos') params.set('type', selectedType)
    if (selectedIndustry !== 'Todas') params.set('industry', selectedIndustry)
    if (selectedCountry !== 'Todos') params.set('country', selectedCountry)
    if (selectedFirm !== 'Todas') params.set('firm', selectedFirm)
    if (selectedLawyer !== 'Todos') params.set('lawyer', selectedLawyer)
    if (debouncedSearch.trim()) params.set('search', debouncedSearch.trim())
    if (dateRange.start) params.set('dateStart', dateRange.start)
    if (dateRange.end) params.set('dateEnd', dateRange.end)
    if (selectedValueRange !== 'Todos') params.set('valueRange', selectedValueRange)
    return `/api/operations?${params.toString()}`
  }, [page, ITEMS_PER_PAGE, sortConfig, selectedType, selectedIndustry, selectedCountry, selectedFirm, selectedLawyer, debouncedSearch, dateRange, selectedValueRange])

  // Server-side data fetch
  const { data: apiResponse, error, isLoading: isSwrLoading } = useSWR(apiUrl, fetcher, { keepPreviousData: true })
  const transactions: UITransaction[] = apiResponse?.data || []
  const totalCount = apiResponse?.metadata?.totalCount || 0
  const totalPages = apiResponse?.metadata?.totalPages || 1
  const serverStats = apiResponse?.stats || {}

  const uniqueTypes = ['M&A', 'Emisiones', 'Financiamientos']
  const uniqueIndustries: string[] = filterOptions?.industries || []
  const uniqueFirms: string[] = filterOptions?.firms || []
  const uniqueCountries: string[] = filterOptions?.countries || []
  const uniqueLawyers: string[] = []

  const valueRangeOptions = [
    'Todos',
    'Menos de $10M',
    '$10M - $50M',
    '$50M - $100M',
    '$100M - $500M',
    'Más de $500M'
  ]

  // Server-side: transactions are already filtered, sorted, and paginated
  const filteredTransactions = transactions
  const sortedTransactions = transactions

  const handleDownloadExcel = async () => {
    const downloadCheck = await checkCanDownload()
    if (!downloadCheck.allowed) {
      setPaywallTitle('Descarga Bloqueada')
      setPaywallMessage(downloadCheck.message || 'Solo puedes descargar datos con una suscripción activa.')
      setShowPaywall(true)
      return
    }

    exportToExcel(sortedTransactions.map(tx => ({
      Fecha: tx.date,
      Título: tx.title,
      Tipo: tx.type,
      Monto: tx.amount,
      Industria: tx.industry,
      Países: tx.country,
      Firmas: tx.firm,
      Abogados: tx.lawyer
    })), 'operaciones_agora_plus')
  }

  const handleDownloadPDF = async () => {
    try {
      setIsExporting(true)
      const downloadCheck = await checkCanDownload()
      if (!downloadCheck.allowed) {
        setPaywallTitle('Descarga Bloqueada')
        setPaywallMessage(downloadCheck.message || 'Solo puedes descargar documentos con una suscripción activa.')
        setShowPaywall(true)
        setIsExporting(false)
        return
      }
      
      const { exportNativePDF } = await import('@/lib/exportUtils')
      await exportNativePDF(selectedTx, txDetails, `transaccion_${selectedTx?.id}`)
    } catch (error: any) {
      console.error('Error exporting to PDF:', error)
      setAlertConfig({
        isOpen: true,
        title: 'Error al Exportar',
        message: `No pudimos generar el archivo PDF en este momento. Intenta de nuevo. Detalles técnicos: ${error.message || 'Error desconocido'}`
      })
    } finally {
      setIsExporting(false)
    }
  }

  const handleSort = (key: 'date' | 'amount') => {
    setSortConfig(current => ({
      key,
      direction: current.key === key && current.direction === 'desc' ? 'asc' : 'desc'
    }))
  }

  // Stats from server (no client computation needed)
  const searchStats = useMemo(() => {
    const tv = serverStats.totalValue ? Number(serverStats.totalValue) : 0
    const at = serverStats.avgTicket ? Number(serverStats.avgTicket) : 0
    return {
      totalValue: tv,
      avgTicket: at,
    }
  }, [serverStats])

  const formatCurrencyStats = (val: number) => {
    if (val === 0) return 'N/D'
    if (val >= 1e9) return `$${(val / 1e9).toFixed(2)}B`
    if (val >= 1e6) return `$${(val / 1e6).toFixed(1)}M`
    if (val >= 1e3) return `$${(val / 1e3).toFixed(0)}K`
    return `$${val.toFixed(0)}`
  }

  return (
    <>
      <PaywallModal 
        isOpen={showPaywall} 
        onClose={() => setShowPaywall(false)} 
        title={paywallTitle} 
        message={paywallMessage} 
      />

      <AlertModal
        isOpen={alertConfig.isOpen}
        onClose={() => setAlertConfig(prev => ({ ...prev, isOpen: false }))}
        title={alertConfig.title}
        message={alertConfig.message}
      />

      <div className="flex flex-col gap-4 mb-6 bg-surface rounded-2xl p-6 shadow-sm border border-border">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-2">
          <div className="flex items-center gap-2 text-foreground font-semibold">
            <Filter className="h-5 w-5" /> Filtros Avanzados
          </div>
          
          <div className="flex items-center gap-2 relative">
            <button 
              onClick={() => setShowSavedDropdown(!showSavedDropdown)}
              className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium bg-brand/5 text-brand border border-brand/20 rounded-lg hover:bg-brand/10 transition-colors"
            >
              <Bookmark className="h-4 w-4" /> 
              Mis Favoritas ({savedSearches.length})
            </button>
            <button 
              onClick={resetFilters}
              className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium bg-muted text-muted-foreground border border-border rounded-lg hover:bg-muted-foreground/10 hover:text-foreground transition-colors"
            >
              <RotateCcw className="h-4 w-4" />
              Limpiar
            </button>

            {/* Dropdown Mis Favoritas */}
            {showSavedDropdown && (
              <>
                <div className="fixed inset-0 z-40" onClick={() => setShowSavedDropdown(false)}></div>
                <div className="absolute top-full right-0 mt-2 w-72 bg-surface rounded-xl shadow-xl border border-border overflow-hidden z-50 animate-in fade-in slide-in-from-top-2">
                  <div className="max-h-64 overflow-y-auto">
                    {savedSearches.length === 0 ? (
                      <p className="px-4 py-6 text-sm text-center text-muted-foreground">Aún no tienes búsquedas guardadas.</p>
                    ) : (
                      <div className="py-2">
                        {savedSearches.map(search => (
                          <div 
                            key={search.id}
                            onClick={() => loadSearch(search)}
                            className="flex items-center justify-between px-4 py-2 hover:bg-muted cursor-pointer transition-colors group"
                          >
                            <span className="text-sm font-medium text-foreground truncate">{search.name}</span>
                            <button 
                              onClick={(e) => deleteSearch(search.id, e)}
                              className="text-muted-foreground opacity-0 group-hover:opacity-100 hover:text-red-500 transition-all p-1"
                              title="Eliminar Búsqueda"
                            >
                              <Trash2 className="h-4 w-4" />
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                  
                  <div className="border-t border-border bg-muted/30 p-3">
                    {!isSavingSearch ? (
                      <button 
                        onClick={() => setIsSavingSearch(true)}
                        className="flex w-full items-center justify-center gap-2 px-3 py-2 text-sm font-semibold text-brand bg-brand/10 hover:bg-brand/20 rounded-lg transition-colors"
                      >
                        <Plus className="h-4 w-4" /> Guardar Vista Actual
                      </button>
                    ) : (
                      <div className="flex items-center gap-2">
                        <input 
                          type="text" 
                          autoFocus
                          placeholder="Nombre (ej: M&A Chile)"
                          className="flex-1 rounded-md border border-border bg-background text-sm p-2 outline-none focus:border-brand transition-colors"
                          value={newSearchName}
                          onChange={e => setNewSearchName(e.target.value)}
                          onKeyDown={e => e.key === 'Enter' && saveCurrentSearch()}
                        />
                        <button 
                          onClick={saveCurrentSearch}
                          disabled={!newSearchName.trim()}
                          className="p-2 bg-brand text-white rounded-md hover:bg-brand/90 disabled:opacity-50 transition-colors"
                        >
                          <Save className="h-4 w-4" />
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
        
        {/* Fila 1: Países, Fecha, Valor, Firma */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
          <SearchableSelect
            label="Países"
            value={selectedCountry}
            onChange={setSelectedCountry}
            options={['Todos', ...uniqueCountries]}
          />
          <div className="flex flex-col lg:col-span-2">
            <label className="block text-xs font-medium text-foreground/70 mb-1">Rango de Fecha</label>
            <ProDateRangePicker 
              value={dateRange}
              onChange={setDateRange}
            />
          </div>
          <SearchableSelect
            label="Valor Económico (USD)"
            value={selectedValueRange}
            onChange={setSelectedValueRange}
            options={valueRangeOptions}
          />
          <SearchableSelect
            label="Firma de Abogados"
            value={selectedFirm}
            onChange={setSelectedFirm}
            options={['Todas', ...uniqueFirms]}
          />
        </div>

        {/* Fila 2: Industria, Abogados, Tipo, Buscar */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mt-2 pt-4 border-t border-border/50">
          <SearchableSelect
            label="Industria"
            value={selectedIndustry}
            onChange={setSelectedIndustry}
            options={['Todas', ...uniqueIndustries]}
          />
          <SearchableSelect
            label="Abogados"
            value={selectedLawyer}
            onChange={setSelectedLawyer}
            options={['Todos', ...uniqueLawyers]}
          />
          <SearchableSelect
            label="Tipo de Operación"
            value={selectedType}
            onChange={setSelectedType}
            options={['Todos', ...uniqueTypes]}
          />
          <div className="flex flex-col">
            <label className="block text-xs font-medium text-foreground/70 mb-1">Buscar Término</label>
            <input 
              type="text" 
              placeholder="Empresa, título o abogado..." 
              className="w-full rounded-lg border border-border bg-background text-sm p-2 outline-none focus:border-[#EB3159] transition-colors"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
        </div>
      </div>
      
      <div className="flex justify-end mb-4">
        <button 
          onClick={() => setIsSidebarOpen(!isSidebarOpen)}
          className="flex items-center gap-2 px-4 py-2 text-sm font-medium bg-surface border border-border rounded-lg shadow-sm hover:bg-muted transition-colors"
        >
          {isSidebarOpen ? (
            <>
              <span className="hidden sm:inline">Ocultar Resumen</span>
              <span className="text-[#E05C50]">→|</span>
            </>
          ) : (
            <>
              <span className="text-[#E05C50]">|←</span>
              <span className="hidden sm:inline">Mostrar Resumen</span>
            </>
          )}
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6 flex-1">
        <div className={`${isSidebarOpen ? 'lg:col-span-3' : 'lg:col-span-4'} bg-surface rounded-2xl shadow-sm border border-border overflow-hidden flex flex-col h-[600px] transition-all duration-300`}>
          <div className="overflow-x-auto overflow-y-auto flex-1 custom-scrollbar">
            <table className="min-w-full divide-y divide-border">
              <thead className="bg-muted sticky top-0 z-10">
              <tr>
                <th className="px-6 py-4 text-left text-xs font-semibold text-foreground/70 uppercase tracking-wider cursor-pointer hover:bg-muted-foreground/10 transition-colors" onClick={() => handleSort('date')}>
                  <div className="flex items-center gap-1">
                    Fecha
                    {sortConfig.key === 'date' ? (sortConfig.direction === 'asc' ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />) : <ArrowUpDown className="h-3 w-3 text-muted-foreground/50" />}
                  </div>
                </th>
                <th className="px-6 py-4 text-left text-xs font-semibold text-foreground/70 uppercase tracking-wider">Título</th>
                <th className="px-6 py-4 text-left text-xs font-semibold text-foreground/70 uppercase tracking-wider">Firma(s)</th>
                <th className="px-6 py-4 text-left text-xs font-semibold text-foreground/70 uppercase tracking-wider">País(es)</th>
                <th className="px-6 py-4 text-left text-xs font-semibold text-foreground/70 uppercase tracking-wider">Abogado(s)</th>
                <th className="px-6 py-4 text-left text-xs font-semibold text-foreground/70 uppercase tracking-wider">Tipo</th>
                <th className="px-6 py-4 text-right text-xs font-semibold text-foreground/70 uppercase tracking-wider cursor-pointer hover:bg-muted-foreground/10 transition-colors" title="Valores expresados en Dólares Estadounidenses (USD)" onClick={() => handleSort('amount')}>
                  <div className="flex items-center justify-end gap-1">
                    {sortConfig.key === 'amount' ? (sortConfig.direction === 'asc' ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />) : <ArrowUpDown className="h-3 w-3 text-muted-foreground/50" />}
                    Monto (USD)
                  </div>
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border bg-surface">
              {isSwrLoading ? (
                <tr>
                  <td colSpan={8} className="px-6 py-12 text-center text-muted-foreground">
                    <div className="flex flex-col items-center justify-center">
                      <Loader2 className="h-8 w-8 animate-spin text-brand mb-4" />
                      <span className="text-sm font-medium">Sincronizando operaciones desde el servidor...</span>
                    </div>
                  </td>
                </tr>
              ) : error ? (
                <tr>
                  <td colSpan={8} className="px-6 py-12 text-center text-red-500">
                    <span className="text-sm font-medium">Error al cargar las operaciones. Por favor intenta de nuevo.</span>
                  </td>
                </tr>
              ) : !isDataAllowed ? (
                <tr><td colSpan={8} className="text-center p-12 text-muted-foreground bg-muted/20">
                  <Lock className="w-12 h-12 mx-auto mb-4 text-muted-foreground/50" />
                  <p className="font-semibold text-lg text-foreground mb-2">Datos Bloqueados</p>
                  <p>Has alcanzado el límite de visualizaciones. Suscríbete para continuar.</p>
                </td></tr>
              ) : (
                sortedTransactions.map((tx) => (
                <tr key={tx.id} className="hover:bg-muted/50 transition-colors cursor-pointer" onClick={() => handleSelectTx(tx)}>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-foreground/80">{tx.date}</td>
                  <td className="px-6 py-4 text-sm font-medium text-foreground max-w-[200px] truncate" title={tx.title}>{tx.title}</td>
                  <td className="px-6 py-4 text-sm text-foreground/80 max-w-[150px] truncate" title={tx.firm}>{tx.firm || 'N/D'}</td>
                  <td className="px-6 py-4 text-sm text-foreground/80 max-w-[100px] truncate" title={tx.country}>{tx.country || 'N/D'}</td>
                  <td className="px-6 py-4 text-sm text-foreground/80 max-w-[150px] truncate" title={tx.lawyer}>{tx.lawyer || 'N/D'}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-foreground/80">
                    <span className="inline-flex items-center rounded-md bg-brand/10 px-2 py-1 text-xs font-medium text-brand ring-1 ring-inset ring-brand/20">
                      {tx.type}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-right text-sm text-foreground/80 font-medium" title="Dólares Estadounidenses (USD)">{(tx.amount === 'Por definir' || tx.amount === 'Valor confidencial') ? <span className="text-muted-foreground font-normal">Valor confidencial</span> : tx.amount}</td>
                </tr>
              )))}
              {isDataAllowed && sortedTransactions.length === 0 && !isSwrLoading && (
                <tr><td colSpan={8} className="text-center p-8 text-muted-foreground">No hay operaciones que coincidan con los filtros.</td></tr>
              )}
            </tbody>
          </table>
          </div>
          
          {/* Controles de Paginación */}
          {!isSwrLoading && !error && isDataAllowed && totalCount > 0 && (
            <div className="flex items-center justify-between border-t border-border px-6 py-4 bg-surface sticky bottom-0">
              <span className="text-sm text-muted-foreground">
                Mostrando {(page - 1) * ITEMS_PER_PAGE + 1} a {Math.min(page * ITEMS_PER_PAGE, totalCount)} de {totalCount.toLocaleString()} operaciones
              </span>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setPage(p => Math.max(1, p - 1))}
                  disabled={page === 1}
                  className="px-3 py-1.5 text-sm font-medium border border-border rounded-md hover:bg-muted disabled:opacity-50 transition-colors"
                >
                  Anterior
                </button>
                <span className="text-sm font-medium text-foreground px-2">
                  Página {page} de {totalPages}
                </span>
                <button
                  onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                  disabled={page >= totalPages}
                  className="px-3 py-1.5 text-sm font-medium border border-border rounded-md hover:bg-muted disabled:opacity-50 transition-colors"
                >
                  Siguiente
                </button>
              </div>
            </div>
          )}
        </div>


        {isSidebarOpen && (
          <div className="lg:col-span-1 space-y-6 animate-in fade-in slide-in-from-right-4 duration-300">
            <div className="bg-surface rounded-2xl p-6 shadow-sm border border-border sticky top-0 flex flex-col gap-6">
              <div>
                <h3 className="text-sm font-semibold text-foreground mb-4">Resumen de Búsqueda</h3>
                <p className="text-4xl font-bold text-[#E05C50] tracking-tight mb-2">{totalCount.toLocaleString()}</p>
                <p className="text-sm text-muted-foreground leading-relaxed">Operaciones coinciden con los filtros aplicados.</p>
              </div>

              {totalCount > 0 && (
                <div className="space-y-4 pt-4 border-t border-border">
                  <div>
                    <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1">Valor Agregado (USD)</p>
                    <p className="text-xl font-bold text-foreground">{formatCurrencyStats(searchStats.totalValue)}</p>
                  </div>
                  <div>
                    <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1">Ticket Promedio (USD)</p>
                    <p className="text-xl font-bold text-foreground">{formatCurrencyStats(searchStats.avgTicket)}</p>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {selectedTx && (
        <div className="fixed inset-0 z-50 flex justify-end bg-black/40 backdrop-blur-sm animate-in fade-in" onClick={() => setSelectedTx(null)}>
          <div 
            id="transaction-detail-card"
            className="w-full max-w-md bg-surface h-full shadow-2xl p-6 animate-in slide-in-from-right overflow-y-auto" 
            onClick={e => e.stopPropagation()}
          >
            <div className="flex justify-between items-center mb-6" data-html2canvas-ignore="true">
              <h3 className="text-xl font-bold text-foreground">Detalle de Transacción</h3>
              <div className="flex items-center gap-2">
                <button onClick={() => setSelectedTx(null)} className="p-2 text-muted-foreground hover:bg-muted rounded-full">
                  <X className="h-5 w-5" />
                </button>
              </div>
            </div>
            
            <div className="space-y-8">
              <div className="border-b border-border pb-4">
                <h4 className="text-xl font-bold text-foreground leading-tight mb-2">{selectedTx.title}</h4>
              </div>

              {isLoadingDetails ? (
                <div className="space-y-4 animate-pulse">
                  <div className="h-20 bg-muted rounded-xl w-full"></div>
                  <div className="h-20 bg-muted rounded-xl w-full"></div>
                  <div className="h-20 bg-muted rounded-xl w-full"></div>
                </div>
              ) : txDetails ? (
                <div className="space-y-8 mt-4">
                  
                  {/* Resumen (Excerpt) */}
                  {(txDetails.excerpt || (selectedTx as any).excerpt) && (
                    <div className="border-b border-border pb-6">
                      <p className="text-sm font-semibold text-foreground/80 mb-4">Resumen</p>
                      <div 
                        className="text-sm text-muted-foreground leading-relaxed space-y-4 [&_a]:text-[#E05C50] [&_a]:underline [&_img]:hidden"
                        dangerouslySetInnerHTML={{ __html: txDetails.excerpt || (selectedTx as any).excerpt }}
                      />
                    </div>
                  )}

                  {/* Valor */}
                  <div className="border-b border-border pb-6 space-y-4">
                    <div>
                      <p className="text-sm font-semibold text-foreground/80 mb-2 flex items-center gap-2">Valor
                        <span className={`text-xs px-2 py-0.5 rounded font-medium ${
                          selectedTx.status === 'Cerrado' ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400' :
                          selectedTx.status === 'En progreso' ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400' :
                          'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400'
                        }`}>{selectedTx.status || 'Sin estado'}</span>
                      </p>
                    </div>
                    <div>
                      <span className="inline-block bg-[#10b981] text-white text-sm font-bold px-3 py-1 rounded">
                        {(selectedTx.amount !== 'Por definir' && selectedTx.amount !== 'Valor confidencial') ? `USD ${selectedTx.amount}` : 'Valor confidencial'}
                      </span>
                    </div>
                  </div>

                  {/* Empresas */}
                  {txDetails.companies?.length > 0 && (
                    <div className="border-b border-border pb-6">
                      <p className="text-sm font-semibold text-foreground/80 mb-4">Empresas</p>
                      <div className="grid grid-cols-1 gap-3">
                        {txDetails.companies.map((c: any) => (
                          <div key={`c-${c.id}`} className="flex items-start gap-2 text-sm text-foreground">
                            <span className="text-[#E05C50] mt-0.5 text-xs">▸</span>
                            <div>
                              <span>{c.company?.name}</span>
                              <span className="text-xs text-muted-foreground ml-2">({c.role})</span>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Firmas Asesoras */}
                  {txDetails.advisors?.length > 0 && (
                    <div className="border-b border-border pb-6">
                      <p className="text-sm font-semibold text-foreground/80 mb-4">Firmas Asesoras</p>
                      <div className="grid grid-cols-1 gap-3">
                        {txDetails.advisors.map((a: any) => (
                          <div key={`a-${a.id}`} className="flex items-start gap-2 text-sm text-foreground">
                            <span className="text-[#E05C50] mt-0.5 text-xs">▸</span>
                            <div>
                              <span>{a.firm?.name}</span>
                              <span className="text-xs text-muted-foreground ml-2">({a.role})</span>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Abogados */}
                  {txDetails.lawyers?.length > 0 && (
                    <div className="border-b border-border pb-6">
                      <p className="text-sm font-semibold text-foreground/80 mb-4">Abogados</p>
                      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                        {txDetails.lawyers.map((l: any) => (
                          <div key={l.id} className="flex items-start gap-2 text-sm text-foreground">
                            <span className="text-[#E05C50] mt-0.5 text-xs">▸</span>
                            <span>{l.lawyer?.name}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Industria */}
                  {selectedTx.industry && (
                    <div className="border-b border-border pb-6">
                      <p className="text-sm font-semibold text-foreground/80 mb-4">Industria</p>
                      <div className="flex items-center gap-2 text-sm text-foreground">
                        <span className="text-[#E05C50] text-xs">▸</span>
                        <span>{selectedTx.industry}</span>
                      </div>
                    </div>
                  )}

                  {/* Países */}
                  {selectedTx.country && (
                    <div className="border-b border-border pb-6">
                      <p className="text-sm font-semibold text-foreground/80 mb-4">País</p>
                      <div className="flex flex-wrap gap-4">
                        {selectedTx.country.split(',').map((c: string) => (
                          <div key={c} className="flex items-center gap-2 text-sm text-foreground">
                            <span className="text-[#E05C50] text-xs">▸</span>
                            <span>{c.trim()}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Tipo / Fecha */}
                  <div className="border-b border-border pb-6 grid grid-cols-2 gap-4">
                    {selectedTx.type && (
                      <div>
                        <p className="text-sm font-semibold text-foreground/80 mb-2">Tipo de Operación</p>
                        <p className="text-sm text-muted-foreground">{selectedTx.type}</p>
                      </div>
                    )}
                    <div>
                      <p className="text-sm font-semibold text-foreground/80 mb-2">Fecha de Operación</p>
                      <p className="text-sm text-muted-foreground">{selectedTx.date}</p>
                    </div>
                  </div>

                </div>
              ) : (
                <p className="text-sm text-muted-foreground pt-4 border-t border-border">No se pudieron cargar los detalles adicionales.</p>
              )}

              <div className="border-t border-border pt-6 pb-8 space-y-3" data-html2canvas-ignore="true">
                <a 
                  href={selectedTx.link} 
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex w-full items-center justify-center gap-2 rounded-xl bg-[#E05C50] px-4 py-3 text-sm font-semibold text-white shadow-sm hover:bg-[#D92B4F] transition-all"
                >
                  Leer reseña completa en LexLatin <ArrowUpRight className="h-4 w-4" />
                </a>
                
                <button 
                  onClick={handleDownloadPDF} 
                  disabled={isExporting} 
                  className="flex w-full items-center justify-center gap-2 rounded-xl bg-surface border-2 border-border px-4 py-3 text-sm font-semibold text-foreground shadow-sm hover:bg-muted transition-all disabled:opacity-50"
                >
                  {isExporting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
                  {isExporting ? 'Generando PDF...' : 'Descargar Ficha Técnica PDF'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
