'use client'

import { useState, useMemo, useEffect } from 'react'
import { 
  Building2, 
  Users, 
  FileText, 
  Globe, 
  Search, 
  Filter, 
  ChevronRight, 
  ChevronLeft, 
  Loader2, 
  Briefcase, 
  ChevronUp, 
  ChevronDown, 
  Download, 
  Lock, 
  ExternalLink,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  PieChart as PieIcon
} from 'lucide-react'
import { ComposableMap, Geographies, Geography } from "react-simple-maps"
import { PieChart, Pie, Cell, Tooltip as RechartsTooltip, ResponsiveContainer } from 'recharts'
import { checkTrialRestrictions, checkCanDownload } from '../../actions'
import ProDateRangePicker from '@/components/ui/ProDateRangePicker'
import SearchableSelect from '@/components/ui/SearchableSelect'
import PaywallModal from '@/components/ui/PaywallModal'
import EntityDetailModal from '@/components/ui/EntityDetailModal'
import { exportToExcel } from '@/lib/exportUtils'
import useSWR from 'swr'

const fetcher = (url: string) => fetch(url).then(res => res.json())

const geoUrl = "https://cdn.jsdelivr.net/npm/world-atlas@2/countries-110m.json"

const mapGeoToSpanish: Record<string, string[]> = {
  "Mexico": ["México", "Mexico"],
  "Brazil": ["Brasil", "Brazil"],
  "Argentina": ["Argentina"],
  "Chile": ["Chile"],
  "Colombia": ["Colombia"],
  "Peru": ["Perú", "Peru"],
  "Venezuela": ["Venezuela"],
  "Ecuador": ["Ecuador"],
  "Bolivia": ["Bolivia"],
  "Paraguay": ["Paraguay"],
  "Uruguay": ["Uruguay"],
  "El Salvador": ["El Salvador"],
  "Guatemala": ["Guatemala"],
  "Honduras": ["Honduras"],
  "Nicaragua": ["Nicaragua"],
  "Costa Rica": ["Costa Rica"],
  "Panama": ["Panamá", "Panama"],
  "Dominican Rep.": ["República Dominicana"],
  "Puerto Rico": ["Puerto Rico"],
  "Cuba": ["Cuba"],
  "Spain": ["España", "Spain"],
  "United States of America": ["Estados Unidos", "USA", "EE. UU.", "EE.UU."],
  "United Kingdom": ["Reino Unido", "Inglaterra", "UK", "United Kingdom"],
  "Canada": ["Canadá", "Canada"],
  "China": ["China"],
  "Japan": ["Japón", "Japan"],
  "Germany": ["Alemania", "Germany"],
  "France": ["Francia", "France"],
  "Italy": ["Italia", "Italy"],
  "Portugal": ["Portugal"]
}

// Harmonious palette for the Donut Chart
const PIE_COLORS = [
  '#E05C50', // Brand Red/Coral
  '#1C1F33', // Deep Navy
  '#3B82F6', // Blue
  '#10B981', // Emerald
  '#F59E0B', // Amber
  '#8B5CF6', // Purple
  '#EC4899', // Pink
  '#06B6D4', // Cyan
  '#64748B'  // Slate / Others
]

interface FirmRecord {
  posicion: number
  firma: string
  pais: string
  operaciones: number
  montoAcumulado: number
  transacciones: any[]
}

interface IndustryRecord {
  nombre: string
  operaciones: number
  operacionesPublicas: number
  operacionesConfidenciales: number
  montoAcumulado: number
  porcentaje: number
  firmasCount: number
  firmas: FirmRecord[]
}

function useDebounce<T>(value: T, delay: number): T {
  const [dv, setDv] = useState<T>(value)
  useEffect(() => { 
    const h = setTimeout(() => setDv(value), delay)
    return () => clearTimeout(h) 
  }, [value, delay])
  return dv
}

export default function CountriesClient() {
  const [isMounted, setIsMounted] = useState(false)
  useEffect(() => setIsMounted(true), [])

  // Filters
  const [selectedCountry, setSelectedCountry] = useState('México')
  const [filterType, setFilterType] = useState<string>('Todas')
  const [searchQuery, setSearchQuery] = useState('')
  const debouncedSearch = useDebounce(searchQuery, 400)
  const [dateRange, setDateRange] = useState({ start: '', end: '' })

  // State for storytelling navigation
  const [selectedIndustry, setSelectedIndustry] = useState<IndustryRecord | null>(null)
  const [selectedTxForModal, setSelectedTxForModal] = useState<any | null>(null)
  const [isDetailModalOpen, setIsDetailModalOpen] = useState(false)
  const [isMapExpanded, setIsMapExpanded] = useState(true)

  // Sorting state for Industries table
  const [industrySortBy, setIndustrySortBy] = useState<'deals' | 'value' | 'name'>('deals')
  const [industrySortOrder, setIndustrySortOrder] = useState<'desc' | 'asc'>('desc')

  // Sorting state for Firms in industry table
  const [firmSortBy, setFirmSortBy] = useState<'deals' | 'value' | 'name'>('deals')
  const [firmSortOrder, setFirmSortOrder] = useState<'desc' | 'asc'>('desc')

  // Tooltip for Map
  const [tooltipContent, setTooltipContent] = useState<{name: string, operaciones: number, monto: number, x: number, y: number} | null>(null)

  // Paywall
  const [showPaywall, setShowPaywall] = useState(false)
  const [paywallTitle, setPaywallTitle] = useState('')
  const [paywallMessage, setPaywallMessage] = useState('')
  const [isDataAllowed, setIsDataAllowed] = useState(true)

  // API URL
  const apiUrl = useMemo(() => {
    const p = new URLSearchParams()
    if (selectedCountry) p.set('country', selectedCountry)
    if (filterType !== 'Todas') p.set('type', filterType)
    if (debouncedSearch.trim()) p.set('search', debouncedSearch.trim())
    if (dateRange.start) p.set('dateStart', dateRange.start)
    if (dateRange.end) p.set('dateEnd', dateRange.end)
    return `/api/metrics/countries?${p.toString()}`
  }, [selectedCountry, filterType, debouncedSearch, dateRange])

  const { data: apiData, isLoading: isSwrLoading } = useSWR(apiUrl, fetcher, { keepPreviousData: true })
  const isLoading = isSwrLoading && !apiData

  const mapData = apiData?.mapData || []
  const rawIndustries: IndustryRecord[] = apiData?.industries || []
  const serverStats = apiData?.stats || {}
  const availableCountries: string[] = apiData?.countries || []

  // Check trial
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

  // Auto-select #1 industry when country data loads
  useEffect(() => {
    if (rawIndustries.length > 0) {
      if (!selectedIndustry || !rawIndustries.find(i => i.nombre === selectedIndustry.nombre)) {
        setSelectedIndustry(rawIndustries[0])
      } else {
        const updated = rawIndustries.find(i => i.nombre === selectedIndustry.nombre)
        if (updated) setSelectedIndustry(updated)
      }
    } else {
      setSelectedIndustry(null)
    }
  }, [rawIndustries])

  // Sorted industries
  const sortedIndustries = useMemo(() => {
    const list = [...rawIndustries]
    list.sort((a, b) => {
      if (industrySortBy === 'value') {
        const diff = b.montoAcumulado - a.montoAcumulado
        return industrySortOrder === 'asc' ? -diff : diff
      } else if (industrySortBy === 'name') {
        const cmp = a.nombre.localeCompare(b.nombre)
        return industrySortOrder === 'asc' ? cmp : -cmp
      } else {
        // default: deals
        const diff = b.operaciones - a.operaciones
        if (diff !== 0) return industrySortOrder === 'asc' ? -diff : diff
        return industrySortOrder === 'asc' ? a.montoAcumulado - b.montoAcumulado : b.montoAcumulado - a.montoAcumulado
      }
    })
    return list
  }, [rawIndustries, industrySortBy, industrySortOrder])

  // Sorted firms for selected industry
  const sortedFirmsForIndustry = useMemo(() => {
    if (!selectedIndustry?.firmas) return []
    const list = [...selectedIndustry.firmas]
    list.sort((a, b) => {
      if (firmSortBy === 'value') {
        const diff = b.montoAcumulado - a.montoAcumulado
        return firmSortOrder === 'asc' ? -diff : diff
      } else if (firmSortBy === 'name') {
        const cmp = a.firma.localeCompare(b.firma)
        return firmSortOrder === 'asc' ? cmp : -cmp
      } else {
        // default: deals
        const diff = b.operaciones - a.operaciones
        if (diff !== 0) return firmSortOrder === 'asc' ? -diff : diff
        return firmSortOrder === 'asc' ? a.montoAcumulado - b.montoAcumulado : b.montoAcumulado - a.montoAcumulado
      }
    })
    return list.map((f, i) => ({ ...f, posicion: i + 1 }))
  }, [selectedIndustry, firmSortBy, firmSortOrder])

  // Donut Chart data (Top 5 + Otros)
  const chartData = useMemo(() => {
    if (!rawIndustries || rawIndustries.length === 0) return []
    const top5 = rawIndustries.slice(0, 5)
    const others = rawIndustries.slice(5)
    
    const result = top5.map(ind => ({
      name: ind.nombre,
      value: ind.operaciones,
      percentage: ind.porcentaje
    }))

    if (others.length > 0) {
      const otherDeals = others.reduce((acc, i) => acc + i.operaciones, 0)
      const otherPercent = others.reduce((acc, i) => acc + i.porcentaje, 0)
      result.push({
        name: 'Otras industrias',
        value: otherDeals,
        percentage: Number(otherPercent.toFixed(1))
      })
    }
    return result
  }, [rawIndustries])

  const formatCurrency = (value: number | null | undefined) => {
    if (!value || value === 0) return 'Valor confidencial'
    if (value >= 1e9) return `$${(value / 1e9).toFixed(2)}B`
    if (value >= 1e6) return `$${(value / 1e6).toFixed(1)}M`
    return `$${value.toLocaleString()}`
  }

  const getMapCountryStats = (spanishNames: string[]) => {
    const active = mapData.find((ind: any) => spanishNames.includes(ind.pais))
    return active || null
  }

  const handleSelectCountry = (country: string) => {
    setSelectedCountry(country)
    // Smooth scroll down to the sectorial breakdown
    setTimeout(() => {
      document.getElementById('sector-storytelling-section')?.scrollIntoView({ behavior: 'smooth' })
    }, 150)
  }

  const handleDownloadIndustriesExcel = async () => {
    const downloadCheck = await checkCanDownload()
    if (!downloadCheck.allowed) {
      setPaywallTitle('Descarga Bloqueada')
      setPaywallMessage(downloadCheck.message || 'Solo puedes descargar datos con una suscripción activa.')
      setShowPaywall(true)
      return
    }

    exportToExcel(sortedIndustries.map(ind => ({
      'Industria': ind.nombre,
      'País': selectedCountry,
      'Operaciones': ind.operaciones,
      'Cuota de Mercado (%)': `${ind.porcentaje}%`,
      'Operaciones Públicas': ind.operacionesPublicas,
      'Operaciones Confidenciales': ind.operacionesConfidenciales,
      'Monto Acumulado (USD)': ind.montoAcumulado > 0 ? ind.montoAcumulado : 0
    })), `industrias_${selectedCountry.toLowerCase()}`)
  }

  const handleDownloadFirmsInSectorExcel = async () => {
    if (!selectedIndustry) return
    const downloadCheck = await checkCanDownload()
    if (!downloadCheck.allowed) {
      setPaywallTitle('Descarga Bloqueada')
      setPaywallMessage(downloadCheck.message || 'Solo puedes descargar datos con una suscripción activa.')
      setShowPaywall(true)
      return
    }

    exportToExcel(sortedFirmsForIndustry.map(f => ({
      'Posición': f.posicion,
      'Firma': f.firma,
      'País Sede': f.pais,
      'Industria': selectedIndustry.nombre,
      'Jurisdicción': selectedCountry,
      'Operaciones en Sector': f.operaciones,
      'Monto Acumulado en Sector (USD)': f.montoAcumulado > 0 ? f.montoAcumulado : 0
    })), `firmas_${selectedIndustry.nombre.toLowerCase().replace(/\s+/g, '_')}_${selectedCountry.toLowerCase()}`)
  }

  const renderSortIndicator = (currentCol: string, targetCol: string, order: string) => {
    if (currentCol !== targetCol) {
      return <ArrowUpDown className="w-3.5 h-3.5 text-muted-foreground/40 ml-1.5 inline" />
    }
    return order === 'desc' 
      ? <ArrowDown className="w-3.5 h-3.5 text-brand ml-1.5 inline" />
      : <ArrowUp className="w-3.5 h-3.5 text-brand ml-1.5 inline" />
  }

  const filterOptions = ['Todas', 'M&A', 'Financiamientos', 'Emisiones']

  return (
    <div className="flex flex-col h-full space-y-6">
      
      {/* Paywall Modal */}
      <PaywallModal 
        isOpen={showPaywall} 
        onClose={() => setShowPaywall(false)} 
        title={paywallTitle} 
        message={paywallMessage} 
      />

      {/* Modal Detalle de Transacción */}
      {selectedTxForModal && (
        <EntityDetailModal 
          isOpen={isDetailModalOpen}
          onClose={() => { setIsDetailModalOpen(false); setSelectedTxForModal(null); }}
          title={selectedTxForModal.title}
          subtitle={`Operación en ${selectedIndustry?.nombre || 'Sector'}`}
          amount={selectedTxForModal.montoString}
          iconType="industry"
          sections={[
            { label: 'Tipo de Operación', value: selectedTxForModal.type },
            { label: 'País / Jurisdicción', value: selectedCountry },
            { label: 'Empresas / Partes', value: selectedTxForModal.empresa || 'N/D' },
            { label: 'Abogados Involucrados', value: selectedTxForModal.abogados || 'N/D' },
            { label: 'Fecha', value: selectedTxForModal.fecha ? new Date(selectedTxForModal.fecha).toLocaleDateString('es-ES', { year: 'numeric', month: 'long', day: 'numeric' }) : 'No especificada' }
          ]}
        />
      )}

      {/* Header PRO (Limpio, Sin tarjetas de KPIs para dar protagonismo total al mapa) */}
      <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4 bg-surface p-6 rounded-2xl shadow-sm border border-border">
        <div>
          <h2 className="text-3xl font-bold tracking-tight text-foreground flex items-center gap-2.5">
            <Globe className="h-7 w-7 text-brand" />
            Jurisdicciones
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Radiografía geográfica y sectorial: explora la actividad financiera, industrias clave y firmas líderes por país.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          {/* Tipos de Operación */}
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

          {/* Rango de Fechas */}
          <ProDateRangePicker 
            value={dateRange}
            onChange={setDateRange}
          />
        </div>
      </div>

      {/* NIVEL 1: MAPA HERO INTERACTIVO DE JURISDICCIONES */}
      <div className="bg-surface rounded-2xl p-6 shadow-sm border border-border relative flex flex-col items-center justify-center">
        <div className="w-full flex justify-between items-center mb-3">
          <div className="flex items-center gap-3">
            <div className="h-8 w-8 rounded-lg bg-brand/10 flex items-center justify-center text-brand">
              <Globe className="h-4 w-4" />
            </div>
            <div>
              <h3 className="text-base font-bold text-foreground">
                Mapa Financiero de Mercado Activo
              </h3>
              <p className="text-xs text-muted-foreground">
                Haz clic en cualquier país en el mapa para explorar sus industrias y firmas asesoras.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <span className="hidden sm:inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-brand/10 text-brand text-xs font-semibold">
              <span className="h-2 w-2 rounded-full bg-brand animate-pulse"></span>
              Seleccionado: {selectedCountry}
            </span>
            <button 
              onClick={() => setIsMapExpanded(!isMapExpanded)}
              className="text-xs font-semibold text-brand hover:text-brand/80 transition-colors flex items-center gap-1 bg-brand/10 px-3 py-1.5 rounded-lg"
            >
              {isMapExpanded ? (
                <><ChevronUp className="h-4 w-4" /> Ocultar Mapa</>
              ) : (
                <><ChevronDown className="h-4 w-4" /> Mostrar Mapa</>
              )}
            </button>
          </div>
        </div>

        {isMapExpanded && (
          <div className="w-full h-[420px] bg-[#f8f9fa] dark:bg-[#151828] rounded-xl overflow-hidden relative border border-border">
            {isMounted && (
              <ComposableMap 
                projection="geoMercator" 
                projectionConfig={{ scale: 130 }} 
                width={800} 
                height={420} 
                className="w-full h-full"
              >
                <Geographies geography={geoUrl}>
                  {({ geographies }) =>
                    geographies.map((geo) => {
                      const geoName = geo.properties?.name
                      const spanishNames = mapGeoToSpanish[geoName] || [geoName]
                      
                      const activeStats = getMapCountryStats(spanishNames)
                      const isActive = activeStats !== null
                      const isCurrentlySelected = activeStats ? spanishNames.includes(selectedCountry) || activeStats.pais === selectedCountry : false
                      
                      return (
                        <Geography
                          key={geo.rsmKey}
                          geography={geo}
                          fill={isCurrentlySelected ? "#B82E25" : isActive ? "#E05C50" : "#D6D6DA"}
                          stroke={isCurrentlySelected ? "#1C1F33" : "#FFFFFF"}
                          strokeWidth={isCurrentlySelected ? 1.5 : 0.5}
                          onClick={() => {
                            if (isActive && activeStats) {
                              handleSelectCountry(activeStats.pais)
                            }
                          }}
                          onMouseEnter={(e) => {
                            if (isActive && activeStats) {
                              setTooltipContent({
                                name: activeStats.pais,
                                operaciones: activeStats.operaciones,
                                monto: activeStats.valorAcumulado,
                                x: e.clientX,
                                y: e.clientY
                              })
                            }
                          }}
                          onMouseMove={(e) => {
                            if (tooltipContent) {
                              setTooltipContent(prev => prev ? { ...prev, x: e.clientX, y: e.clientY } : null)
                            }
                          }}
                          onMouseLeave={() => {
                            setTooltipContent(null)
                          }}
                          style={{
                            default: { outline: "none", transition: "all 0.25s ease" },
                            hover: { 
                              fill: isCurrentlySelected ? "#99231B" : isActive ? "#C94B40" : "#D6D6DA", 
                              outline: "none", 
                              cursor: isActive ? "pointer" : "default" 
                            },
                            pressed: { outline: "none" },
                          }}
                        />
                      )
                    })
                  }
                </Geographies>
              </ComposableMap>
            )}

            {/* Custom Interactive Tooltip */}
            {tooltipContent && (
              <div 
                className="fixed z-[100] bg-[#1C1F33] text-white p-3 rounded-xl shadow-2xl border border-white/10 pointer-events-none min-w-[170px] animate-in fade-in zoom-in-95 duration-150"
                style={{ left: tooltipContent.x + 15, top: tooltipContent.y + 15 }}
              >
                <div className="flex items-center gap-1.5 border-b border-white/10 pb-1 mb-2">
                  <Globe className="h-3.5 w-3.5 text-brand" />
                  <h4 className="font-bold text-sm text-white">{tooltipContent.name}</h4>
                </div>
                <div className="text-xs space-y-1">
                  <p className="flex justify-between gap-4 text-white/70">
                    <span>Operaciones:</span> 
                    <span className="font-bold text-white">{tooltipContent.operaciones.toLocaleString()}</span>
                  </p>
                  <p className="flex justify-between gap-4 text-white/70">
                    <span>Monto Global:</span> 
                    <span className="font-bold text-brand">{formatCurrency(tooltipContent.monto)}</span>
                  </p>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* NIVEL 2: RADIOGRAFÍA SECTORIAL (INDUSTRIAS DEL PAÍS) */}
      <div id="sector-storytelling-section" className="space-y-6 pt-2">
        
        {/* Toolbar de País y Filtro */}
        <div className="p-4 bg-surface rounded-2xl shadow-sm border border-border flex flex-col md:flex-row gap-4 justify-between items-start md:items-center">
          <div className="flex flex-wrap items-center gap-3 w-full md:w-auto">
            {/* SearchableSelect de País */}
            <div className="w-full sm:w-[240px]">
              <SearchableSelect 
                value={selectedCountry}
                onChange={handleSelectCountry}
                options={availableCountries.length > 0 ? availableCountries : ['México', 'Brasil', 'Chile', 'Colombia', 'Perú', 'Argentina']}
                placeholder="Buscar país..."
              />
            </div>

            <div className="flex items-center gap-2">
              <span className="inline-flex items-center px-3 py-1.5 rounded-xl bg-brand/10 text-brand text-xs font-bold">
                {serverStats.totalDeals || 0} Operaciones en {selectedCountry}
              </span>
              <span className="hidden sm:inline-flex items-center px-3 py-1.5 rounded-xl bg-muted text-foreground text-xs font-bold">
                {formatCurrency(serverStats.totalValue || 0)} USD acumulados
              </span>
            </div>
          </div>

          <div className="relative w-full md:w-72 shrink-0 flex items-center gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <input 
                type="text" 
                placeholder={`Buscar sector en ${selectedCountry}...`} 
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-4 py-2 text-sm bg-background border border-border rounded-xl focus:outline-none focus:ring-2 focus:ring-brand/20 focus:border-brand transition-all"
              />
            </div>
            <button
              onClick={handleDownloadIndustriesExcel}
              title="Exportar sectores a Excel"
              className="p-2 border border-brand bg-brand/10 text-brand rounded-xl hover:bg-brand hover:text-white transition-colors shrink-0"
            >
              <Download className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Layout 2 Columnas: Tabla de Industrias (60%) + Gráfico de Donut (40%) */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch">
          
          {/* Tabla de Industrias (Col 7) */}
          <div className="lg:col-span-7 bg-surface rounded-2xl shadow-sm border border-border flex flex-col overflow-hidden min-h-[460px]">
            <div className="p-4 border-b border-border bg-muted/20 flex justify-between items-center">
              <div>
                <h3 className="text-sm font-bold text-foreground flex items-center gap-2">
                  <Briefcase className="h-4 w-4 text-brand" />
                  Sectores e Industrias en {selectedCountry}
                </h3>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Haz clic en cualquier sector para ver el ranking de firmas que lo asesoraron.
                </p>
              </div>
              <span className="text-xs font-semibold text-muted-foreground bg-background px-2.5 py-1 rounded-lg border border-border">
                {sortedIndustries.length} sectores
              </span>
            </div>

            <div className="flex-1 overflow-auto max-h-[420px]">
              <table className="w-full text-left border-collapse">
                <thead className="bg-muted/70 sticky top-0 z-10 backdrop-blur-sm border-b border-border">
                  <tr>
                    <th 
                      onClick={() => {
                        setIndustrySortBy('name')
                        setIndustrySortOrder(prev => prev === 'desc' ? 'asc' : 'desc')
                      }}
                      className="px-5 py-3 text-left text-xs font-bold text-muted-foreground uppercase tracking-wider cursor-pointer hover:text-foreground select-none"
                    >
                      Industria {renderSortIndicator(industrySortBy, 'name', industrySortOrder)}
                    </th>
                    <th 
                      onClick={() => {
                        setIndustrySortBy('deals')
                        setIndustrySortOrder(prev => prev === 'desc' ? 'asc' : 'desc')
                      }}
                      className="px-5 py-3 text-left text-xs font-bold text-muted-foreground uppercase tracking-wider cursor-pointer hover:text-foreground select-none"
                    >
                      Operaciones (% País) {renderSortIndicator(industrySortBy, 'deals', industrySortOrder)}
                    </th>
                    <th 
                      onClick={() => {
                        setIndustrySortBy('value')
                        setIndustrySortOrder(prev => prev === 'desc' ? 'asc' : 'desc')
                      }}
                      className="px-5 py-3 text-right text-xs font-bold text-muted-foreground uppercase tracking-wider cursor-pointer hover:text-foreground select-none"
                    >
                      Monto Acumulado (USD) {renderSortIndicator(industrySortBy, 'value', industrySortOrder)}
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {isLoading ? (
                    <tr>
                      <td colSpan={3} className="px-6 py-16 text-center">
                        <div className="flex flex-col items-center justify-center text-muted-foreground">
                          <Loader2 className="h-8 w-8 animate-spin text-brand mb-2" />
                          <span className="text-sm font-medium">Cargando sectores de {selectedCountry}...</span>
                        </div>
                      </td>
                    </tr>
                  ) : !isDataAllowed ? (
                    <tr>
                      <td colSpan={3} className="px-6 py-16 text-center">
                        <div className="flex flex-col items-center justify-center text-muted-foreground">
                          <Lock className="w-8 h-8 mb-2 text-muted-foreground/50" />
                          <span className="text-sm font-semibold">Límite de consultas alcanzado</span>
                        </div>
                      </td>
                    </tr>
                  ) : (
                    <>
                      {sortedIndustries.map((ind, i) => {
                        const isSelected = selectedIndustry?.nombre === ind.nombre
                        return (
                          <tr
                            key={ind.nombre}
                            onClick={() => setSelectedIndustry(ind)}
                            className={`cursor-pointer transition-colors hover:bg-muted/60 ${
                              isSelected 
                                ? 'bg-brand/10 border-l-4 border-l-brand' 
                                : 'border-l-4 border-l-transparent'
                            }`}
                          >
                            <td className="px-5 py-3.5">
                              <div className="flex items-center gap-2.5">
                                <span className="font-mono text-xs font-semibold text-muted-foreground w-5 text-right">
                                  {i + 1}
                                </span>
                                <span className={`text-sm font-semibold truncate max-w-[220px] ${isSelected ? 'text-brand' : 'text-foreground'}`} title={ind.nombre}>
                                  {ind.nombre}
                                </span>
                              </div>
                            </td>
                            <td className="px-5 py-3.5">
                              <div className="flex items-center gap-2">
                                <span className="text-sm font-bold text-foreground">
                                  {ind.operaciones} ops
                                </span>
                                <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-bold bg-muted text-muted-foreground border border-border">
                                  {ind.porcentaje}%
                                </span>
                              </div>
                            </td>
                            <td className="px-5 py-3.5 text-right font-semibold text-sm text-foreground">
                              {ind.montoAcumulado > 0 ? formatCurrency(ind.montoAcumulado) : (
                                <span className="text-xs text-muted-foreground italic">Confidencial</span>
                              )}
                            </td>
                          </tr>
                        )
                      })}

                      {sortedIndustries.length === 0 && (
                        <tr>
                          <td colSpan={3} className="px-6 py-12 text-center text-muted-foreground text-sm">
                            No se encontraron sectores para este país y filtros.
                          </td>
                        </tr>
                      )}
                    </>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Gráfico Donut de Cuota de Mercado (Col 5) */}
          <div className="lg:col-span-5 bg-surface rounded-2xl shadow-sm border border-border p-6 flex flex-col justify-between">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <PieIcon className="h-5 w-5 text-brand" />
                <h3 className="text-sm font-bold text-foreground">
                  Cuota de Mercado por Industria
                </h3>
              </div>
              <span className="text-xs text-muted-foreground">{selectedCountry}</span>
            </div>

            {/* Donut Chart with Recharts */}
            <div className="h-56 w-full relative flex items-center justify-center my-2">
              {isMounted && chartData.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={chartData}
                      dataKey="value"
                      nameKey="name"
                      cx="50%"
                      cy="50%"
                      innerRadius={55}
                      outerRadius={85}
                      paddingAngle={3}
                    >
                      {chartData.map((entry, index) => (
                        <Cell 
                          key={`cell-${index}`} 
                          fill={PIE_COLORS[index % PIE_COLORS.length]} 
                        />
                      ))}
                    </Pie>
                    <RechartsTooltip 
                      formatter={(val: any, name: any, item: any) => [
                        `${val} operaciones (${item.payload.percentage}%)`,
                        name
                      ]}
                      contentStyle={{
                        backgroundColor: '#1C1F33',
                        borderColor: 'rgba(255,255,255,0.1)',
                        borderRadius: '12px',
                        color: '#fff',
                        fontSize: '12px'
                      }}
                    />
                  </PieChart>
                </ResponsiveContainer>
              ) : (
                <div className="flex items-center justify-center h-full text-xs text-muted-foreground">
                  Sin datos gráficos para mostrar.
                </div>
              )}

              {/* Center Metric */}
              <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                <span className="text-xl font-bold text-foreground">
                  {serverStats.totalDeals || 0}
                </span>
                <span className="text-[10px] uppercase font-bold text-muted-foreground">
                  Deals {selectedCountry}
                </span>
              </div>
            </div>

            {/* Legend breakdown */}
            <div className="space-y-1.5 border-t border-border pt-3">
              {chartData.slice(0, 5).map((entry, idx) => (
                <div key={entry.name} className="flex items-center justify-between text-xs">
                  <div className="flex items-center gap-2 truncate max-w-[190px]">
                    <span 
                      className="h-2.5 w-2.5 rounded-full shrink-0" 
                      style={{ backgroundColor: PIE_COLORS[idx % PIE_COLORS.length] }} 
                    />
                    <span className="text-muted-foreground truncate">{entry.name}</span>
                  </div>
                  <span className="font-bold text-foreground">
                    {entry.percentage}% <span className="font-normal text-muted-foreground">({entry.value} ops)</span>
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* NIVEL 3: FIRMAS LÍDERES EN LA INDUSTRIA SELECCIONADA (EL FINAL DEL STORYTELLING) */}
        {selectedIndustry && (
          <div className="bg-surface rounded-2xl shadow-sm border border-border overflow-hidden transition-all duration-300 animate-in fade-in slide-in-from-bottom-2">
            
            {/* Header del Nivel 3 */}
            <div className="p-5 border-b border-border bg-muted/30 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
              <div>
                <div className="flex items-center gap-2">
                  <span className="px-2 py-0.5 rounded-md bg-brand text-white text-[11px] font-bold uppercase tracking-wider">
                    Storytelling: Nivel 3
                  </span>
                  <span className="text-xs text-muted-foreground">•</span>
                  <span className="text-xs font-semibold text-muted-foreground">
                    {selectedCountry}
                  </span>
                </div>
                <h3 className="text-xl font-bold text-foreground mt-1">
                  Firmas Asesoras en {selectedIndustry.nombre}
                </h3>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Ranking de firmas legales que han asesorado operaciones en este sector específico.
                </p>
              </div>

              <div className="flex items-center gap-3">
                <span className="text-xs font-semibold text-brand bg-brand/10 px-3 py-1.5 rounded-xl">
                  {sortedFirmsForIndustry.length} firmas activas en este sector
                </span>
                <button
                  onClick={handleDownloadFirmsInSectorExcel}
                  title="Exportar firmas del sector a Excel"
                  className="p-2 border border-brand bg-brand/10 text-brand rounded-xl hover:bg-brand hover:text-white transition-colors"
                >
                  <Download className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Tabla de Firmas en el Sector */}
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse min-w-[650px]">
                <thead className="bg-muted/70 border-b border-border">
                  <tr>
                    <th className="px-4 py-3.5 text-center text-xs font-bold text-muted-foreground uppercase tracking-wider w-16">
                      #
                    </th>
                    <th 
                      onClick={() => {
                        setFirmSortBy('name')
                        setFirmSortOrder(prev => prev === 'desc' ? 'asc' : 'desc')
                      }}
                      className="px-6 py-3.5 text-left text-xs font-bold text-muted-foreground uppercase tracking-wider cursor-pointer hover:text-foreground select-none"
                    >
                      Firma {renderSortIndicator(firmSortBy, 'name', firmSortOrder)}
                    </th>
                    <th 
                      onClick={() => {
                        setFirmSortBy('deals')
                        setFirmSortOrder(prev => prev === 'desc' ? 'asc' : 'desc')
                      }}
                      className="px-6 py-3.5 text-left text-xs font-bold text-muted-foreground uppercase tracking-wider cursor-pointer hover:text-foreground select-none"
                    >
                      Número de Operaciones en Sector {renderSortIndicator(firmSortBy, 'deals', firmSortOrder)}
                    </th>
                    <th 
                      onClick={() => {
                        setFirmSortBy('value')
                        setFirmSortOrder(prev => prev === 'desc' ? 'asc' : 'desc')
                      }}
                      className="px-6 py-3.5 text-right text-xs font-bold text-muted-foreground uppercase tracking-wider cursor-pointer hover:text-foreground select-none"
                    >
                      Monto Acumulado en Sector (USD) {renderSortIndicator(firmSortBy, 'value', firmSortOrder)}
                    </th>
                    <th className="px-6 py-3.5 text-right text-xs font-bold text-muted-foreground uppercase tracking-wider">
                      Acción
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {sortedFirmsForIndustry.map((firm) => (
                    <tr 
                      key={firm.firma} 
                      className="hover:bg-muted/50 transition-colors"
                    >
                      {/* Posición limpia */}
                      <td className="px-4 py-3.5 text-center font-mono text-sm font-semibold text-muted-foreground">
                        {firm.posicion}
                      </td>

                      {/* Firma */}
                      <td className="px-6 py-3.5">
                        <div className="flex items-center gap-3">
                          <div className="h-8 w-8 rounded-lg bg-muted flex items-center justify-center text-muted-foreground shrink-0">
                            <Building2 className="h-4 w-4" />
                          </div>
                          <div>
                            <span className="text-sm font-bold text-foreground block">
                              {firm.firma}
                            </span>
                            <span className="text-[11px] text-muted-foreground">
                              Sede: {firm.pais}
                            </span>
                          </div>
                        </div>
                      </td>

                      {/* Operaciones */}
                      <td className="px-6 py-3.5">
                        <span className="text-sm font-bold text-foreground">
                          {firm.operaciones} ops
                        </span>
                        <span className="text-xs text-muted-foreground ml-2">
                          en {selectedIndustry.nombre}
                        </span>
                      </td>

                      {/* Monto acumulado */}
                      <td className="px-6 py-3.5 text-right font-bold text-sm text-foreground">
                        {firm.montoAcumulado > 0 ? (
                          formatCurrency(firm.montoAcumulado)
                        ) : (
                          <span className="text-xs text-muted-foreground font-normal italic">
                            Montos confidenciales
                          </span>
                        )}
                      </td>

                      {/* Ver transacciones */}
                      <td className="px-6 py-3.5 text-right">
                        {firm.transacciones && firm.transacciones.length > 0 && (
                          <button
                            onClick={() => {
                              setSelectedTxForModal(firm.transacciones[0])
                              setIsDetailModalOpen(true)
                            }}
                            className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-semibold rounded-lg bg-brand/10 text-brand hover:bg-brand hover:text-white transition-colors"
                          >
                            <ExternalLink className="w-3.5 h-3.5" />
                            Ver ({firm.transacciones.length})
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}

                  {sortedFirmsForIndustry.length === 0 && (
                    <tr>
                      <td colSpan={5} className="px-6 py-12 text-center text-muted-foreground text-sm">
                        No hay firmas registradas con operaciones en este sector.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

    </div>
  )
}
