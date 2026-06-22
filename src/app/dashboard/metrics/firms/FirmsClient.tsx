'use client'

import { useState, useMemo } from 'react'
import Link from 'next/link'
import { Building2, Users, FileText, ArrowUpRight, X, Globe, Gavel, Calendar, Search, Filter, ChevronRight, ChevronLeft, ArrowUpDown } from 'lucide-react'

interface TableRow {
  id: string
  firma: string
  monto: string
  volumen: number | null
  tipoOperacion: string
  pais: string
  abogados: string
  industria: string
  empresa: string
  fecha: string | null
  transactionId: string
}

interface FirmsClientProps {
  totalTransactions: number
  totalFirms: number
  topFirmsList: { name: string, deals: number }[]
  tableData: TableRow[]
}

export default function FirmsClient({ totalTransactions, totalFirms, topFirmsList, tableData }: FirmsClientProps) {
  const [isRankingModalOpen, setIsRankingModalOpen] = useState(false)
  const [filterType, setFilterType] = useState<string>('Todas')
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedRow, setSelectedRow] = useState<TableRow | null>(null)
  
  // Nuevos estados para UX
  const [isPanelExpanded, setIsPanelExpanded] = useState(true)
  const [sortConfig, setSortConfig] = useState<{key: 'firma' | 'monto' | 'volumen', direction: 'asc' | 'desc'} | null>(null)
  const [currentPage, setCurrentPage] = useState(1)
  const itemsPerPage = 50

  // Opciones de filtro
  const filterOptions = ['Todas', 'M&A', 'Financiamientos', 'Emisiones']

  // Filtrado y ordenamiento de la tabla
  const filteredData = useMemo(() => {
    let result = tableData.filter(row => {
      const matchesType = filterType === 'Todas' || row.tipoOperacion === filterType
      const matchesSearch = row.firma.toLowerCase().includes(searchQuery.toLowerCase()) || 
                            row.monto.toLowerCase().includes(searchQuery.toLowerCase())
      return matchesType && matchesSearch
    })

    if (sortConfig) {
      result.sort((a, b) => {
        if (sortConfig.key === 'firma') {
          return sortConfig.direction === 'asc' 
            ? a.firma.localeCompare(b.firma) 
            : b.firma.localeCompare(a.firma)
        } else if (sortConfig.key === 'monto') {
          // Extraemos números básicos del monto en texto para ordenar aproximado (ej: $100.0M -> 100)
          const numA = parseFloat(a.monto.replace(/[^0-9.-]+/g, "")) || 0
          const numB = parseFloat(b.monto.replace(/[^0-9.-]+/g, "")) || 0
          return sortConfig.direction === 'asc' ? numA - numB : numB - numA
        } else if (sortConfig.key === 'volumen') {
          const numA = a.volumen || 0
          const numB = b.volumen || 0
          return sortConfig.direction === 'asc' ? numA - numB : numB - numA
        }
        return 0
      })
    }
    return result
  }, [tableData, filterType, searchQuery, sortConfig])

  const handleSort = (key: 'firma' | 'monto' | 'volumen') => {
    let direction: 'asc' | 'desc' = 'asc'
    if (sortConfig && sortConfig.key === key && sortConfig.direction === 'asc') {
      direction = 'desc'
    }
    setSortConfig({ key, direction })
  }

  // Resetear la paginación cuando cambia algún filtro o búsqueda
  useMemo(() => {
    setCurrentPage(1)
  }, [filterType, searchQuery, sortConfig])

  // Paginación
  const paginatedData = useMemo(() => {
    const startIndex = (currentPage - 1) * itemsPerPage
    return filteredData.slice(startIndex, startIndex + itemsPerPage)
  }, [filteredData, currentPage])

  const totalPages = Math.ceil(filteredData.length / itemsPerPage)

  // Seleccionar la primera fila por defecto al cambiar filtros si hay datos
  useMemo(() => {
    if (paginatedData.length > 0 && (!selectedRow || !paginatedData.find(r => r.id === selectedRow.id))) {
      setSelectedRow(paginatedData[0])
    } else if (paginatedData.length === 0) {
      setSelectedRow(null)
    }
  }, [paginatedData])

  return (
    <>
      {/* Stats row */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 items-stretch">
        <div className="bg-surface rounded-2xl p-6 shadow-sm border border-border flex flex-col justify-between">
          <div>
            <div className="flex items-center gap-3 text-muted-foreground mb-2">
              <FileText className="h-5 w-5" />
              <h3 className="text-sm font-semibold">Total Transacciones Globales</h3>
            </div>
            <p className="text-3xl font-bold text-foreground">{totalTransactions}</p>
            <p className="text-sm text-green-600 flex items-center mt-2"><ArrowUpRight className="h-4 w-4 mr-1"/> Data sincronizada</p>
          </div>
          <button onClick={() => setFilterType('Todas')} className="mt-6 text-xs font-semibold text-[#E05C50] hover:text-[#D92B4F] transition-colors bg-brand/10 px-3 py-2 rounded-lg text-center w-full">
            Ver a detalles
          </button>
        </div>
        <div className="bg-surface rounded-2xl p-6 shadow-sm border border-border flex flex-col justify-between">
          <div>
            <div className="flex items-center gap-3 text-muted-foreground mb-2">
              <Building2 className="h-5 w-5" />
              <h3 className="text-sm font-semibold">Firmas Registradas</h3>
            </div>
            <p className="text-3xl font-bold text-foreground">{totalFirms}</p>
            <p className="text-sm text-muted-foreground mt-2">En el histórico de LexLatin</p>
          </div>
          <button onClick={() => setIsRankingModalOpen(true)} className="mt-6 text-xs font-semibold text-[#E05C50] hover:text-[#D92B4F] transition-colors bg-brand/10 px-3 py-2 rounded-lg text-center w-full">
            Ver a detalles
          </button>
        </div>
        <div className="bg-surface rounded-2xl p-6 shadow-sm border border-border">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-3 text-muted-foreground">
              <Users className="h-5 w-5" />
              <h3 className="text-sm font-semibold">Firmas Top Ranking</h3>
            </div>
            {topFirmsList.length > 0 && (
              <button 
                onClick={() => setIsRankingModalOpen(true)}
                className="text-xs font-semibold text-[#E05C50] hover:text-[#D92B4F] transition-colors bg-brand/10 px-2 py-1 rounded"
              >
                Ver todas
              </button>
            )}
          </div>
          <div className="mt-4 space-y-2">
            {topFirmsList.slice(0, 3).map((firm, i) => (
              <div key={i} className="flex justify-between items-center bg-muted p-2 rounded-lg">
                <span className="text-xs font-semibold truncate max-w-[120px]">{firm.name}</span>
                <span className="text-xs bg-surface px-2 py-1 rounded">{firm.deals} ops</span>
              </div>
            ))}
            {topFirmsList.length === 0 && (
              <p className="text-sm text-muted-foreground mt-2">Sin datos.</p>
            )}
          </div>
        </div>
      </div>

      {/* Interactive Power BI Style Section */}
      <div className="flex flex-col lg:flex-row gap-6 h-auto lg:h-[600px]">
        
        {/* Left: Table Container */}
        <div className="flex-1 bg-surface rounded-2xl shadow-sm border border-border flex flex-col overflow-hidden">
          {/* Toolbar */}
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
                  placeholder="Buscar firma o monto..." 
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  className="w-full pl-9 pr-4 py-2 text-sm bg-background border border-border rounded-xl focus:outline-none focus:ring-2 focus:ring-[#E05C50]/20 focus:border-[#E05C50] transition-all"
                />
              </div>
              <button 
                onClick={() => setIsPanelExpanded(!isPanelExpanded)}
                className="p-2 border border-border bg-background rounded-xl text-muted-foreground hover:bg-muted transition-colors lg:hidden"
                title={isPanelExpanded ? "Ocultar panel" : "Mostrar panel"}
              >
                {isPanelExpanded ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
              </button>
            </div>
          </div>

          {/* Table */}
          <div className="flex-1 overflow-auto">
            <table className="w-full text-left border-collapse min-w-[500px]">
              <thead className="sticky top-0 bg-surface z-10 shadow-sm">
                <tr>
                  <th 
                    className="px-6 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider border-b border-border bg-muted/50 cursor-pointer hover:bg-muted transition-colors group"
                    onClick={() => handleSort('firma')}
                  >
                    <div className="flex items-center gap-2">
                      Firma
                      <ArrowUpDown className={`h-3 w-3 ${sortConfig?.key === 'firma' ? 'text-[#E05C50]' : 'opacity-0 group-hover:opacity-100 transition-opacity'}`} />
                    </div>
                  </th>
                  <th 
                    className="px-6 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider border-b border-border bg-muted/50 cursor-pointer hover:bg-muted transition-colors group"
                    onClick={() => handleSort('monto')}
                  >
                    <div className="flex items-center gap-2">
                      Monto
                      <ArrowUpDown className={`h-3 w-3 ${sortConfig?.key === 'monto' ? 'text-[#E05C50]' : 'opacity-0 group-hover:opacity-100 transition-opacity'}`} />
                    </div>
                  </th>
                  <th 
                    className="px-6 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider border-b border-border bg-muted/50 text-right cursor-pointer hover:bg-muted transition-colors group"
                    onClick={() => handleSort('volumen')}
                  >
                    <div className="flex items-center justify-end gap-2">
                      Volumen Consolidado
                      <ArrowUpDown className={`h-3 w-3 ${sortConfig?.key === 'volumen' ? 'text-[#E05C50]' : 'opacity-0 group-hover:opacity-100 transition-opacity'}`} />
                    </div>
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {paginatedData.map(row => (
                  <tr 
                    key={row.id} 
                    onClick={() => setSelectedRow(row)}
                    className={`cursor-pointer transition-colors hover:bg-muted/50 ${selectedRow?.id === row.id ? 'bg-[#E05C50]/5 border-l-4 border-l-[#E05C50]' : 'border-l-4 border-l-transparent'}`}
                  >
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div className={`h-8 w-8 rounded flex items-center justify-center shrink-0 ${selectedRow?.id === row.id ? 'bg-[#E05C50] text-white' : 'bg-muted text-muted-foreground'}`}>
                          <Building2 className="h-4 w-4" />
                        </div>
                        <span className={`text-sm font-medium ${selectedRow?.id === row.id ? 'text-[#E05C50]' : 'text-foreground'}`}>
                          {row.firma}
                        </span>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-sm text-foreground">{row.monto}</td>
                    <td className="px-6 py-4 text-sm text-muted-foreground text-right italic">En desarrollo</td>
                  </tr>
                ))}
                {paginatedData.length === 0 && (
                  <tr>
                    <td colSpan={3} className="px-6 py-12 text-center text-muted-foreground text-sm">
                      No se encontraron resultados para los filtros seleccionados.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
          
          {/* Pagination Controls */}
          {totalPages > 1 && (
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

        {/* Right: Dynamic Details Panel */}
        {isPanelExpanded ? (
          <div className="w-full lg:w-[320px] shrink-0 flex flex-col gap-4 relative animate-in slide-in-from-right-4 duration-300">
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
              <div className="absolute top-0 right-0 -mr-8 -mt-8 w-32 h-32 rounded-full bg-white/5 blur-2xl"></div>
            
            {selectedRow ? (
              <>
                <div className="mb-6 z-10">
                  <h3 className="text-xs uppercase tracking-widest text-white/60 font-semibold mb-1">Detalle de Operación</h3>
                  <p className="text-lg font-bold leading-tight line-clamp-2">{selectedRow.firma}</p>
                  <span className="inline-block mt-3 px-2 py-1 bg-[#E05C50] text-white text-xs font-bold rounded">
                    {selectedRow.tipoOperacion}
                  </span>
                </div>

                <div className="space-y-4 flex-1 overflow-y-auto z-10 custom-scrollbar pr-2">
                  {/* País */}
                  <div className="bg-white/10 rounded-xl p-3 backdrop-blur-sm border border-white/5">
                    <div className="flex items-center gap-2 text-white/60 mb-1">
                      <Globe className="h-4 w-4" />
                      <span className="text-xs font-semibold">País Involucrado</span>
                    </div>
                    <p className="text-sm font-medium text-white">{selectedRow.pais}</p>
                  </div>

                  {/* Abogados */}
                  <div className="bg-white/10 rounded-xl p-3 backdrop-blur-sm border border-white/5">
                    <div className="flex items-center gap-2 text-white/60 mb-1">
                      <Gavel className="h-4 w-4" />
                      <span className="text-xs font-semibold">Abogados Involucrados</span>
                    </div>
                    <p className="text-sm font-medium text-white">{selectedRow.abogados}</p>
                  </div>

                  {/* Empresa */}
                  <div className="bg-white/10 rounded-xl p-3 backdrop-blur-sm border border-white/5">
                    <div className="flex items-center gap-2 text-white/60 mb-1">
                      <Building2 className="h-4 w-4" />
                      <span className="text-xs font-semibold">Empresa / Cliente</span>
                    </div>
                    <p className="text-sm font-medium text-white">{selectedRow.empresa}</p>
                  </div>

                  {/* Industria */}
                  <div className="bg-white/10 rounded-xl p-3 backdrop-blur-sm border border-white/5">
                    <div className="flex items-center gap-2 text-white/60 mb-1">
                      <FileText className="h-4 w-4" />
                      <span className="text-xs font-semibold">Industria</span>
                    </div>
                    <p className="text-sm font-medium text-white">{selectedRow.industria}</p>
                  </div>

                  {/* Fecha */}
                  <div className="bg-white/10 rounded-xl p-3 backdrop-blur-sm border border-white/5">
                    <div className="flex items-center gap-2 text-white/60 mb-1">
                      <Calendar className="h-4 w-4" />
                      <span className="text-xs font-semibold">Fecha de Anuncio</span>
                    </div>
                    <p className="text-sm font-medium text-white">
                      {selectedRow.fecha ? new Date(selectedRow.fecha).toLocaleDateString('es-ES', { year: 'numeric', month: 'long', day: 'numeric' }) : 'No especificada'}
                    </p>
                  </div>
                </div>
              </>
            ) : (
              <div className="flex-1 flex flex-col items-center justify-center text-center text-white/40 z-10">
                <Search className="h-12 w-12 mb-4 opacity-50" />
                <p className="text-sm">Selecciona una firma en la tabla para ver los detalles de la operación.</p>
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
        <div className="fixed inset-0 z-50 flex justify-end bg-black/40 backdrop-blur-sm animate-in fade-in" onClick={() => setIsRankingModalOpen(false)}>
          <div className="w-full max-w-md bg-surface h-full shadow-2xl p-6 flex flex-col animate-in slide-in-from-right" onClick={e => e.stopPropagation()}>
            <div className="flex justify-between items-center mb-6 shrink-0">
              <div className="flex items-center gap-2">
                <Users className="h-6 w-6 text-[#E05C50]" />
                <h3 className="text-xl font-bold text-foreground">Ranking Completo de Firmas</h3>
              </div>
              <button onClick={() => setIsRankingModalOpen(false)} className="p-2 text-muted-foreground hover:bg-muted rounded-full transition-colors">
                <X className="h-5 w-5" />
              </button>
            </div>
            
            <div className="flex-1 overflow-y-auto pr-2 space-y-3">
              {topFirmsList.map((firm, i) => (
                <Link 
                  href={`/dashboard/operations?search=${encodeURIComponent(firm.name)}`}
                  key={i} 
                  className="flex justify-between items-center bg-muted p-4 rounded-xl border border-border/50 hover:border-[#E05C50]/30 hover:bg-muted/80 transition-all cursor-pointer group"
                >
                  <div className="flex items-center gap-4">
                    <span className="flex items-center justify-center h-8 w-8 rounded-full bg-background text-sm font-bold text-foreground ring-1 ring-border shadow-sm group-hover:bg-[#E05C50] group-hover:text-white transition-colors">
                      {i + 1}
                    </span>
                    <span className="text-sm font-semibold text-foreground group-hover:text-[#E05C50] transition-colors">{firm.name}</span>
                  </div>
                  <span className="text-xs font-bold bg-[#E05C50]/10 text-[#E05C50] px-3 py-1.5 rounded-md border border-[#E05C50]/20">
                    {firm.deals} ops
                  </span>
                </Link>
              ))}
              {topFirmsList.length === 0 && (
                <p className="text-sm text-muted-foreground mt-2 text-center">No hay datos de firmas disponibles.</p>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  )
}
