'use client'

import { useState } from 'react'
import { Filter, Building2, Briefcase, ChevronRight, X, ArrowUpRight } from 'lucide-react'

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

  return (
    <>
      <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-6 gap-4 mb-6 bg-surface rounded-2xl p-6 shadow-sm border border-border">
        {/* Same filters as before, but purely UI for now unless we add filtering state */}
        <div className="col-span-full flex items-center gap-2 mb-2 text-foreground font-semibold">
          <Filter className="h-5 w-5" /> Filtros Avanzados
        </div>
        {/* Simplified filters for UI only */}
        <div>
          <label className="block text-xs font-medium text-foreground/70 mb-1">Tipo de Operación</label>
          <select className="w-full rounded-lg border-border bg-background text-sm p-2 outline-none"><option>Todos</option></select>
        </div>
        <div>
          <label className="block text-xs font-medium text-foreground/70 mb-1">Industria</label>
          <select className="w-full rounded-lg border-border bg-background text-sm p-2 outline-none"><option>Todas</option></select>
        </div>
        <div>
          <label className="block text-xs font-medium text-foreground/70 mb-1">Buscar</label>
          <input type="text" placeholder="Empresa o título..." className="w-full rounded-lg border border-border bg-background text-sm p-2 outline-none" />
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6 flex-1">
        <div className="lg:col-span-3 bg-surface rounded-2xl shadow-sm border border-border overflow-hidden flex flex-col h-[600px] overflow-y-auto">
          <table className="min-w-full divide-y divide-border">
            <thead className="bg-muted sticky top-0">
              <tr>
                <th className="px-6 py-4 text-left text-xs font-semibold text-foreground/70 uppercase tracking-wider">Fecha</th>
                <th className="px-6 py-4 text-left text-xs font-semibold text-foreground/70 uppercase tracking-wider">Título</th>
                <th className="px-6 py-4 text-left text-xs font-semibold text-foreground/70 uppercase tracking-wider">Tipo</th>
                <th className="px-6 py-4 text-right text-xs font-semibold text-foreground/70 uppercase tracking-wider">Monto</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border bg-surface">
              {transactions.map((tx) => (
                <tr key={tx.id} className="hover:bg-muted/50 transition-colors cursor-pointer" onClick={() => setSelectedTx(tx)}>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-foreground/80">{tx.date}</td>
                  <td className="px-6 py-4 text-sm font-medium text-foreground max-w-[250px] truncate" title={tx.title}>{tx.title}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-foreground/80">
                    <span className="inline-flex items-center rounded-md bg-brand/10 px-2 py-1 text-xs font-medium text-brand ring-1 ring-inset ring-brand/20">
                      {tx.type}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-right text-sm text-foreground/80">{tx.amount}</td>
                </tr>
              ))}
              {transactions.length === 0 && (
                <tr><td colSpan={4} className="text-center p-8 text-muted-foreground">No hay operaciones sincronizadas aún.</td></tr>
              )}
            </tbody>
          </table>
        </div>

        <div className="lg:col-span-1 space-y-6">
          <div className="bg-surface rounded-2xl p-6 shadow-sm border border-border">
            <h3 className="text-sm font-semibold text-foreground mb-4">Resumen</h3>
            <p className="text-2xl font-bold text-foreground">{transactions.length}</p>
            <p className="text-xs text-muted-foreground">Operaciones recientes cargadas desde Drupal.</p>
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
