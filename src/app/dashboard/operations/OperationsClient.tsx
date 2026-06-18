'use client'

import { useState } from 'react'
import { Filter, Building2, Briefcase, ChevronRight, X, ArrowUpRight, ArrowUpDown, ArrowUp, ArrowDown } from 'lucide-react'

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

export default function OperationsClient({ transactions }: { transactions: UITransaction[] }) {
  const [selectedTx, setSelectedTx] = useState<UITransaction | null>(null)
  
  // Estados para los filtros
  const [selectedType, setSelectedType] = useState('Todos')
  const [selectedIndustry, setSelectedIndustry] = useState('Todas')
  const [searchQuery, setSearchQuery] = useState('')
  const [sortConfig, setSortConfig] = useState<{ key: 'date' | 'amount' | null, direction: 'asc' | 'desc' }>({ key: 'date', direction: 'desc' })

  // Extraer valores únicos para los selects
  const uniqueTypes = Array.from(new Set(transactions.map(tx => tx.type))).filter(Boolean)
  const uniqueIndustries = Array.from(new Set(transactions.map(tx => tx.industry))).filter(Boolean)

  // Lógica de filtrado
  const filteredTransactions = transactions.filter(tx => {
    const matchType = selectedType === 'Todos' || tx.type === selectedType
    const matchIndustry = selectedIndustry === 'Todas' || tx.industry === selectedIndustry
    const matchSearch = tx.title.toLowerCase().includes(searchQuery.toLowerCase()) || 
                        tx.firm.toLowerCase().includes(searchQuery.toLowerCase()) ||
                        tx.industry.toLowerCase().includes(searchQuery.toLowerCase())
    
    return matchType && matchIndustry && matchSearch
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

  const handleSort = (key: 'date' | 'amount') => {
    setSortConfig(current => ({
      key,
      direction: current.key === key && current.direction === 'desc' ? 'asc' : 'desc'
    }))
  }

  return (
    <>
      <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-6 gap-4 mb-6 bg-surface rounded-2xl p-6 shadow-sm border border-border">
        <div className="col-span-full flex items-center gap-2 mb-2 text-foreground font-semibold">
          <Filter className="h-5 w-5" /> Filtros Avanzados
        </div>
        <div>
          <label className="block text-xs font-medium text-foreground/70 mb-1">Tipo de Operación</label>
          <select 
            className="w-full rounded-lg border-border bg-background text-sm p-2 outline-none"
            value={selectedType}
            onChange={(e) => setSelectedType(e.target.value)}
          >
            <option value="Todos">Todos</option>
            {uniqueTypes.map(type => (
              <option key={type} value={type}>{type}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-xs font-medium text-foreground/70 mb-1">Industria</label>
          <select 
            className="w-full rounded-lg border-border bg-background text-sm p-2 outline-none"
            value={selectedIndustry}
            onChange={(e) => setSelectedIndustry(e.target.value)}
          >
            <option value="Todas">Todas</option>
            {uniqueIndustries.map(ind => (
              <option key={ind} value={ind}>{ind}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-xs font-medium text-foreground/70 mb-1">Buscar</label>
          <input 
            type="text" 
            placeholder="Empresa o título..." 
            className="w-full rounded-lg border border-border bg-background text-sm p-2 outline-none"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6 flex-1">
        <div className="lg:col-span-3 bg-surface rounded-2xl shadow-sm border border-border overflow-hidden flex flex-col h-[600px] overflow-y-auto">
          <table className="min-w-full divide-y divide-border">
            <thead className="bg-muted sticky top-0">
              <tr>
                <th className="px-6 py-4 text-left text-xs font-semibold text-foreground/70 uppercase tracking-wider cursor-pointer hover:bg-muted-foreground/10 transition-colors" onClick={() => handleSort('date')}>
                  <div className="flex items-center gap-1">
                    Fecha
                    {sortConfig.key === 'date' ? (sortConfig.direction === 'asc' ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />) : <ArrowUpDown className="h-3 w-3 text-muted-foreground/50" />}
                  </div>
                </th>
                <th className="px-6 py-4 text-left text-xs font-semibold text-foreground/70 uppercase tracking-wider">Título</th>
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
              {sortedTransactions.map((tx) => (
                <tr key={tx.id} className="hover:bg-muted/50 transition-colors cursor-pointer" onClick={() => setSelectedTx(tx)}>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-foreground/80">{tx.date}</td>
                  <td className="px-6 py-4 text-sm font-medium text-foreground max-w-[250px] truncate" title={tx.title}>{tx.title}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-foreground/80">
                    <span className="inline-flex items-center rounded-md bg-brand/10 px-2 py-1 text-xs font-medium text-brand ring-1 ring-inset ring-brand/20">
                      {tx.type}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-right text-sm text-foreground/80 font-medium" title="Dólares Estadounidenses (USD)">{tx.amount === 'Por definir' ? <span className="text-muted-foreground font-normal">Por definir</span> : tx.amount}</td>
                </tr>
              ))}
              {sortedTransactions.length === 0 && (
                <tr><td colSpan={4} className="text-center p-8 text-muted-foreground">No hay operaciones que coincidan con los filtros.</td></tr>
              )}
            </tbody>
          </table>
        </div>

        <div className="lg:col-span-1 space-y-6">
          <div className="bg-surface rounded-2xl p-6 shadow-sm border border-border">
            <h3 className="text-sm font-semibold text-foreground mb-4">Resumen de Búsqueda</h3>
            <p className="text-2xl font-bold text-foreground">{filteredTransactions.length}</p>
            <p className="text-xs text-muted-foreground">Operaciones coinciden con los filtros aplicados.</p>
          </div>
        </div>
      </div>

      {selectedTx && (
        <div className="fixed inset-0 z-50 flex justify-end bg-black/40 backdrop-blur-sm animate-in fade-in" onClick={() => setSelectedTx(null)}>
          <div className="w-full max-w-md bg-surface h-full shadow-2xl p-6 animate-in slide-in-from-right overflow-y-auto" onClick={e => e.stopPropagation()}>
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-xl font-bold text-foreground">Detalle de Transacción</h3>
              <button onClick={() => setSelectedTx(null)} className="p-2 text-muted-foreground hover:bg-muted rounded-full">
                <X className="h-5 w-5" />
              </button>
            </div>
            
            <div className="space-y-6">
              <div>
                <span className="inline-flex items-center rounded-md bg-brand/10 px-2 py-1 text-xs font-medium text-brand mb-2">
                  {selectedTx.type}
                </span>
                <h4 className="text-xl font-bold text-foreground leading-tight">{selectedTx.title}</h4>
                <p className="text-sm text-muted-foreground mt-1">{selectedTx.date} &middot; {selectedTx.industry}</p>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="bg-muted rounded-xl p-4">
                  <p className="text-xs font-medium text-muted-foreground mb-1">Estado</p>
                  <p className="text-lg font-bold text-foreground">{selectedTx.status}</p>
                </div>
              </div>

              <div className="border-t border-border pt-6">
                <a 
                  href={selectedTx.link} 
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex w-full items-center justify-center gap-2 rounded-xl bg-[#E05C50] px-4 py-3 text-sm font-semibold text-white shadow-sm hover:bg-[#D92B4F] transition-all"
                >
                  Leer reseña completa en LexLatin <ArrowUpRight className="h-4 w-4" />
                </a>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
