import { redirect } from 'next/navigation'
import prisma from '@/lib/prisma'
import { createClient } from '@/utils/supabase/server'
import TeamClient from './TeamClient'

export const dynamic = 'force-dynamic'

export default async function TeamPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user?.email) redirect('/login')

  const dbUser = await prisma.user.findUnique({
    where: { email: user.email },
    include: {
      children: true
    }
  })

  if (!dbUser || dbUser.accountType !== 'CORPORATE' || dbUser.parentId) {
    redirect('/dashboard') // Solo titulares corporativos pueden entrar
  }

  const formattedChildren = dbUser.children.map((child: any) => ({
    id: child.id,
    name: child.name || 'Sin nombre',
    email: child.email,
    createdAt: child.createdAt.toISOString()
  }))

  return (
    <div className="pt-6 h-full flex flex-col">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Mi Equipo</h1>
          <p className="mt-1 text-sm text-foreground/60">
            Administra los accesos de tu firma. Tienes {5 - formattedChildren.length - 1} asientos disponibles de 5.
          </p>
        </div>
      </div>

      <div className="flex-1 overflow-hidden">
        <TeamClient teamMembers={formattedChildren} />
      </div>
    </div>
  )
}
