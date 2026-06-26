'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { cn } from '@/lib/utils'
import { BarChart3, Users, Settings, Target, Mail } from 'lucide-react'

const adminNav = [
  { name: 'Dashboard', href: '/dashboard/admin', icon: BarChart3 },
  { name: 'Control de Usuarios', href: '/dashboard/admin/users', icon: Users },
  { name: 'Configuración de Sistema', href: '/dashboard/admin/settings', icon: Settings },
  { name: 'Marketing y Tracking', href: '/dashboard/admin/marketing', icon: Target },
  { name: 'SMTP y Correos', href: '/dashboard/admin/smtp', icon: Mail },
]

export default function AdminNav({ userRole }: { userRole: string }) {
  const pathname = usePathname()

  const filteredNav = adminNav.filter((item) => {
    const isSuperAdminOnly = ['Configuración de Sistema', 'Marketing y Tracking', 'SMTP y Correos'].includes(item.name)
    if (isSuperAdminOnly && userRole !== 'SUPERADMIN') return false
    return true
  })

  return (
    <div className="border-b border-border">
      <nav className="-mb-px flex space-x-8" aria-label="Tabs">
        {filteredNav.map((item) => {
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
  )
}
