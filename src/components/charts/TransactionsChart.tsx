'use client'

import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts'

interface ChartDataPoint {
  name: string
  transacciones: number
}

interface TransactionsChartProps {
  data: ChartDataPoint[]
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

export function TransactionsChart({ data }: TransactionsChartProps) {
  if (!data || data.length === 0) {
    return (
      <div className="flex h-full w-full items-center justify-center">
        <p className="text-sm text-gray-500">No hay datos suficientes para graficar.</p>
      </div>
    )
  }

  return (
    <ResponsiveContainer width="100%" height="100%">
      <AreaChart
        data={data}
        margin={{
          top: 10,
          right: 10,
          left: -20,
          bottom: 0,
        }}
      >
        <defs>
          <linearGradient id="colorTransacciones" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor="#E05C50" stopOpacity={0.3} />
            <stop offset="95%" stopColor="#E05C50" stopOpacity={0} />
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E5E7EB" />
        <XAxis 
          dataKey="name" 
          axisLine={false} 
          tickLine={false} 
          tick={{ fontSize: 12, fill: '#6B7280' }} 
          dy={10} 
        />
        <YAxis 
          axisLine={false} 
          tickLine={false} 
          tick={{ fontSize: 12, fill: '#6B7280' }} 
        />
        <Tooltip content={<CustomTooltip />} cursor={{ stroke: '#E05C50', strokeWidth: 1, strokeDasharray: '4 4' }} />
        <Area
          type="monotone"
          dataKey="transacciones"
          stroke="#E05C50"
          strokeWidth={3}
          fillOpacity={1}
          fill="url(#colorTransacciones)"
          activeDot={{ r: 6, fill: '#E05C50', stroke: '#fff', strokeWidth: 2 }}
        />
      </AreaChart>
    </ResponsiveContainer>
  )
}
