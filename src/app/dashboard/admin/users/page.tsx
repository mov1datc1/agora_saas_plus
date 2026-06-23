import prisma from '@/lib/prisma'
import AdminTabs from './AdminTabs'

export const dynamic = 'force-dynamic'

export default async function AdminUsersPage() {
  const users = await prisma.user.findMany({
    include: {
      subscription: true
    },
    orderBy: {
      createdAt: 'desc'
    }
  })

  // Format data for the client
  const formattedUsers = users.map(u => ({
    id: u.id,
    name: u.name || 'Sin nombre',
    email: u.email,
    role: u.role,
    status: u.subscription?.status || 'TRIAL',
    isActive: u.isActive,
    currentPeriodEnd: u.subscription?.currentPeriodEnd?.toISOString() || null,
    stripeCustomerId: u.stripeCustomerId,
    createdAt: u.createdAt.toISOString(),
  }))

  const adminUsers = formattedUsers.filter(u => u.role === 'ADMIN')
  const legacyUsers = formattedUsers.filter(u => u.role !== 'ADMIN' && u.status === 'ACTIVE' && !u.stripeCustomerId)
  
  // Saas users are those who are not admins, and not strictly legacy (or maybe they are stripe customers)
  // Let's just define SaaS users as those who are not ADMIN and have a stripe customer id, or are trial users, or any regular user that is not a manual active user
  const saasUsers = formattedUsers.filter(u => u.role !== 'ADMIN' && !(u.status === 'ACTIVE' && !u.stripeCustomerId))

  return (
    <div className="pt-6 h-full flex flex-col">
      <h3 className="text-xl font-bold leading-6 text-foreground mb-6">Control de Usuarios</h3>
      <AdminTabs saasUsers={saasUsers} legacyUsers={legacyUsers} adminUsers={adminUsers} />
    </div>
  )
}
