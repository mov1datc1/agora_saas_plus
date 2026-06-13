'use client'

import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts'
import { Building2, Users, FileText, ArrowUpRight } from 'lucide-react'

const historyData = [
  { year: '2022', transacciones: 45 },
  { year: '2023', transacciones: 60 },
  { year: '2024', transacciones: 55 },
  { year: '2025', transacciones: 80 },
  { year: '2026', transacciones: 32 },
]

const practiceData = [
  { name: 'M&A', value: 400 },
  { name: 'Mercado de Capitales', value: 300 },
  { name: 'Financiamiento', value: 300 },
  { name: 'Infraestructura', value: 200 },
]
const COLORS = ['#E05C50', '#1C1F33', '#82ca9d', '#ffc658']

export default function MetricsFirmsPage() {
  return (
    <div className="flex flex-col h-full space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-700">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-3xl font-bold tracking-tight text-foreground">Métricas: Firmas de Abogados</h2>
          <p className="mt-2 text-sm text-muted-foreground">Analiza el desempeño, histórico y clientes relevantes de las firmas top.</p>
        </div>
        <select className="rounded-lg border-border bg-surface text-sm p-2 outline-none focus:ring-1 focus:ring-brand font-medium">
          <option>Top 10 Firmas (Por volumen)</option>
          <option>Baker McKenzie</option>
          <option>Carey</option>
          <option>Brigard Urrutia</option>
        </select>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
        <div className="bg-surface rounded-2xl p-6 shadow-sm border border-border">
          <div className="flex items-center gap-3 text-muted-foreground mb-2">
            <FileText className="h-5 w-5" />
            <h3 className="text-sm font-semibold">Total Transacciones</h3>
          </div>
          <p className="text-3xl font-bold text-foreground">272</p>
          <p className="text-sm text-green-600 flex items-center mt-2"><ArrowUpRight className="h-4 w-4 mr-1"/> +15% vs año anterior</p>
        </div>
        <div className="bg-surface rounded-2xl p-6 shadow-sm border border-border">
          <div className="flex items-center gap-3 text-muted-foreground mb-2">
            <Building2 className="h-5 w-5" />
            <h3 className="text-sm font-semibold">Clientes Activos</h3>
          </div>
          <p className="text-3xl font-bold text-foreground">45</p>
          <p className="text-sm text-muted-foreground mt-2">Empresas en el portafolio</p>
        </div>
        <div className="bg-surface rounded-2xl p-6 shadow-sm border border-border">
          <div className="flex items-center gap-3 text-muted-foreground mb-2">
            <Users className="h-5 w-5" />
            <h3 className="text-sm font-semibold">Abogados Clave</h3>
          </div>
          <p className="text-3xl font-bold text-foreground">12</p>
          <p className="text-sm text-muted-foreground mt-2">Asociados en operaciones top</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 flex-1">
        {/* Histórico */}
        <div className="bg-surface rounded-2xl p-6 shadow-sm border border-border flex flex-col">
          <h3 className="text-lg font-semibold text-foreground mb-6">Histórico de Transacciones</h3>
          <div className="flex-1 min-h-[300px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={historyData}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e5e7eb" />
                <XAxis dataKey="year" axisLine={false} tickLine={false} />
                <YAxis axisLine={false} tickLine={false} />
                <Tooltip cursor={{fill: '#f3f4f6'}} contentStyle={{borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)'}} />
                <Bar dataKey="transacciones" fill="#1C1F33" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Áreas de Práctica */}
        <div className="bg-surface rounded-2xl p-6 shadow-sm border border-border flex flex-col">
          <h3 className="text-lg font-semibold text-foreground mb-6">Industrias y Áreas de Práctica Top</h3>
          <div className="flex-1 min-h-[300px] flex items-center justify-center">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={practiceData}
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={100}
                  fill="#8884d8"
                  paddingAngle={5}
                  dataKey="value"
                  label={({name, percent}) => `${name} ${((percent || 0) * 100).toFixed(0)}%`}
                >
                  {practiceData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>
        
        {/* Clientes más relevantes */}
        <div className="lg:col-span-2 bg-surface rounded-2xl p-6 shadow-sm border border-border">
          <h3 className="text-lg font-semibold text-foreground mb-4">Clientes más relevantes por periodo</h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {['TechCorp Inc.', 'Global Logistics', 'LatAm Energy', 'Financiera del Sur'].map((cliente, i) => (
              <div key={i} className="bg-muted p-4 rounded-xl flex items-center justify-between">
                <span className="font-medium text-sm">{cliente}</span>
                <span className="text-xs bg-white px-2 py-1 rounded-full shadow-sm">Recurrente</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
