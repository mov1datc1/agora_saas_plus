'use client'

import { useState } from 'react'
import { Filter, Search, Building2, Briefcase, MapPin, DollarSign, Calendar, ChevronRight, X, ArrowUpRight } from 'lucide-react'
import { cn } from '@/lib/utils'

// Mock Data
const MOCK_TRANSACTIONS = [
  { id: '1', date: '10 Jun 2026', title: 'Adquisición de FinTech Latam', type: 'Adquisición', amount: '$45.0M', status: 'Completada', industry: 'Tecnología', country: 'México', firm: 'Baker McKenzie', lawyer: 'Juan Pérez' },
  { id: '2', date: '08 Jun 2026', title: 'Emisión de Bonos Verdes', type: 'Emisión', amount: '$120.0M', status: 'En Proceso', industry: 'Energía', country: 'Chile', firm: 'Carey', lawyer: 'Ana Silva' },
  { id: '3', date: '05 Jun 2026', title: 'Crédito Sindicado Infraestructura', type: 'Crédito', amount: 'No revelado', status: 'Anunciada', industry: 'Construcción', country: 'Perú', firm: 'Rodrigo, Elías & Medrano', lawyer: 'Carlos Ruiz' },
  { id: '4', date: '01 Jun 2026', title: 'Fusión de Grupos Logísticos', type: 'Adquisición', amount: '$300.0M', status: 'Completada', industry: 'Logística', country: 'Colombia', firm: 'Brigard Urrutia', lawyer: 'María Gómez' },
  { id: '5', date: '28 May 2026', title: 'Serie B Startup HealthTech', type: 'Emisión', amount: '$15.0M', status: 'Completada', industry: 'Salud', country: 'Argentina', firm: 'Marval', lawyer: 'Luis Torres' },
]

export default function OperationsPage() {
  const [selectedTx, setSelectedTx] = useState<typeof MOCK_TRANSACTIONS[0] | null>(null)

  return (
    <div className="flex flex-col h-full space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-700">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-3xl font-bold tracking-tight text-foreground">Operaciones</h2>
          <p className="mt-2 text-sm text-muted-foreground">Explora y filtra el histórico de transacciones del mercado.</p>
        </div>
      </div>

      {/* Filter Panel */}
      <div className="bg-surface rounded-2xl p-6 shadow-sm border border-border">
        <div className="flex items-center gap-2 mb-4 text-foreground font-semibold">
          <Filter className="h-5 w-5" />
          Filtros Avanzados
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-6 gap-4">
          <div>
            <label className="block text-xs font-medium text-foreground/70 mb-1">Tipo de Operación</label>
            <select className="w-full rounded-lg border-border bg-background text-sm p-2 outline-none focus:ring-1 focus:ring-brand">
              <option>Todos</option>
              <option>Adquisiciones</option>
              <option>Emisiones</option>
              <option>Créditos y financiamientos</option>
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-foreground/70 mb-1">Firma de Abogados</label>
            <select className="w-full rounded-lg border-border bg-background text-sm p-2 outline-none focus:ring-1 focus:ring-brand">
              <option>Todas</option>
              <option>Baker McKenzie</option>
              <option>Carey</option>
              <option>Brigard Urrutia</option>
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-foreground/70 mb-1">Industria</label>
            <select className="w-full rounded-lg border-border bg-background text-sm p-2 outline-none focus:ring-1 focus:ring-brand">
              <option>Todas</option>
              <option>Tecnología</option>
              <option>Energía</option>
              <option>Salud</option>
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-foreground/70 mb-1">Empresa Involucrada</label>
            <input type="text" placeholder="Buscar..." className="w-full rounded-lg border border-border bg-background text-sm p-2 outline-none focus:ring-1 focus:ring-brand" />
          </div>
          <div>
            <label className="block text-xs font-medium text-foreground/70 mb-1">Monto Mínimo</label>
            <select className="w-full rounded-lg border-border bg-background text-sm p-2 outline-none focus:ring-1 focus:ring-brand">
              <option>Cualquiera</option>
              <option>&gt; $10M</option>
              <option>&gt; $50M</option>
              <option>&gt; $100M</option>
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-foreground/70 mb-1">País</label>
            <select className="w-full rounded-lg border-border bg-background text-sm p-2 outline-none focus:ring-1 focus:ring-brand">
              <option>Todos</option>
              <option>México</option>
              <option>Colombia</option>
              <option>Chile</option>
            </select>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6 flex-1">
        {/* Main Table */}
        <div className="lg:col-span-3 bg-surface rounded-2xl shadow-sm border border-border overflow-hidden flex flex-col">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-border">
              <thead className="bg-muted">
                <tr>
                  <th className="px-6 py-4 text-left text-xs font-semibold text-foreground/70 uppercase tracking-wider">Fecha</th>
                  <th className="px-6 py-4 text-left text-xs font-semibold text-foreground/70 uppercase tracking-wider">Título de Transacción</th>
                  <th className="px-6 py-4 text-left text-xs font-semibold text-foreground/70 uppercase tracking-wider">Tipo</th>
                  <th className="px-6 py-4 text-left text-xs font-semibold text-foreground/70 uppercase tracking-wider">Monto</th>
                  <th className="px-6 py-4 text-right text-xs font-semibold text-foreground/70 uppercase tracking-wider">Detalle</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border bg-surface">
                {MOCK_TRANSACTIONS.map((tx) => (
                  <tr key={tx.id} className="hover:bg-muted/50 transition-colors cursor-pointer" onClick={() => setSelectedTx(tx)}>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-foreground/80">{tx.date}</td>
                    <td className="px-6 py-4 text-sm font-medium text-foreground">{tx.title}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-foreground/80">
                      <span className="inline-flex items-center rounded-md bg-brand/10 px-2 py-1 text-xs font-medium text-brand ring-1 ring-inset ring-brand/20">
                        {tx.type}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-foreground/80">{tx.amount}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                      <button className="text-brand hover:text-brand-hover">
                        <ChevronRight className="h-5 w-5 ml-auto" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Sidebar Analytics */}
        <div className="lg:col-span-1 space-y-6">
          <div className="bg-surface rounded-2xl p-6 shadow-sm border border-border">
            <h3 className="text-sm font-semibold text-foreground mb-4">Industrias con mayor actividad</h3>
            <ul className="space-y-4">
              <li className="flex items-center justify-between text-sm">
                <span className="text-foreground/80">Tecnología</span>
                <span className="font-semibold text-foreground">34%</span>
              </li>
              <li className="flex items-center justify-between text-sm">
                <span className="text-foreground/80">Energía</span>
                <span className="font-semibold text-foreground">22%</span>
              </li>
              <li className="flex items-center justify-between text-sm">
                <span className="text-foreground/80">Financiero</span>
                <span className="font-semibold text-foreground">18%</span>
              </li>
              <li className="flex items-center justify-between text-sm">
                <span className="text-foreground/80">Infraestructura</span>
                <span className="font-semibold text-foreground">12%</span>
              </li>
            </ul>
          </div>
        </div>
      </div>

      {/* Detail Modal / Slide-over */}
      {selectedTx && (
        <div className="fixed inset-0 z-50 flex justify-end bg-black/40 backdrop-blur-sm animate-in fade-in" onClick={() => setSelectedTx(null)}>
          <div 
            className="w-full max-w-md bg-surface h-full shadow-2xl p-6 animate-in slide-in-from-right overflow-y-auto"
            onClick={e => e.stopPropagation()}
          >
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
                <p className="text-sm text-muted-foreground mt-1">{selectedTx.date} &middot; {selectedTx.country}</p>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="bg-muted rounded-xl p-4">
                  <p className="text-xs font-medium text-muted-foreground mb-1">Monto</p>
                  <p className="text-lg font-bold text-foreground">{selectedTx.amount}</p>
                </div>
                <div className="bg-muted rounded-xl p-4">
                  <p className="text-xs font-medium text-muted-foreground mb-1">Estado</p>
                  <p className="text-lg font-bold text-foreground">{selectedTx.status}</p>
                </div>
              </div>

              <div className="border-t border-border pt-4">
                <h5 className="font-semibold text-foreground flex items-center gap-2 mb-3">
                  <Building2 className="h-4 w-4 text-brand" /> Firmas Involucradas
                </h5>
                <ul className="text-sm space-y-2">
                  <li className="flex justify-between items-center bg-muted/50 p-2 rounded-lg">
                    <span>{selectedTx.firm}</span>
                    <span className="text-xs text-muted-foreground">Asesor Legal</span>
                  </li>
                  <li className="flex justify-between items-center bg-muted/50 p-2 rounded-lg">
                    <span>Otra Firma Legal LLC</span>
                    <span className="text-xs text-muted-foreground">Contraparte</span>
                  </li>
                </ul>
              </div>

              <div className="border-t border-border pt-4">
                <h5 className="font-semibold text-foreground flex items-center gap-2 mb-3">
                  <Briefcase className="h-4 w-4 text-brand" /> Abogados Clave
                </h5>
                <ul className="text-sm space-y-2">
                  <li className="bg-muted/50 p-2 rounded-lg">
                    <p className="font-medium">{selectedTx.lawyer}</p>
                    <p className="text-xs text-muted-foreground">Socio Principal</p>
                  </li>
                </ul>
              </div>

              <div className="border-t border-border pt-6">
                <a 
                  href="#" 
                  className="flex w-full items-center justify-center gap-2 rounded-xl bg-[#E05C50] px-4 py-3 text-sm font-semibold text-white shadow-sm hover:bg-[#D92B4F] transition-all"
                >
                  Leer reseña completa en LexLatin <ArrowUpRight className="h-4 w-4" />
                </a>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
