'use client'

import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts'
import { Building2, Briefcase, TrendingUp } from 'lucide-react'

const crossBorderData = [
  { year: '2022', domestic: 400, crossBorder: 240 },
  { year: '2023', domestic: 300, crossBorder: 139 },
  { year: '2024', domestic: 200, crossBorder: 980 },
  { year: '2025', domestic: 278, crossBorder: 390 },
  { year: '2026', domestic: 189, crossBorder: 480 },
]

export default function MetricsCountriesPage() {
  return (
    <div className="flex flex-col h-full space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-700">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-3xl font-bold tracking-tight text-foreground">Métricas: Países</h2>
          <p className="mt-2 text-sm text-muted-foreground">Analiza la actividad transaccional enfocada por región geográfica.</p>
        </div>
        <select className="rounded-lg border-border bg-surface text-sm p-2 outline-none focus:ring-1 focus:ring-brand font-medium">
          <option>Todos los Países (LatAm)</option>
          <option>México</option>
          <option>Chile</option>
          <option>Colombia</option>
          <option>Perú</option>
        </select>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 flex-1">
        
        {/* Histórico: Doméstico vs Cross-Border */}
        <div className="bg-surface rounded-2xl p-6 shadow-sm border border-border flex flex-col">
          <div className="flex justify-between items-center mb-6">
            <h3 className="text-lg font-semibold text-foreground">Doméstico vs Cross-Border</h3>
          </div>
          <div className="flex-1 min-h-[300px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={crossBorderData} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="year" axisLine={false} tickLine={false} />
                <YAxis axisLine={false} tickLine={false} />
                <Tooltip cursor={{fill: '#f3f4f6'}} contentStyle={{borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)'}} />
                <Bar dataKey="domestic" name="Doméstico" stackId="a" fill="#1C1F33" />
                <Bar dataKey="crossBorder" name="Cross-Border" stackId="a" fill="#E05C50" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Listados Top */}
        <div className="grid grid-rows-2 gap-6">
          <div className="bg-surface rounded-2xl p-6 shadow-sm border border-border">
            <h3 className="text-lg font-semibold text-foreground mb-4 flex items-center gap-2">
              <Building2 className="h-5 w-5 text-brand" /> Firmas Líderes Locales
            </h3>
            <ul className="space-y-3">
              <li className="flex justify-between items-center bg-muted p-3 rounded-xl">
                <span className="text-sm font-semibold">Firma Local A</span>
                <span className="text-xs text-muted-foreground">32 Operaciones</span>
              </li>
              <li className="flex justify-between items-center bg-muted p-3 rounded-xl">
                <span className="text-sm font-semibold">Firma Local B</span>
                <span className="text-xs text-muted-foreground">24 Operaciones</span>
              </li>
            </ul>
          </div>

          <div className="bg-surface rounded-2xl p-6 shadow-sm border border-border">
            <h3 className="text-lg font-semibold text-foreground mb-4 flex items-center gap-2">
              <Briefcase className="h-5 w-5 text-brand" /> Industrias Más Activas
            </h3>
            <ul className="space-y-3">
              <li className="flex justify-between items-center bg-muted p-3 rounded-xl">
                <span className="text-sm font-semibold">Tecnología</span>
                <span className="text-xs text-brand font-bold bg-brand/10 px-2 py-1 rounded">Alta Actividad</span>
              </li>
              <li className="flex justify-between items-center bg-muted p-3 rounded-xl">
                <span className="text-sm font-semibold">Infraestructura</span>
                <span className="text-xs text-brand font-bold bg-brand/10 px-2 py-1 rounded">Crecimiento Constante</span>
              </li>
            </ul>
          </div>
        </div>

      </div>
    </div>
  )
}
