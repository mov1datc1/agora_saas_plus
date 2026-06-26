'use client'

import Link from 'next/link'
import Image from 'next/image'
import { usePathname, useRouter } from 'next/navigation'
import { LayoutDashboard, Users, Building2, Briefcase, Settings, LogOut, ArrowLeftRight, Sparkles, Mail } from 'lucide-react'
import { cn } from '@/lib/utils'
import { createClient } from '@/utils/supabase/client'

const navigation = [
  { name: 'Dashboard', href: '/dashboard', icon: LayoutDashboard },
  { name: 'Operaciones', href: '/dashboard/operations', icon: ArrowLeftRight },
  { name: 'Métricas: Firmas', href: '/dashboard/metrics/firms', icon: Building2 },
  { name: 'Métricas: Industrias', href: '/dashboard/metrics/industries', icon: Briefcase },
  { name: 'Métricas: Países', href: '/dashboard/metrics/countries', icon: Users },
  { name: 'Ágora Copilot', href: '/dashboard/copilot', icon: Sparkles },
  { name: 'Suscripción y Pago', href: '/dashboard/billing', icon: Briefcase },
  { name: 'Administración', href: '/dashboard/admin', icon: Settings },
  { name: 'Configuración SMTP', href: '/dashboard/admin/smtp', icon: Mail },
]

export default function Sidebar({ userRole = 'USER' }: { userRole?: string }) {
  const pathname = usePathname()
  const router = useRouter()
  const supabase = createClient()

  const handleLogout = async () => {
    await supabase.auth.signOut()
    router.push('/login')
    router.refresh()
  }

  const filteredNavigation = navigation.filter(item => {
    const isConfiguracionSmtp = item.name === 'Configuración SMTP'
    const adminOnlyModules = ['Administración', 'Suscripción y Pago']
    
    if (isConfiguracionSmtp && userRole !== 'SUPERADMIN') return false;
    if (adminOnlyModules.includes(item.name) && userRole !== 'ADMIN' && userRole !== 'SUPERADMIN') return false;
    
    return true;
  });

  return (
    <div className="flex h-full w-64 flex-col bg-surface border-r border-border shadow-sm">
      <div className="flex h-16 shrink-0 items-center px-6">
        <Image 
          src="/logo.png" 
          alt="Ágora Logo" 
          width={130} 
          height={40} 
          className="object-contain"
        />
      </div>
      <div className="flex flex-1 flex-col overflow-y-auto px-4 py-4">
        <nav className="flex-1 space-y-1">
          {filteredNavigation.map((item) => {
            const isActive = pathname === item.href
            return (
              <Link
                key={item.name}
                href={item.href}
                className={cn(
                  isActive
                    ? 'bg-brand/10 text-brand'
                    : 'text-foreground/70 hover:bg-muted hover:text-foreground',
                  'group flex items-center rounded-xl px-3 py-2.5 text-sm font-medium transition-all duration-200'
                )}
              >
                <item.icon
                  className={cn(
                    isActive ? 'text-brand' : 'text-foreground/50 group-hover:text-foreground',
                    'mr-3 h-5 w-5 flex-shrink-0 transition-colors'
                  )}
                  aria-hidden="true"
                />
                <span className="flex items-center gap-2">
                  {item.name}
                  {item.name === 'Ágora Copilot' && (
                    <span className="inline-flex items-center rounded-full bg-red-100 px-1.5 py-0.5 text-[10px] font-medium text-red-700 ring-1 ring-inset ring-red-600/10">
                      Beta
                    </span>
                  )}
                </span>
              </Link>
            )
          })}
        </nav>
      </div>
      <div className="border-t border-border p-4">
        <button 
          onClick={handleLogout}
          className="flex w-full items-center rounded-xl px-3 py-2.5 text-sm font-medium text-foreground/70 hover:bg-muted hover:text-foreground transition-colors"
        >
          <LogOut className="mr-3 h-5 w-5 text-foreground/50" aria-hidden="true" />
          Cerrar Sesión
        </button>
      </div>
    </div>
  )
}
