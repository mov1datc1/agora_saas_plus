import { ArrowUpRight, TrendingUp, DollarSign, Activity, FileText } from 'lucide-react'
import prisma from '@/lib/prisma'
import { TransactionsChart } from '@/components/charts/TransactionsChart'

const stats = [
  { name: 'Nuevas Transacciones', value: '142', change: '+12.5%', icon: Activity },
  { name: 'Volumen Analizado', value: '$2.4B', change: '+8.2%', icon: DollarSign },
  { name: 'Firmas Activas', value: '89', change: '+4.1%', icon: TrendingUp },
]

export default async function DashboardPage() {
  // Obtenemos todas las transacciones para calcular volumen
  const dbTransactions = await prisma.transaction.findMany({
    orderBy: { dateAnnounced: 'asc' },
  })

  // 1. Agrupación por Mes y Año para el Gráfico
  const groupedData = dbTransactions.reduce((acc, tx) => {
    if (!tx.dateAnnounced) return acc
    const month = tx.dateAnnounced.toLocaleString('es-ES', { month: 'short' })
    const year = tx.dateAnnounced.getFullYear()
    const key = `${month} ${year}`
    
    if (!acc[key]) acc[key] = 0
    acc[key] += 1
    return acc
  }, {} as Record<string, number>)

  let chartData = Object.entries(groupedData).map(([name, transacciones]) => ({
    name,
    transacciones
  }))

  // Si no hay datos, mostramos un fallback bonito
  if (chartData.length === 0) {
    chartData = [
      { name: 'Ene', transacciones: 12 },
      { name: 'Feb', transacciones: 19 },
      { name: 'Mar', transacciones: 15 },
      { name: 'Abr', transacciones: 22 },
      { name: 'May', transacciones: 28 },
      { name: 'Jun', transacciones: 25 },
    ]
  }

  // Las 5 transacciones recientes para la lista
  const recentList = [...dbTransactions].reverse().slice(0, 5)

  const recentTransactions = recentList.length > 0 ? recentList.map(t => ({
    id: t.id,
    title: t.title,
    type: t.type || 'Operación General',
    value: t.valueString || 'No revelado',
    date: t.dateAnnounced ? t.dateAnnounced.toLocaleDateString('es-ES', { day: '2-digit', month: 'short', year: 'numeric' }) : 'N/A',
    status: t.status || 'Completada',
  })) : [
    {
      id: 1,
      title: 'Adquisición de StartUp Tech Latam',
      type: 'M&A',
      value: '$45.0M',
      date: '10 Jun 2026',
      status: 'Completada',
    },
    {
      id: 2,
      title: 'Financiamiento Serie B FinTech',
      type: 'Venture Capital',
      value: '$120.0M',
      date: '08 Jun 2026',
      status: 'En Proceso',
    },
    {
      id: 3,
      title: 'Fusión de Grupos Logísticos',
      type: 'Fusión',
      value: 'No revelado',
      date: '05 Jun 2026',
      status: 'Anunciada',
    },
    {
      id: 4,
      title: 'Emisión de Bonos Verdes',
      type: 'Mercado de Capitales',
      value: '$300.0M',
      date: '01 Jun 2026',
      status: 'Completada',
    },
  ]

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold tracking-tight text-gray-900">Bienvenido a Ágora Plus</h2>
          <p className="mt-2 text-sm text-gray-500">
            Aquí tienes un resumen de la actividad transaccional más reciente.
          </p>
        </div>
        <div className="flex items-center gap-4">
          <span className="inline-flex items-center rounded-full bg-green-50 px-3 py-1 text-sm font-medium text-green-700 ring-1 ring-inset ring-green-600/20">
            Prueba Activa (14 días restantes)
          </span>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {stats.map((item) => (
          <div
            key={item.name}
            className="relative overflow-hidden rounded-2xl bg-white p-6 shadow-sm ring-1 ring-gray-100 transition-all hover:shadow-md"
          >
            <dt>
              <div className="absolute rounded-xl bg-red-50 p-3">
                <item.icon className="h-6 w-6 text-[#E05C50]" aria-hidden="true" />
              </div>
              <p className="ml-16 truncate text-sm font-medium text-gray-500">{item.name}</p>
            </dt>
            <dd className="ml-16 flex items-baseline pb-1 sm:pb-2">
              <p className="text-3xl font-bold text-gray-900">{item.value}</p>
              <p className="ml-3 flex items-baseline text-sm font-semibold text-green-600">
                <ArrowUpRight className="h-4 w-4 flex-shrink-0 self-center text-green-500" aria-hidden="true" />
                <span className="sr-only">Increased by</span>
                {item.change}
              </p>
            </dd>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 gap-8 lg:grid-cols-3">
        {/* Main Chart Area */}
        <div className="lg:col-span-2 rounded-2xl bg-white p-6 shadow-sm ring-1 ring-gray-100 flex flex-col">
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-lg font-semibold leading-6 text-gray-900">Volumen Transaccional Histórico</h3>
            <button className="text-sm font-medium text-[#E05C50] hover:text-[#c94b40] transition-colors">Ver reporte detallado</button>
          </div>
          <div className="h-72 w-full mt-auto">
            <TransactionsChart data={chartData} />
          </div>
        </div>

        {/* Recent Activity List */}
        <div className="rounded-2xl bg-white p-6 shadow-sm ring-1 ring-gray-100">
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-lg font-semibold leading-6 text-gray-900">Últimas Transacciones</h3>
          </div>
          <div className="flow-root">
            <ul role="list" className="-mb-8">
              {recentTransactions.map((transaction, eventIdx) => (
                <li key={transaction.id}>
                  <div className="relative pb-8">
                    {eventIdx !== recentTransactions.length - 1 ? (
                      <span className="absolute left-5 top-5 -ml-px h-full w-0.5 bg-gray-200" aria-hidden="true" />
                    ) : null}
                    <div className="relative flex items-start space-x-3">
                      <div className="relative">
                        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-red-50 ring-8 ring-white">
                          <FileText className="h-5 w-5 text-[#E05C50]" aria-hidden="true" />
                        </div>
                      </div>
                      <div className="min-w-0 flex-1 pt-1.5">
                        <div className="flex justify-between space-x-4">
                          <div>
                            <p className="text-sm font-semibold text-gray-900">{transaction.title}</p>
                            <p className="mt-0.5 text-xs text-gray-500">{transaction.type} &middot; {transaction.value}</p>
                          </div>
                          <div className="whitespace-nowrap text-right text-xs text-gray-500">
                            {transaction.date}
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          </div>
          <div className="mt-6">
            <a
              href="#"
              className="flex w-full items-center justify-center rounded-xl bg-gray-50 px-3 py-2 text-sm font-semibold text-gray-900 ring-1 ring-inset ring-gray-200 hover:bg-gray-100"
            >
              Ver todas las transacciones
            </a>
          </div>
        </div>
      </div>
    </div>
  )
}
