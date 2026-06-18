import prisma from '@/lib/prisma'
import { Users, CreditCard, XCircle, Activity } from 'lucide-react'

export const dynamic = 'force-dynamic'

export default async function AdminDashboardPage() {
  const totalUsers = await prisma.user.count()
  const activeSubs = await prisma.subscription.count({ where: { status: 'ACTIVE' } })
  const canceledSubs = await prisma.subscription.count({ where: { status: 'CANCELED' } })
  const trialSubs = await prisma.subscription.count({ where: { status: 'TRIAL' } })

  const stats = [
    { name: 'Usuarios Totales', value: totalUsers, icon: Users, color: 'text-blue-500', bg: 'bg-blue-500/10' },
    { name: 'Suscripciones Activas', value: activeSubs, icon: Activity, color: 'text-green-500', bg: 'bg-green-500/10' },
    { name: 'En Período de Prueba', value: trialSubs, icon: CreditCard, color: 'text-yellow-500', bg: 'bg-yellow-500/10' },
    { name: 'Suscripciones Canceladas', value: canceledSubs, icon: XCircle, color: 'text-[#E05C50]', bg: 'bg-[#E05C50]/10' },
  ]

  return (
    <div className="pt-6">
      <h3 className="text-xl font-bold leading-6 text-foreground mb-6">Métricas Globales</h3>
      <dl className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
        {stats.map((item) => (
          <div
            key={item.name}
            className="relative overflow-hidden rounded-2xl bg-surface px-4 pb-12 pt-5 shadow-sm border border-border sm:px-6 sm:pt-6"
          >
            <dt>
              <div className={`absolute rounded-md p-3 ${item.bg}`}>
                <item.icon className={`h-6 w-6 ${item.color}`} aria-hidden="true" />
              </div>
              <p className="ml-16 truncate text-sm font-medium text-muted-foreground">{item.name}</p>
            </dt>
            <dd className="ml-16 flex items-baseline pb-6 sm:pb-7">
              <p className="text-2xl font-bold text-foreground">{item.value}</p>
            </dd>
          </div>
        ))}
      </dl>
    </div>
  )
}
