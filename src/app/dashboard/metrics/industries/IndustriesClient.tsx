'use client'

import { useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts'
import { Target, X, Briefcase } from 'lucide-react'
import { ComposableMap, Geographies, Geography } from "react-simple-maps"

const geoUrl = "https://cdn.jsdelivr.net/npm/world-atlas@2/countries-110m.json"

interface IndustriesClientProps {
  historyData: { quarter: string, volume: number }[]
  topIndustries: { name: string, deals: number }[]
  topCompany: string
  activeCountries: string[]
}

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

export default function IndustriesClient({ historyData, topIndustries, topCompany, activeCountries }: IndustriesClientProps) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const selectedIndustry = searchParams.get('industry') || 'Todas'
  const [isRankingModalOpen, setIsRankingModalOpen] = useState(false)

  const handleSelect = (val: string) => {
    if (val === 'Todas') {
      router.push('/dashboard/metrics/industries')
    } else {
      router.push(`/dashboard/metrics/industries?industry=${encodeURIComponent(val)}`)
    }
  }

  return (
    <>
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
        <div>
          <h2 className="text-3xl font-bold tracking-tight text-foreground">Métricas: Industrias</h2>
          <p className="mt-2 text-sm text-muted-foreground">Explora el desempeño, empresas activas y distribución global por sector.</p>
        </div>
        <select 
          className="rounded-lg border-border bg-surface text-sm p-2 outline-none focus:ring-1 focus:ring-brand font-medium"
          value={selectedIndustry}
          onChange={(e) => handleSelect(e.target.value)}
        >
          <option value="Todas">Todas las industrias</option>
          {topIndustries.map(ind => (
            <option key={ind.name} value={ind.name}>{ind.name}</option>
          ))}
        </select>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 flex-1">
        
        {/* Gráfico Histórico */}
        <div className="lg:col-span-2 bg-surface rounded-2xl p-6 shadow-sm border border-border flex flex-col">
          <div className="flex justify-between items-center mb-6">
            <h3 className="text-lg font-semibold text-foreground">Evolución de Transacciones Globales</h3>
          </div>
          <div className="flex-1 min-h-[300px]">
            {historyData.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={historyData}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e5e7eb" />
                  <XAxis dataKey="quarter" axisLine={false} tickLine={false} />
                  <YAxis axisLine={false} tickLine={false} allowDecimals={false} />
                  <Tooltip cursor={{fill: '#f3f4f6'}} contentStyle={{borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)'}} />
                  <Line type="monotone" dataKey="volume" name="Transacciones" stroke="#E05C50" strokeWidth={3} dot={{r: 4, fill: '#E05C50', strokeWidth: 2, stroke: '#fff'}} activeDot={{r: 6}} />
                </LineChart>
              </ResponsiveContainer>
            ) : (
              <p className="text-muted-foreground text-sm">No hay datos históricos para graficar.</p>
            )}
          </div>
        </div>

        {/* Industrias Más Activas */}
        <div className="lg:col-span-1 bg-surface rounded-2xl p-6 shadow-sm border border-border flex flex-col space-y-6">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-semibold text-foreground">Industrias Más Activas</h3>
            {topIndustries.length > 0 && (
              <button 
                onClick={() => setIsRankingModalOpen(true)}
                className="text-xs font-semibold text-[#E05C50] hover:text-[#D92B4F] transition-colors bg-brand/10 px-2 py-1 rounded"
              >
                Ver todas
              </button>
            )}
          </div>
          <div className="space-y-4">
            {topIndustries.map((ind, i) => (
              <div key={i} className="flex items-center justify-between p-3 bg-muted rounded-xl">
                <div className="flex items-center gap-3">
                  <div className="h-8 w-8 rounded-full bg-brand/10 flex items-center justify-center text-brand font-bold text-xs">{i+1}</div>
                  <div>
                    <p className="font-semibold text-sm text-foreground max-w-[150px] truncate" title={ind.name}>{ind.name}</p>
                    <p className="text-xs text-muted-foreground">{ind.deals} Operaciones</p>
                  </div>
                </div>
              </div>
            ))}
            {topIndustries.length === 0 && (
              <p className="text-sm text-muted-foreground">Sin datos registrados.</p>
            )}
          </div>
          
          <div className="border-t border-border pt-4 mt-auto">
            <h4 className="text-sm font-semibold mb-3">Empresa más activa:</h4>
            <div className="flex items-center gap-2">
              <Target className="h-4 w-4 text-brand" />
              <span className="text-sm text-foreground">{topCompany}</span>
            </div>
          </div>
        </div>

        {/* Mapa Interactivo */}
        <div className="lg:col-span-3 bg-surface rounded-2xl p-6 shadow-sm border border-border flex flex-col">
          <div className="flex justify-between items-center mb-6">
            <h3 className="text-lg font-semibold text-foreground">Mapa Interactivo de Actividad Mundial</h3>
            <span className="text-xs font-medium text-muted-foreground bg-muted px-2 py-1 rounded">Distribución del Mercado Latinoamericano</span>
          </div>
          <div className="flex-1 w-full min-h-[400px] bg-[#f8f9fa] rounded-xl overflow-hidden flex items-center justify-center relative">
            <ComposableMap projection="geoMercator" projectionConfig={{scale: 120}} width={800} height={400} className="w-full h-full">
              <Geographies geography={geoUrl}>
                {({ geographies }) =>
                  geographies.map((geo) => {
                    const geoName = geo.properties?.name;
                    const spanishNames = mapGeoToSpanish[geoName] || [geoName];
                    
                    // Comprobar si este país tiene actividad en la industria seleccionada
                    let isActive = spanishNames.some(name => activeCountries.includes(name));
                    
                    // Fallback si no hay transacciones para que se vea bien (Latam por defecto)
                    if (activeCountries.length === 0) {
                      const latAmCountries = ["Mexico", "Brazil", "Argentina", "Chile", "Colombia", "Peru", "Venezuela", "Ecuador", "Bolivia", "Paraguay", "Uruguay"];
                      isActive = latAmCountries.includes(geoName);
                    }

                    return (
                      <Geography
                        key={geo.rsmKey}
                        geography={geo}
                        fill={isActive ? "#E05C50" : "#D6D6DA"}
                        stroke="#FFFFFF"
                        strokeWidth={0.5}
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
            <div className="absolute bottom-4 left-4 bg-surface p-3 rounded-lg shadow-md border border-border text-xs">
              <div className="flex items-center gap-2 mb-1"><div className="w-3 h-3 bg-[#E05C50] rounded-full"></div> Países Involucrados</div>
              <div className="flex items-center gap-2"><div className="w-3 h-3 bg-[#D6D6DA] rounded-full"></div> Sin Operaciones</div>
            </div>
          </div>
        </div>
        
      </div>

      {isRankingModalOpen && (
        <div className="fixed inset-0 z-50 flex justify-end bg-black/40 backdrop-blur-sm animate-in fade-in" onClick={() => setIsRankingModalOpen(false)}>
          <div className="w-full max-w-md bg-surface h-full shadow-2xl p-6 flex flex-col animate-in slide-in-from-right" onClick={e => e.stopPropagation()}>
            <div className="flex justify-between items-center mb-6 shrink-0">
              <div className="flex items-center gap-2">
                <Briefcase className="h-6 w-6 text-[#E05C50]" />
                <h3 className="text-xl font-bold text-foreground">Ranking Completo de Industrias</h3>
              </div>
              <button onClick={() => setIsRankingModalOpen(false)} className="p-2 text-muted-foreground hover:bg-muted rounded-full transition-colors">
                <X className="h-5 w-5" />
              </button>
            </div>
            
            <div className="flex-1 overflow-y-auto pr-2 space-y-3">
              {topIndustries.map((ind, i) => (
                <Link 
                  href={`/dashboard/operations?search=${encodeURIComponent(ind.name)}`}
                  key={i} 
                  className="flex justify-between items-center bg-muted p-4 rounded-xl border border-border/50 hover:border-[#E05C50]/30 hover:bg-muted/80 transition-all cursor-pointer group"
                >
                  <div className="flex items-center gap-4">
                    <span className="flex items-center justify-center h-8 w-8 rounded-full bg-background text-sm font-bold text-foreground ring-1 ring-border shadow-sm group-hover:bg-[#E05C50] group-hover:text-white transition-colors">
                      {i + 1}
                    </span>
                    <span className="text-sm font-semibold text-foreground group-hover:text-[#E05C50] transition-colors">{ind.name}</span>
                  </div>
                  <span className="text-xs font-bold bg-[#E05C50]/10 text-[#E05C50] px-3 py-1.5 rounded-md border border-[#E05C50]/20">
                    {ind.deals} ops
                  </span>
                </Link>
              ))}
              {topIndustries.length === 0 && (
                <p className="text-sm text-muted-foreground mt-2 text-center">No hay datos de industrias disponibles.</p>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  )
}
