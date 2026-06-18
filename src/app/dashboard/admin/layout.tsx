'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { cn } from '@/lib/utils'
import { BarChart3, Users, Settings } from 'lucide-react'

const adminNav = [
  { name: 'Dashboard', href: '/dashboard/admin', icon: BarChart3 },
  { name: 'Control de Usuarios', href: '/dashboard/admin/users', icon: Users },
  { name: 'Configuración de Sistema', href: '/dashboard/admin/settings', icon: Settings },
]

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const pathname = usePathname()

  return (
    <div className="flex flex-col h-full space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-700">
      <div>
        <h2 className="text-3xl font-bold tracking-tight text-foreground">Administración del SaaS</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          Supervisa métricas de negocio, gestiona el acceso de los clientes y ajusta la configuración global.
        </p>
      </div>

      <div className="border-b border-border">
        <nav className="-mb-px flex space-x-8" aria-label="Tabs">
          {adminNav.map((item) => {
            const isActive = pathname === item.href
            return (
              <Link
                key={item.name}
                href={item.href}
                className={cn(
                  isActive
                    ? 'border-brand text-brand'
                    : 'border-transparent text-foreground/70 hover:border-border hover:text-foreground',
                  'group inline-flex items-center border-b-2 py-4 px-1 text-sm font-medium transition-colors'
                )}
                aria-current={isActive ? 'page' : undefined}
              >
                <item.icon
                  className={cn(
                    isActive ? 'text-brand' : 'text-foreground/50 group-hover:text-foreground/70',
                    '-ml-0.5 mr-2 h-5 w-5'
                  )}
                  aria-hidden="true"
                />
                {item.name}
              </Link>
            )
          })}
        </nav>
      </div>

      <div className="flex-1 overflow-y-auto pb-8">
        {children}
      </div>
    </div>
  )
}
