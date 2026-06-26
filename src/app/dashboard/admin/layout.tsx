import AdminNav from './AdminNav'
import { createClient } from '@/utils/supabase/server'
import prisma from '@/lib/prisma'

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  let userRole = 'USER'

  if (user?.email) {
    const dbUser = await prisma.user.findUnique({ where: { email: user.email } })
    if (dbUser) {
      userRole = dbUser.role
    }
  }

  return (
    <div className="flex flex-col h-full space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-700">
      <div>
        <h2 className="text-3xl font-bold tracking-tight text-foreground">Administración del SaaS</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          Supervisa métricas de negocio, gestiona el acceso de los clientes y ajusta la configuración global.
        </p>
      </div>

      <AdminNav userRole={userRole} />

      <div className="flex-1 overflow-y-auto pb-8">
        {children}
      </div>
    </div>
  )
}
