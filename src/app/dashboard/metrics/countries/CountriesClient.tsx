'use client'

import { useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts'
import { Building2, Briefcase } from 'lucide-react'

interface CountriesClientProps {
  crossBorderData: { year: string, count: number }[]
  topFirms: { name: string, deals: number }[]
  topIndustries: { name: string, deals: number }[]
  availableCountries: string[]
}

export default function CountriesClient({ crossBorderData, topFirms, topIndustries, availableCountries }: CountriesClientProps) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const selectedCountry = searchParams.get('country') || 'Todos'
  const selectedYear = searchParams.get('year')

  const handleSelect = (val: string) => {
    if (val === 'Todos') {
      router.push('/dashboard/metrics/countries')
    } else {
      router.push(`/dashboard/metrics/countries?country=${encodeURIComponent(val)}`)
    }
  }

  return (
    <>
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
        <div>
          <h2 className="text-3xl font-bold tracking-tight text-foreground">Métricas: Geografía</h2>
          <p className="mt-2 text-sm text-muted-foreground">Analiza la actividad transaccional del mercado globalizado.</p>
        </div>
        <select 
          className="rounded-lg border-border bg-surface text-sm p-2 outline-none focus:ring-1 focus:ring-brand font-medium"
          value={selectedCountry}
          onChange={(e) => handleSelect(e.target.value)}
        >
          <option value="Todos">Global (Todos los Países)</option>
          {availableCountries.map(country => (
            <option key={country} value={country}>{country}</option>
          ))}
        </select>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 flex-1">
        
        {/* Histórico: Volumen Transaccional */}
        <div className="bg-surface rounded-2xl p-6 shadow-sm border border-border flex flex-col">
          <div className="flex justify-between items-center mb-6">
            <h3 className="text-lg font-semibold text-foreground">Transacciones Registradas por Año</h3>
          </div>
          <div className="flex-1 min-h-[300px]">
            {crossBorderData.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={crossBorderData} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} />
                  <XAxis dataKey="year" axisLine={false} tickLine={false} />
                  <YAxis axisLine={false} tickLine={false} allowDecimals={false} />
                  <Tooltip cursor={{fill: '#f3f4f6'}} contentStyle={{borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)'}} />
                  <Bar 
                    dataKey="count" 
                    name="Operaciones" 
                    radius={[4, 4, 0, 0]}
                    onClick={(data) => {
                      if (!data || !data.year) return
                      const params = new URLSearchParams(searchParams.toString())
                      if (params.get('year') === data.year) {
                        params.delete('year')
                      } else {
                        params.set('year', data.year)
                      }
                      router.push(`/dashboard/metrics/countries?${params.toString()}`, { scroll: false })
                    }}
                  >
                    {crossBorderData.map((entry, index) => (
                      <Cell 
                        key={`cell-${index}`} 
                        fill={selectedYear === entry.year ? "#E05C50" : (selectedYear ? "#D6D6DA" : "#1C1F33")} 
                        cursor="pointer"
                        className="transition-all duration-300 hover:opacity-80"
                      />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <p className="text-sm text-muted-foreground">No hay datos históricos.</p>
            )}
          </div>
        </div>

        {/* Listados Top */}
        <div className="grid grid-rows-2 gap-6">
          <div className="bg-surface rounded-2xl p-6 shadow-sm border border-border transition-all duration-500 relative">
            {selectedYear && (
              <div className="absolute top-4 right-4 bg-[#E05C50]/10 text-[#E05C50] text-xs font-bold px-2 py-1 rounded-md animate-in fade-in">
                Filtro: {selectedYear}
              </div>
            )}
            <h3 className="text-lg font-semibold text-foreground mb-4 flex items-center gap-2">
              <Building2 className="h-5 w-5 text-brand" /> Firmas Top Registradas
            </h3>
            <ul className="space-y-3">
              {topFirms.map((firm, i) => (
                <li key={i} className="flex justify-between items-center bg-muted p-3 rounded-xl">
                  <span className="text-sm font-semibold">{firm.name}</span>
                  <span className="text-xs text-muted-foreground">{firm.deals} Operaciones</span>
                </li>
              ))}
              {topFirms.length === 0 && (
                <p className="text-xs text-muted-foreground">Datos de firmas no disponibles (Requiere actualización de ETL).</p>
              )}
            </ul>
          </div>

          <div className="bg-surface rounded-2xl p-6 shadow-sm border border-border transition-all duration-500 relative">
            {selectedYear && (
              <div className="absolute top-4 right-4 bg-[#E05C50]/10 text-[#E05C50] text-xs font-bold px-2 py-1 rounded-md animate-in fade-in">
                Filtro: {selectedYear}
              </div>
            )}
            <h3 className="text-lg font-semibold text-foreground mb-4 flex items-center gap-2">
              <Briefcase className="h-5 w-5 text-brand" /> Industrias Más Activas
            </h3>
            <ul className="space-y-3">
              {topIndustries.map((ind, i) => (
                <li key={i} className="flex justify-between items-center bg-muted p-3 rounded-xl">
                  <span className="text-sm font-semibold">{ind.name}</span>
                  <span className="text-xs text-brand font-bold bg-brand/10 px-2 py-1 rounded">{ind.deals} Operaciones</span>
                </li>
              ))}
            </ul>
          </div>
        </div>

      </div>
    </>
  )
}
