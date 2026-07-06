import { redirect } from 'next/navigation'
import prisma from '@/lib/prisma'
import { createClient } from '@/utils/supabase/server'

export default async function CopilotLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user?.email) redirect('/login')

  const dbUser = await prisma.user.findUnique({
    where: { email: user.email }
  })
  
  const userRole = dbUser?.role || 'USER'

  const config = await prisma.systemConfig.findUnique({
    where: { id: 'global' }
  })

  // Block access if Copilot is disabled and user is not an admin
  if (config && !config.copilotEnabled && userRole !== 'ADMIN' && userRole !== 'SUPERADMIN') {
    redirect('/dashboard')
  }

  return <>{children}</>
}
