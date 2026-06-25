'use client'

import { useState, useEffect } from 'react'
import { useSearchParams } from 'next/navigation'
import { Filter, Building2, Briefcase, ChevronRight, X, ArrowUpRight, ArrowUpDown, ArrowUp, ArrowDown, Download, FileText, Lock, Loader2 } from 'lucide-react'
import { checkTrialRestrictions, checkCanDownload } from '../actions'
import PaywallModal from '@/components/ui/PaywallModal'
import AlertModal from '@/components/ui/AlertModal'
import { exportToExcel, exportToPDF } from '@/lib/exportUtils'

import useSWR from 'swr'
import SearchableSelect from '@/components/ui/SearchableSelect'

export type UITransaction = {
  id: string
  date: string
  title: string
  type: string
  amount: string
  status: string
  industry: string
  country: string
  firm: string
  lawyer: string
  link: string
}

const fetcher = (url: string) => fetch(url).then(res => res.json())

export default function OperationsClient() {
  const { data: apiResponse, error, isLoading: isSwrLoading } = useSWR('/api/operations?limit=5000', fetcher)
  const transactions: UITransaction[] = apiResponse?.data || []
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
  
  // Nuevos filtros PRO
  const [dateRange, setDateRange] = useState({ start: '', end: '' })
  const [selectedValueRange, setSelectedValueRange] = useState('Todos')
  const [selectedFirm, setSelectedFirm] = useState('Todas')
  const [selectedCountry, setSelectedCountry] = useState('Todos')
  const [selectedLawyer, setSelectedLawyer] = useState('Todos')
  
  // Sidebar expandible
  const [isSidebarOpen, setIsSidebarOpen] = useState(true)

  // Actualizar search query si cambia la URL (para volver atrás, etc.)
  useEffect(() => {
    const q = searchParams.get('search')
    if (q !== null) {
      setSearchQuery(q)
    }
  }, [searchParams])
  const [sortConfig, setSortConfig] = useState<{ key: 'date' | 'amount' | null, direction: 'asc' | 'desc' }>({ key: 'date', direction: 'desc' })

  // Extraer valores únicos para los selects (separando valores separados por coma)
  const extractUnique = (key: 'type' | 'industry' | 'firm' | 'country' | 'lawyer') => {
    const all = transactions.flatMap(tx => (tx[key] || '').split(',').map(s => s.trim()).filter(Boolean))
    return Array.from(new Set(all)).sort()
  }

  const uniqueTypes = extractUnique('type')
  const uniqueIndustries = extractUnique('industry')
  const uniqueFirms = extractUnique('firm')
  const uniqueCountries = extractUnique('country')
  const uniqueLawyers = extractUnique('lawyer')

  const valueRangeOptions = [
    'Todos',
    'Menos de $10M',
    '$10M - $50M',
    '$50M - $100M',
    '$100M - $500M',
    'Más de $500M'
  ]

  // Lógica de filtrado
  const filteredTransactions = transactions.filter(tx => {
    const matchType = selectedType === 'Todos' || (tx.type || '').trim() === selectedType.trim()
    const matchIndustry = selectedIndustry === 'Todas' || (tx.industry || '').includes(selectedIndustry)
    const matchFirm = selectedFirm === 'Todas' || (tx.firm || '').includes(selectedFirm)
    const matchCountry = selectedCountry === 'Todos' || (tx.country || '').includes(selectedCountry)
    const matchLawyer = selectedLawyer === 'Todos' || (tx.lawyer || '').includes(selectedLawyer)
    
    // Filtrado por Búsqueda de Texto
    const searchLower = searchQuery.toLowerCase().trim()
    const matchSearch = searchLower === '' || 
                        (tx.title || '').toLowerCase().includes(searchLower) || 
                        (tx.firm || '').toLowerCase().includes(searchLower) ||
                        (tx.lawyer || '').toLowerCase().includes(searchLower) ||
                        (tx.industry || '').toLowerCase().includes(searchLower)

    // Filtrado por Rango de Fecha
    let matchDate = true
    if (dateRange.start || dateRange.end) {
      const parts = tx.date.split('/')
      if (parts.length === 3) {
        const txDateObj = new Date(parseInt(parts[2]), parseInt(parts[1]) - 1, parseInt(parts[0]))
        const txDate = txDateObj.getTime()
        
        // Al usar inputs type="date", el valor viene como "YYYY-MM-DD". 
        // Agregamos "T00:00:00" para evitar el desfase de zona horaria (UTC vs Local)
        const startDateObj = dateRange.start ? new Date(dateRange.start + 'T00:00:00') : new Date(0)
        const startDate = startDateObj.getTime()
        
        const endDateObj = dateRange.end ? new Date(dateRange.end + 'T00:00:00') : new Date(8640000000000000)
        const endDate = endDateObj.getTime() + 86399999 // Incluir hasta el final del día

        matchDate = txDate >= startDate && txDate <= endDate
      } else {
        matchDate = false
      }
    }

    // Filtrado por Valor Económico
    let matchValue = true
    if (selectedValueRange !== 'Todos') {
      let num = parseFloat(tx.amount.replace(/[^0-9.-]/g, ''))
      if (tx.amount.includes('B')) num *= 1000
      else if (tx.amount === 'Por definir' || isNaN(num)) num = -1

      // Si el número es gigante (mayor a 100,000), asumimos que está expresado en unidades enteras y lo pasamos a millones.
      if (num > 100000) {
        num = num / 1000000
      }

      if (num === -1) {
        matchValue = false
      } else if (selectedValueRange === 'Menos de $10M') {
        matchValue = num < 10
      } else if (selectedValueRange === '$10M - $50M') {
        matchValue = num >= 10 && num < 50
      } else if (selectedValueRange === '$50M - $100M') {
        matchValue = num >= 50 && num < 100
      } else if (selectedValueRange === '$100M - $500M') {
        matchValue = num >= 100 && num < 500
      } else if (selectedValueRange === 'Más de $500M') {
        matchValue = num >= 500
      }
    }
    
    return matchType && matchIndustry && matchFirm && matchCountry && matchLawyer && matchSearch && matchDate && matchValue
  })

  // Parseadores para ordenamiento
  const parseDate = (dateStr: string) => {
    const parts = dateStr.split('/')
    if (parts.length === 3) {
      return new Date(parseInt(parts[2]), parseInt(parts[1]) - 1, parseInt(parts[0])).getTime()
    }
    return 0
  }

  const parseAmount = (amountStr: string) => {
    if (!amountStr || amountStr === 'Por definir') return 0
    let num = parseFloat(amountStr.replace(/[^0-9.-]/g, ''))
    if (amountStr.includes('B')) num *= 1000
    return isNaN(num) ? 0 : num
  }

  // Ordenar transacciones filtradas
  const sortedTransactions = [...filteredTransactions].sort((a, b) => {
    if (!sortConfig.key) return 0
    
    let aValue = 0
    let bValue = 0

    if (sortConfig.key === 'date') {
      aValue = parseDate(a.date)
      bValue = parseDate(b.date)
    } else if (sortConfig.key === 'amount') {
      aValue = parseAmount(a.amount)
      bValue = parseAmount(b.amount)
    }

    if (aValue < bValue) return sortConfig.direction === 'asc' ? -1 : 1
    if (aValue > bValue) return sortConfig.direction === 'asc' ? 1 : -1
    return 0
  })

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
      Estado: tx.status,
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
      exportNativePDF(selectedTx, txDetails, `transaccion_${selectedTx?.id}`)
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
        <div className="flex items-center gap-2 mb-2 text-foreground font-semibold">
          <Filter className="h-5 w-5" /> Filtros Avanzados
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
            <div className="flex items-center gap-2">
              <input 
                type="date" 
                className="w-full rounded-lg border border-border bg-background text-sm p-2 outline-none focus:border-[#EB3159] transition-colors"
                value={dateRange.start}
                onChange={(e) => setDateRange(prev => ({ ...prev, start: e.target.value }))}
                title="Fecha Inicial"
              />
              <span className="text-muted-foreground">-</span>
              <input 
                type="date" 
                className="w-full rounded-lg border border-border bg-background text-sm p-2 outline-none focus:border-[#EB3159] transition-colors"
                value={dateRange.end}
                onChange={(e) => setDateRange(prev => ({ ...prev, end: e.target.value }))}
                title="Fecha Final"
              />
            </div>
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
                  <td className="px-6 py-4 whitespace-nowrap text-right text-sm text-foreground/80 font-medium" title="Dólares Estadounidenses (USD)">{tx.amount === 'Por definir' ? <span className="text-muted-foreground font-normal">Por definir</span> : tx.amount}</td>
                </tr>
              )))}
              {isDataAllowed && sortedTransactions.length === 0 && !isSwrLoading && (
                <tr><td colSpan={8} className="text-center p-8 text-muted-foreground">No hay operaciones que coincidan con los filtros.</td></tr>
              )}
            </tbody>
          </table>
          </div>
        </div>

        {isSidebarOpen && (
          <div className="lg:col-span-1 space-y-6 animate-in fade-in slide-in-from-right-4 duration-300">
            <div className="bg-surface rounded-2xl p-6 shadow-sm border border-border sticky top-0">
              <h3 className="text-sm font-semibold text-foreground mb-4">Resumen de Búsqueda</h3>
              <p className="text-4xl font-bold text-foreground tracking-tight mb-2">{filteredTransactions.length}</p>
              <p className="text-sm text-muted-foreground leading-relaxed">Operaciones coinciden con los filtros aplicados.</p>
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
                <h4 className="text-xl font-bold text-foreground leading-tight mb-4">{selectedTx.title}</h4>
                <p className="text-sm font-semibold text-foreground/80 mb-2">Operation date</p>
                <p className="text-sm text-muted-foreground">{selectedTx.date}</p>
              </div>

              {isLoadingDetails ? (
                <div className="space-y-4 animate-pulse">
                  <div className="h-20 bg-muted rounded-xl w-full"></div>
                  <div className="h-20 bg-muted rounded-xl w-full"></div>
                  <div className="h-20 bg-muted rounded-xl w-full"></div>
                </div>
              ) : txDetails ? (
                <div className="space-y-8">
                  
                  {/* Excerpt */}
                  {txDetails.excerpt && (
                    <div className="border-b border-border pb-6">
                      <p className="text-sm font-semibold text-foreground/80 mb-4">Excerpt</p>
                      <div 
                        className="text-sm text-muted-foreground leading-relaxed space-y-4"
                        dangerouslySetInnerHTML={{ __html: txDetails.excerpt }}
                      />
                    </div>
                  )}

                  {/* Operations & Amount */}
                  <div className="border-b border-border pb-6 space-y-4">
                    <div>
                      <p className="text-sm font-semibold text-foreground/80 mb-2 flex items-center gap-2">Operations <span className="text-xs bg-[#10b981] text-white px-2 py-0.5 rounded">Public</span> <span className="text-xs bg-[#f59e0b] text-white px-2 py-0.5 rounded">{selectedTx.status}</span></p>
                    </div>
                    <div>
                      <span className="inline-block bg-[#10b981] text-white text-sm font-bold px-3 py-1 rounded">
                        {selectedTx.amount !== 'Por definir' ? `USD ${selectedTx.amount}` : selectedTx.amount}
                      </span>
                    </div>
                  </div>

                  {/* Firms involved */}
                  {(txDetails.companies?.length > 0 || txDetails.advisors?.length > 0) && (
                    <div className="border-b border-border pb-6">
                      <p className="text-sm font-semibold text-foreground/80 mb-4">Firms involved</p>
                      <div className="grid grid-cols-1 gap-3">
                        {txDetails.companies?.map((c: any) => (
                          <div key={`c-${c.id}`} className="flex items-start gap-2 text-sm text-foreground">
                            <span className="text-[#E05C50] mt-0.5 text-xs">▸</span>
                            <div>
                              <span>{c.company.name}</span>
                              <span className="text-xs text-muted-foreground ml-2">({c.role})</span>
                            </div>
                          </div>
                        ))}
                        {txDetails.advisors?.map((a: any) => (
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

                  {/* Lawyers involved */}
                  {txDetails.lawyers?.length > 0 && (
                    <div className="border-b border-border pb-6">
                      <p className="text-sm font-semibold text-foreground/80 mb-4">Lawyers involved</p>
                      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                        {txDetails.lawyers.map((l: any) => (
                          <div key={l.id} className="flex items-start gap-2 text-sm text-foreground">
                            <span className="text-[#E05C50] mt-0.5 text-xs">▸</span>
                            <div>
                              <span className="block">{l.lawyer?.name}</span>
                              <span className="text-xs text-muted-foreground">{l.lawyer?.firm?.name}</span>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Industries */}
                  {selectedTx.industry && (
                    <div className="border-b border-border pb-6">
                      <p className="text-sm font-semibold text-foreground/80 mb-4">Industries</p>
                      <div className="flex items-center gap-2 text-sm text-foreground">
                        <span className="text-[#E05C50] text-xs">▸</span>
                        <span>{selectedTx.industry}</span>
                      </div>
                    </div>
                  )}

                  {/* Practice Areas */}
                  {selectedTx.type && (
                    <div className="border-b border-border pb-6">
                      <p className="text-sm font-semibold text-foreground/80 mb-4">Practice Areas</p>
                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <span className="text-[#E05C50] text-xs">▸</span>
                        <span>{selectedTx.type}</span>
                      </div>
                    </div>
                  )}

                  {/* Countries */}
                  {selectedTx.country && (
                    <div className="border-b border-border pb-6">
                      <p className="text-sm font-semibold text-foreground/80 mb-4">Countries</p>
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
