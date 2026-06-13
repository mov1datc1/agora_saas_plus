'use client'

import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts'
import { Building2, Users, FileText, ArrowUpRight } from 'lucide-react'

const COLORS = ['#E05C50', '#1C1F33', '#82ca9d', '#ffc658', '#8884d8', '#8dd1e1']

interface FirmsClientProps {
  totalTransactions: number
  totalFirms: number
  historyData: { year: string, transacciones: number }[]
  practiceData: { name: string, value: number }[]
  topFirmsList: { name: string, deals: number }[]
}

export default function FirmsClient({ totalTransactions, totalFirms, historyData, practiceData, topFirmsList }: FirmsClientProps) {
  return (
    <>
      {/* Stats row */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
        <div className="bg-surface rounded-2xl p-6 shadow-sm border border-border">
          <div className="flex items-center gap-3 text-muted-foreground mb-2">
            <FileText className="h-5 w-5" />
            <h3 className="text-sm font-semibold">Total Transacciones Globales</h3>
          </div>
          <p className="text-3xl font-bold text-foreground">{totalTransactions}</p>
          <p className="text-sm text-green-600 flex items-center mt-2"><ArrowUpRight className="h-4 w-4 mr-1"/> Data sincronizada</p>
        </div>
        <div className="bg-surface rounded-2xl p-6 shadow-sm border border-border">
          <div className="flex items-center gap-3 text-muted-foreground mb-2">
            <Building2 className="h-5 w-5" />
            <h3 className="text-sm font-semibold">Firmas Registradas</h3>
          </div>
          <p className="text-3xl font-bold text-foreground">{totalFirms}</p>
          <p className="text-sm text-muted-foreground mt-2">En el histórico de LexLatin</p>
        </div>
        <div className="bg-surface rounded-2xl p-6 shadow-sm border border-border">
          <div className="flex items-center gap-3 text-muted-foreground mb-2">
            <Users className="h-5 w-5" />
            <h3 className="text-sm font-semibold">Firmas Top Ranking</h3>
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

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 flex-1">
        {/* Histórico */}
        <div className="bg-surface rounded-2xl p-6 shadow-sm border border-border flex flex-col">
          <h3 className="text-lg font-semibold text-foreground mb-6">Histórico de Transacciones (Mercado Global)</h3>
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

        {/* Áreas de Práctica / Industrias */}
        <div className="bg-surface rounded-2xl p-6 shadow-sm border border-border flex flex-col">
          <h3 className="text-lg font-semibold text-foreground mb-6">Transacciones por Industria</h3>
          <div className="flex-1 min-h-[300px] flex items-center justify-center">
            {practiceData.length > 0 ? (
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
            ) : (
              <p className="text-muted-foreground text-sm">No hay suficientes datos de industrias para mostrar.</p>
            )}
          </div>
        </div>
      </div>
    </>
  )
}
