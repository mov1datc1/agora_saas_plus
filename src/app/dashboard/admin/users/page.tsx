import prisma from '@/lib/prisma'
import UsersClient from './UsersClient'

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
    createdAt: u.createdAt.toISOString(),
  }))

  return (
    <div className="pt-6 h-full flex flex-col">
      <h3 className="text-xl font-bold leading-6 text-foreground mb-6">Control de Usuarios</h3>
      <UsersClient initialUsers={formattedUsers} />
    </div>
  )
}
