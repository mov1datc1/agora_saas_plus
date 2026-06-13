'use client'

import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts'
import { Briefcase, Building2, MapPin, Target } from 'lucide-react'
import { ComposableMap, Geographies, Geography } from "react-simple-maps"

const historyData = [
  { quarter: 'Q1 2025', volume: 1.2 },
  { quarter: 'Q2 2025', volume: 2.5 },
  { quarter: 'Q3 2025', volume: 1.8 },
  { quarter: 'Q4 2025', volume: 3.4 },
  { quarter: 'Q1 2026', volume: 2.1 },
  { quarter: 'Q2 2026', volume: 4.2 },
]

const topFirms = [
  { name: 'Baker McKenzie', deals: 15, volume: '$1.2B' },
  { name: 'Carey', deals: 12, volume: '$950M' },
  { name: 'Marval', deals: 8, volume: '$400M' },
]

const geoUrl = "https://cdn.jsdelivr.net/npm/world-atlas@2/countries-110m.json"

export default function MetricsIndustriesPage() {
  return (
    <div className="flex flex-col h-full space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-700">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-3xl font-bold tracking-tight text-foreground">Métricas: Industrias</h2>
          <p className="mt-2 text-sm text-muted-foreground">Explora el desempeño, empresas activas y distribución global por sector.</p>
        </div>
        <select className="rounded-lg border-border bg-surface text-sm p-2 outline-none focus:ring-1 focus:ring-brand font-medium">
          <option>Tecnología</option>
          <option>Energía</option>
          <option>Financiero</option>
          <option>Infraestructura</option>
        </select>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 flex-1">
        
        {/* Gráfico Histórico */}
        <div className="lg:col-span-2 bg-surface rounded-2xl p-6 shadow-sm border border-border flex flex-col">
          <div className="flex justify-between items-center mb-6">
            <h3 className="text-lg font-semibold text-foreground">Evolución de Transacciones (M. USD$)</h3>
          </div>
          <div className="flex-1 min-h-[300px]">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={historyData}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e5e7eb" />
                <XAxis dataKey="quarter" axisLine={false} tickLine={false} />
                <YAxis axisLine={false} tickLine={false} tickFormatter={(val) => `$${val}B`} />
                <Tooltip cursor={{fill: '#f3f4f6'}} contentStyle={{borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)'}} />
                <Line type="monotone" dataKey="volume" stroke="#E05C50" strokeWidth={3} dot={{r: 4, fill: '#E05C50', strokeWidth: 2, stroke: '#fff'}} activeDot={{r: 6}} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Firmas Más Activas */}
        <div className="lg:col-span-1 bg-surface rounded-2xl p-6 shadow-sm border border-border flex flex-col space-y-6">
          <h3 className="text-lg font-semibold text-foreground">Firmas Más Activas</h3>
          <div className="space-y-4">
            {topFirms.map((firm, i) => (
              <div key={i} className="flex items-center justify-between p-3 bg-muted rounded-xl">
                <div className="flex items-center gap-3">
                  <div className="h-8 w-8 rounded-full bg-brand/10 flex items-center justify-center text-brand font-bold text-xs">{i+1}</div>
                  <div>
                    <p className="font-semibold text-sm text-foreground">{firm.name}</p>
                    <p className="text-xs text-muted-foreground">{firm.deals} Operaciones</p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="font-bold text-sm text-foreground">{firm.volume}</p>
                </div>
              </div>
            ))}
          </div>
          
          <div className="border-t border-border pt-4 mt-auto">
            <h4 className="text-sm font-semibold mb-3">Empresa más activa:</h4>
            <div className="flex items-center gap-2">
              <Target className="h-4 w-4 text-brand" />
              <span className="text-sm text-foreground">FinTech Global SA</span>
            </div>
          </div>
        </div>

        {/* Mapa Interactivo */}
        <div className="lg:col-span-3 bg-surface rounded-2xl p-6 shadow-sm border border-border flex flex-col">
          <div className="flex justify-between items-center mb-6">
            <h3 className="text-lg font-semibold text-foreground">Mapa Interactivo de Actividad Mundial</h3>
            <span className="text-xs font-medium text-muted-foreground bg-muted px-2 py-1 rounded">Distribución de capital (Tecnología)</span>
          </div>
          <div className="flex-1 w-full min-h-[400px] bg-[#f8f9fa] rounded-xl overflow-hidden flex items-center justify-center relative">
            <ComposableMap projection="geoMercator" projectionConfig={{scale: 120}} width={800} height={400} className="w-full h-full">
              <Geographies geography={geoUrl}>
                {({ geographies }) =>
                  geographies.map((geo) => {
                    const isLatAm = ["MEX", "BRA", "ARG", "CHL", "COL", "PER"].includes(geo.id);
                    return (
                      <Geography
                        key={geo.rsmKey}
                        geography={geo}
                        fill={isLatAm ? "#E05C50" : "#D6D6DA"}
                        stroke="#FFFFFF"
                        strokeWidth={0.5}
                        style={{
                          default: { outline: "none" },
                          hover: { fill: isLatAm ? "#c94b40" : "#F53", outline: "none" },
                          pressed: { outline: "none" },
                        }}
                      />
                    );
                  })
                }
              </Geographies>
            </ComposableMap>
            <div className="absolute bottom-4 left-4 bg-surface p-3 rounded-lg shadow-md border border-border text-xs">
              <div className="flex items-center gap-2 mb-1"><div className="w-3 h-3 bg-[#E05C50] rounded-full"></div> Alta Actividad</div>
              <div className="flex items-center gap-2"><div className="w-3 h-3 bg-[#D6D6DA] rounded-full"></div> Baja/Nula Actividad</div>
            </div>
          </div>
        </div>
        
      </div>
    </div>
  )
}
