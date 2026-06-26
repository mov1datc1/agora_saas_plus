import prisma from '@/lib/prisma'
import { createClient } from '@/utils/supabase/server'
import AdminTabs from './AdminTabs'

export const dynamic = 'force-dynamic'

export default async function AdminUsersPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  let currentUserRole = 'USER'
  if (user?.email) {
    const dbUser = await prisma.user.findUnique({ where: { email: user.email } })
    if (dbUser) currentUserRole = dbUser.role
  }

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
    accountType: u.accountType,
    status: u.subscription?.status || 'TRIAL',
    isActive: u.isActive,
    currentPeriodEnd: u.subscription?.currentPeriodEnd?.toISOString() || null,
    stripeCustomerId: u.stripeCustomerId,
    createdAt: u.createdAt.toISOString(),
  }))

  const adminUsers = formattedUsers.filter(u => u.role === 'ADMIN' || u.role === 'SUPERADMIN')
  const legacyUsers = formattedUsers.filter(u => u.role !== 'ADMIN' && u.role !== 'SUPERADMIN' && u.status === 'ACTIVE' && !u.stripeCustomerId)
  const saasUsers = formattedUsers.filter(u => u.role !== 'ADMIN' && u.role !== 'SUPERADMIN' && !(u.status === 'ACTIVE' && !u.stripeCustomerId))

  return (
    <div className="pt-6 h-full flex flex-col">
      <h3 className="text-xl font-bold leading-6 text-foreground mb-6">Control de Usuarios</h3>
      <AdminTabs saasUsers={saasUsers} legacyUsers={legacyUsers} adminUsers={adminUsers} currentUserRole={currentUserRole} />
    </div>
  )
}
