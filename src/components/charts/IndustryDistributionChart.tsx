'use client'

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell
} from 'recharts'

interface IndustryDataPoint {
  name: string
  count: number
}

interface IndustryChartProps {
  data: IndustryDataPoint[]
}

const CustomTooltip = ({ active, payload, label }: any) => {
  if (active && payload && payload.length) {
    return (
      <div className="rounded-xl border border-white/20 bg-white/70 p-4 shadow-xl backdrop-blur-md ring-1 ring-gray-200">
        <p className="text-sm font-semibold text-gray-900 mb-1">{label}</p>
        <p className="text-sm text-[#E05C50] font-medium">
          {payload[0].value} {payload[0].value === 1 ? 'Transacción' : 'Transacciones'}
        </p>
      </div>
    )
  }
  return null
}

const COLORS = ['#E05C50', '#E57368', '#EA8A81', '#EFA199', '#F4B8B2']

export function IndustryDistributionChart({ data }: IndustryChartProps) {
  if (!data || data.length === 0) {
    return (
      <div className="flex h-full w-full items-center justify-center">
        <p className="text-sm text-gray-500">No hay datos de industrias.</p>
      </div>
    )
  }

  // Tomamos las top 5 industrias para no saturar el gráfico
  const sortedData = [...data].sort((a, b) => b.count - a.count).slice(0, 5)

  return (
    <ResponsiveContainer width="100%" height="100%">
      <BarChart
        data={sortedData}
        layout="vertical"
        margin={{
          top: 10,
          right: 30,
          left: 40,
          bottom: 10,
        }}
      >
        <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#E5E7EB" />
        <XAxis 
          type="number" 
          axisLine={false} 
          tickLine={false} 
          tick={{ fontSize: 12, fill: '#6B7280' }} 
        />
        <YAxis 
          dataKey="name" 
          type="category" 
          axisLine={false} 
          tickLine={false} 
          tick={{ fontSize: 11, fill: '#374151', width: 100 }} 
        />
        <Tooltip cursor={{fill: '#F3F4F6'}} content={<CustomTooltip />} />
        <Bar dataKey="count" radius={[0, 4, 4, 0]} barSize={24}>
          {sortedData.map((entry, index) => (
            <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  )
}
