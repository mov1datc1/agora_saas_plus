'use client'

import { useState, useMemo, useEffect } from 'react'
import Link from 'next/link'
import { Building2, Users, FileText, ArrowUpRight, X, Globe, Search, Filter, ChevronRight, ChevronLeft, Loader2, Briefcase, ChevronUp, ChevronDown, Download, Lock, ExternalLink } from 'lucide-react'
import { ComposableMap, Geographies, Geography } from "react-simple-maps"
import { checkTrialRestrictions, checkCanDownload } from '../../actions'
import PaywallModal from '@/components/ui/PaywallModal'
import EntityDetailModal from '@/components/ui/EntityDetailModal'
import { exportToExcel } from '@/lib/exportUtils'
import useSWR from 'swr'

const fetcher = (url: string) => fetch(url).then(res => res.json())

const geoUrl = "https://cdn.jsdelivr.net/npm/world-atlas@2/countries-110m.json"

const mapGeoToSpanish: Record<string, string[]> = {
  "Mexico": ["México", "Mexico", "América Latina", "Latinoamérica"],
  "Brazil": ["Brasil", "Brazil", "América Latina", "Latinoamérica"],
  "Argentina": ["Argentina", "América Latina", "Latinoamérica"],
  "Chile": ["Chile", "América Latina", "Latinoamérica"],
  "Colombia": ["Colombia", "América Latina", "Latinoamérica"],
  "Peru": ["Perú", "Peru", "América Latina", "Latinoamérica"],
  "Venezuela": ["Venezuela", "América Latina", "Latinoamérica"],
  "Ecuador": ["Ecuador", "América Latina", "Latinoamérica"],
  "Bolivia": ["Bolivia", "América Latina", "Latinoamérica"],
  "Paraguay": ["Paraguay", "América Latina", "Latinoamérica"],
  "Uruguay": ["Uruguay", "América Latina", "Latinoamérica"],
  "El Salvador": ["El Salvador", "Centroamérica", "América Latina"],
  "Guatemala": ["Guatemala", "Centroamérica", "América Latina"],
  "Honduras": ["Honduras", "Centroamérica", "América Latina"],
  "Nicaragua": ["Nicaragua", "Centroamérica", "América Latina"],
  "Costa Rica": ["Costa Rica", "Centroamérica", "América Latina"],
  "Panama": ["Panamá", "Panama", "Centroamérica", "América Latina"],
  "Dominican Rep.": ["República Dominicana", "América Latina", "Caribe"],
  "Puerto Rico": ["Puerto Rico", "América Latina", "Caribe"],
  "Cuba": ["Cuba", "América Latina", "Caribe"],
  "Spain": ["España"],
  "United States of America": ["Estados Unidos", "USA", "EE. UU.", "EE.UU."],
  "United Kingdom": ["Reino Unido", "Inglaterra", "UK"],
  "Canada": ["Canadá", "Canada"],
  "China": ["China"],
  "Japan": ["Japón", "Japan"],
  "Germany": ["Alemania"],
  "France": ["Francia"],
  "Italy": ["Italia"],
  "Portugal": ["Portugal"]
}

interface TableRow {
  id: string
  industria: string
  monto: number
  operaciones: number
  paises: string[]
  empresas: string[]
  firmas: string[]
  tiposOperacion: string[]
}

export default function IndustriesClient() {
  const [tableData, setTableData] = useState<TableRow[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isRankingModalOpen, setIsRankingModalOpen] = useState(false)
  const [filterType, setFilterType] = useState<string>('Todas')
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedRow, setSelectedRow] = useState<TableRow | null>(null)
  
  const [isMounted, setIsMounted] = useState(false)
  useEffect(() => setIsMounted(true), [])
  const [isMapExpanded, setIsMapExpanded] = useState(true)
  
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
      setTableData(apiData)
      setIsLoading(false)
    }
  }, [apiData])

  const totalIndustries = tableData.length
  const totalTransactions = tableData.reduce((acc, row) => acc + row.operaciones, 0)

  const filterOptions = ['Todas', 'M&A', 'Financiamientos', 'Emisiones']

  const filteredData = useMemo(() => {
    let result = tableData.filter(row => {
      const matchesType = filterType === 'Todas' || row.tiposOperacion.includes(filterType)
      const matchesSearch = row.industria.toLowerCase().includes(searchQuery.toLowerCase())
      return matchesType && matchesSearch
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
    }
    return result
  }, [tableData, filterType, searchQuery, sortConfig])

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

  const topIndustriesList = useMemo(() => {
    return [...tableData].sort((a, b) => b.operaciones - a.operaciones)
  }, [tableData])

  const filteredRankingList = useMemo(() => {
    if (!rankingSearchQuery) return topIndustriesList
    return topIndustriesList.filter(i => i.industria.toLowerCase().includes(rankingSearchQuery.toLowerCase()))
  }, [topIndustriesList, rankingSearchQuery])

  // Data map computations
  const getActiveIndustriesForCountry = (spanishNames: string[]) => {
    const active = filteredData.filter(ind => 
      ind.paises.some(p => spanishNames.includes(p))
    ).map(i => i.industria)
    return active
  }

  return (
    <>
      <PaywallModal 
        isOpen={showPaywall} 
        onClose={() => setShowPaywall(false)} 
        title={paywallTitle} 
        message={paywallMessage} 
      />
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
              value: selectedRow.paises.length > 0 ? selectedRow.paises.join(', ') : 'No especificados'
            },
            {
              label: 'Empresas / Clientes',
              count: selectedRow.empresas.length,
              value: selectedRow.empresas.length > 0 ? selectedRow.empresas.join(', ') : 'No especificadas'
            },
            {
              label: 'Firmas Asesoras',
              count: selectedRow.firmas.length,
              value: selectedRow.firmas.length > 0 ? selectedRow.firmas.join(', ') : 'No especificadas'
            }
          ]}
        />
      )}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 items-stretch">
        <div className="bg-surface rounded-2xl p-6 shadow-sm border border-border flex flex-col justify-between">
          <div>
            <div className="flex items-center gap-3 text-muted-foreground mb-2">
              <FileText className="h-5 w-5" />
              <h3 className="text-sm font-semibold">Total Transacciones Globales</h3>
            </div>
            <p className="text-3xl font-bold text-foreground">{totalTransactions.toLocaleString()}</p>
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
            <p className="text-3xl font-bold text-foreground">{totalIndustries}</p>
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

      <div className="bg-surface rounded-2xl p-6 shadow-sm border border-border relative flex flex-col items-center justify-center">
        <div className="w-full flex justify-between items-center mb-2">
          <div>
            <h3 className="text-lg font-semibold text-foreground">Distribución Geográfica de Industrias</h3>
            <span className="text-xs text-muted-foreground">Colores resaltan países con operaciones filtradas activas</span>
          </div>
          <button 
            onClick={() => setIsMapExpanded(!isMapExpanded)}
            className="text-xs font-semibold text-[#E05C50] hover:text-[#D92B4F] transition-colors flex items-center gap-1 bg-brand/10 px-3 py-1.5 rounded-lg"
          >
            {isMapExpanded ? (
              <><ChevronUp className="h-4 w-4" /> Ocultar Mapa</>
            ) : (
              <><ChevronDown className="h-4 w-4" /> Mostrar Mapa</>
            )}
          </button>
        </div>
        {isMapExpanded && (
        <div className="w-full h-[400px] bg-[#f8f9fa] rounded-xl overflow-hidden relative animate-in slide-in-from-top-2 fade-in duration-300">
          {isMounted && (
            <ComposableMap projection="geoMercator" projectionConfig={{scale: 130}} width={800} height={400} className="w-full h-full">
            <Geographies geography={geoUrl}>
              {({ geographies }) =>
                geographies.map((geo) => {
                  const geoName = geo.properties?.name;
                  const spanishNames = mapGeoToSpanish[geoName] || [geoName];
                  
                  const activeInds = getActiveIndustriesForCountry(spanishNames)
                  const isActive = activeInds.length > 0
                  
                  return (
                    <Geography
                      key={geo.rsmKey}
                      geography={geo}
                      fill={isActive ? "#E05C50" : "#D6D6DA"}
                      stroke="#FFFFFF"
                      strokeWidth={0.5}
                      onMouseEnter={(e) => {
                        if (isActive) {
                          setTooltipContent({
                            name: spanishNames[0],
                            activeIndustries: activeInds,
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
                        default: { fill: isActive ? "#E05C50" : "#D6D6DA", outline: "none", transition: "all 0.3s" },
                        hover: { fill: isActive ? "#c94b40" : "#F53", outline: "none", transition: "all 0.3s" },
                        pressed: { outline: "none" },
                      }}
                    />
                  );
                })
              }
            </Geographies>
          </ComposableMap>
          )}

          {tooltipContent && (
            <div 
              className="fixed z-[100] bg-[#1C1F33] text-white p-3 rounded-lg shadow-xl border border-white/10 pointer-events-none max-w-[250px]"
              style={{ left: tooltipContent.x + 15, top: tooltipContent.y + 15 }}
            >
              <h4 className="font-bold text-sm border-b border-white/10 pb-1 mb-2 text-[#E05C50]">{tooltipContent.name}</h4>
              <p className="text-xs text-white/60 mb-1">Industrias activas:</p>
              <ul className="text-xs space-y-1 max-h-[150px] overflow-hidden">
                {tooltipContent.activeIndustries.slice(0, 5).map(ind => (
                  <li key={ind} className="truncate">• {ind}</li>
                ))}
                {tooltipContent.activeIndustries.length > 5 && (
                  <li className="text-white/40 italic mt-1">+{tooltipContent.activeIndustries.length - 5} más...</li>
                )}
              </ul>
            </div>
          )}
        </div>
        )}
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
                    Monto Consolidado {sortConfig?.key === 'monto' ? (sortConfig.direction === 'asc' ? '↑' : '↓') : ''}
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
                    <p className="text-sm font-medium text-white max-h-32 overflow-y-auto custom-scrollbar">
                      {selectedRow.paises.join(', ') || 'No especificados'}
                    </p>
                  </div>

                  <div className="bg-white/10 rounded-xl p-3 backdrop-blur-sm border border-white/5">
                    <div className="flex items-center gap-2 text-white/60 mb-1">
                      <Building2 className="h-4 w-4" />
                      <span className="text-xs font-semibold">Empresas / Clientes ({selectedRow.empresas.length})</span>
                    </div>
                    <p className="text-sm font-medium text-white max-h-32 overflow-y-auto custom-scrollbar leading-relaxed">
                      {selectedRow.empresas.slice(0, 15).join(', ')}
                      {selectedRow.empresas.length > 15 && <span className="text-white/50 italic"> y {selectedRow.empresas.length - 15} más...</span>}
                      {selectedRow.empresas.length === 0 && 'No especificadas'}
                    </p>
                  </div>

                  <div className="bg-white/10 rounded-xl p-3 backdrop-blur-sm border border-white/5">
                    <div className="flex items-center gap-2 text-white/60 mb-1">
                      <Users className="h-4 w-4" />
                      <span className="text-xs font-semibold">Firmas Asesoras ({selectedRow.firmas.length})</span>
                    </div>
                    <p className="text-sm font-medium text-white max-h-32 overflow-y-auto custom-scrollbar leading-relaxed">
                      {selectedRow.firmas.slice(0, 15).join(', ')}
                      {selectedRow.firmas.length > 15 && <span className="text-white/50 italic"> y {selectedRow.firmas.length - 15} más...</span>}
                      {selectedRow.firmas.length === 0 && 'No especificadas'}
                    </p>
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
