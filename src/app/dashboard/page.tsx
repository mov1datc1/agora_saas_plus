import { ArrowUpRight, TrendingUp, DollarSign, Activity, FileText, Briefcase, Users, Building2 } from 'lucide-react'
import Link from 'next/link'
import prisma from '@/lib/prisma'
import { TransactionsChart } from '@/components/charts/TransactionsChart'
import { IndustryDistributionChart } from '@/components/charts/IndustryDistributionChart'
import { createClient } from '@/utils/supabase/server'

export default async function DashboardPage() {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    const dbUser = user && user.email ? await prisma.user.findUnique({ where: { email: user.email }, include: { subscription: true } }) : null
    const subscription = dbUser?.subscription
    const config = await prisma.systemConfig.findUnique({ where: { id: 'global' } })

    let badgeText = "Suscripción Inactiva"
    let badgeColor = "bg-gray-50 text-gray-700 ring-gray-600/20"
    
    if (subscription) {
      if (subscription.status === 'TRIAL' && subscription.trialEndsAt) {
          const diffTime = subscription.trialEndsAt.getTime() - new Date().getTime()
          const diffDays = Math.max(0, Math.ceil(diffTime / (1000 * 60 * 60 * 24)))
          badgeText = `Prueba Activa (${diffDays} días restantes)`
          badgeColor = "bg-amber-50 text-amber-700 ring-amber-600/20"
      } else if (subscription.status === 'ACTIVE') {
          badgeText = "Suscripción Activa"
          badgeColor = "bg-green-50 text-green-700 ring-green-600/20"
      } else if (subscription.status === 'CANCELED') {
          badgeText = "Suscripción Cancelada"
          badgeColor = "bg-red-50 text-red-700 ring-red-600/20"
      }
    }

    // Obtenemos cuentas reales de Prisma
    const totalTransactionsCount = await prisma.transaction.count({
      where: {
        type: {
          not: 'Operación General'
        }
      }
    })
    const activeFirmsCount = await prisma.firm.count()
    const activeCompaniesCount = await prisma.company.count()
    const activeLawyersCount = await prisma.lawyer.count()

    // Obtenemos todas las transacciones ordenadas
    const dbTransactions = await prisma.transaction.findMany({
      where: {
        type: {
          not: 'Operación General'
        }
      },
      orderBy: { dateAnnounced: 'asc' },
      select: { id: true, title: true, type: true, valueString: true, dateAnnounced: true, status: true, industryId: true }
    })

    const stats = [
      { name: 'Operaciones Registradas', value: totalTransactionsCount.toLocaleString(), icon: Activity },
      { name: 'Firmas Participantes', value: activeFirmsCount.toLocaleString(), icon: Building2 },
      { name: 'Empresas Participantes', value: activeCompaniesCount.toLocaleString(), icon: Briefcase },
      { name: 'Abogados Participantes', value: activeLawyersCount.toLocaleString(), icon: Users },
    ]

    // 1. Agrupación Histórica (Todos los tiempos)
    const groupedData: Record<string, number> = {}
    dbTransactions.forEach(tx => {
      if (!tx.dateAnnounced) return
      const month = tx.dateAnnounced.toLocaleString('es-ES', { month: 'short' })
      const year = tx.dateAnnounced.getFullYear()
      const key = `${month} ${year}`
      
      if (!groupedData[key]) {
        groupedData[key] = 0
      }
      groupedData[key] += 1
    })

    const chartData = Object.keys(groupedData).map(key => ({
      name: key,
      transacciones: groupedData[key]
    }))

    // 2. Data para Gráfico de Industrias
    const dbIndustries = await prisma.industry.findMany({
      include: { _count: { select: { transactions: true } } }
    })
    
    const industryChartData = dbIndustries
      .map(ind => ({
        name: ind.name,
        count: ind._count.transactions
      }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10) // Mostrar Top 10 para evitar saturación del gráfico

    // 3. Las 5 transacciones recientes para la lista
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
        id: "1",
        title: 'Adquisición de StartUp Tech Latam',
        type: 'M&A',
        value: '$45.0M',
        date: '10 Jun 2026',
        status: 'Completada',
      }
    ]

    return (
      <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-3xl font-bold tracking-tight text-gray-900">Bienvenido a Ágora</h2>
            <p className="mt-2 text-sm text-gray-500">
              Aquí tienes un resumen de la actividad transaccional más reciente.
            </p>
          </div>
          <div className="flex items-center gap-4">
            <span className={`inline-flex items-center rounded-full px-3 py-1 text-sm font-medium ring-1 ring-inset ${badgeColor}`}>
              {badgeText}
            </span>
          </div>
        </div>

        {/* Stats Grid */}
        {dbUser && (dbUser.role === 'ADMIN' || dbUser.role === 'SUPERADMIN' || (config && config.showGlobalMetricsToUsers)) && (
          <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
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
                </dd>
              </div>
            ))}
          </div>
        )}

        <div className="grid grid-cols-1 gap-8 lg:grid-cols-2">
          {/* Main Chart Area */}
          <div className="rounded-2xl bg-white p-6 shadow-sm ring-1 ring-gray-100 flex flex-col">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-lg font-semibold leading-6 text-gray-900">Volumen Transaccional Histórico</h3>
              <Link href="/dashboard/operations" className="text-sm font-medium text-[#E05C50] hover:text-[#c94b40] transition-colors">Detalles</Link>
            </div>
            <div className="flex-1 w-full min-h-[300px] mt-4">
              <TransactionsChart data={chartData} />
            </div>
          </div>

          {/* Industry Chart Area */}
          <div className="rounded-2xl bg-white p-6 shadow-sm ring-1 ring-gray-100 flex flex-col">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-lg font-semibold leading-6 text-gray-900">Top Industrias Activas</h3>
            </div>
            <div className="flex-1 w-full min-h-[300px] mt-4">
              <IndustryDistributionChart data={industryChartData} />
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-8">
          {/* Recent Activity List */}
          <div className="rounded-2xl bg-white p-6 shadow-sm ring-1 ring-gray-100">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-lg font-semibold leading-6 text-gray-900">Últimas Transacciones</h3>
            </div>
            <div className="flow-root">
              <ul role="list" className="-mb-8">
                {recentTransactions.map((transaction, eventIdx) => (
                  <li key={transaction.id}>
                    <Link href={`/dashboard/operations?search=${encodeURIComponent(transaction.title)}`} className="group relative pb-8 block">
                      {eventIdx !== recentTransactions.length - 1 ? (
                        <span className="absolute left-5 top-5 -ml-px h-full w-0.5 bg-gray-200" aria-hidden="true" />
                      ) : null}
                      <div className="relative flex items-start space-x-3 hover:bg-gray-50 p-2 -ml-2 rounded-xl transition-colors">
                        <div className="relative">
                          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-red-50 ring-8 ring-white group-hover:ring-gray-50 transition-colors">
                            <FileText className="h-5 w-5 text-[#E05C50]" aria-hidden="true" />
                          </div>
                        </div>
                        <div className="min-w-0 flex-1 pt-1.5">
                          <div className="flex justify-between space-x-4">
                            <div>
                              <p className="text-sm font-semibold text-gray-900 group-hover:text-[#E05C50] transition-colors">{transaction.title}</p>
                              <p className="mt-0.5 text-xs text-gray-500">{transaction.type} &middot; {transaction.value}</p>
                            </div>
                            <div className="whitespace-nowrap text-right text-xs text-gray-500">
                              {transaction.date}
                            </div>
                          </div>
                        </div>
                      </div>
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
            <div className="mt-6">
              <Link
                href="/dashboard/operations"
                className="flex w-full items-center justify-center rounded-xl bg-gray-50 px-3 py-2 text-sm font-semibold text-gray-900 ring-1 ring-inset ring-gray-200 hover:bg-gray-100"
              >
                Ver todas las transacciones
              </Link>
            </div>
          </div>
        </div>
      </div>
    )
  } catch (error: any) {
    return (
      <div className="flex flex-col items-center justify-center h-full p-8 bg-white rounded-2xl shadow-sm border border-red-200">
        <h2 className="text-2xl font-bold text-red-600 mb-4">Error cargando el dashboard</h2>
        <p className="text-gray-700 mb-4">Ha ocurrido un problema al conectar con la base de datos o al procesar los datos.</p>
        <div className="bg-red-50 p-4 rounded-xl text-sm font-mono text-red-800 w-full overflow-auto text-left whitespace-pre-wrap border border-red-100">
          {error.message || String(error)}
        </div>
      </div>
    )
  }
}
