'use client'

import { useState } from 'react'
import UsersClient from './UsersClient'
import LegacyUsersClient from './legacy/LegacyUsersClient'
import AdminsClient from './admins/AdminsClient'
import { Shield, Users, Briefcase } from 'lucide-react'

export default function AdminTabs({ 
  saasUsers, 
  legacyUsers, 
  adminUsers 
}: { 
  saasUsers: any[], 
  legacyUsers: any[], 
  adminUsers: any[] 
}) {
  const [activeTab, setActiveTab] = useState<'saas' | 'legacy' | 'admins'>('saas')

  return (
    <div className="flex flex-col h-full gap-6">
      <div className="flex space-x-1 rounded-xl bg-muted/50 p-1 border border-border w-full max-w-2xl">
        <button
          onClick={() => setActiveTab('saas')}
          className={`flex-1 flex items-center justify-center gap-2 rounded-lg px-3 py-2.5 text-sm font-medium transition-all ${
            activeTab === 'saas' 
              ? 'bg-background text-foreground shadow-sm ring-1 ring-border' 
              : 'text-muted-foreground hover:text-foreground hover:bg-muted'
          }`}
        >
          <Users className="w-4 h-4" />
          Clientes SaaS (Stripe)
        </button>
        <button
          onClick={() => setActiveTab('legacy')}
          className={`flex-1 flex items-center justify-center gap-2 rounded-lg px-3 py-2.5 text-sm font-medium transition-all ${
            activeTab === 'legacy' 
              ? 'bg-background text-foreground shadow-sm ring-1 ring-border' 
              : 'text-muted-foreground hover:text-foreground hover:bg-muted'
          }`}
        >
          <Briefcase className="w-4 h-4" />
          Clientes Acuerdos / Legacy
        </button>
        <button
          onClick={() => setActiveTab('admins')}
          className={`flex-1 flex items-center justify-center gap-2 rounded-lg px-3 py-2.5 text-sm font-medium transition-all ${
            activeTab === 'admins' 
              ? 'bg-background text-foreground shadow-sm ring-1 ring-border' 
              : 'text-muted-foreground hover:text-foreground hover:bg-muted'
          }`}
        >
          <Shield className="w-4 h-4" />
          Administradores
        </button>
      </div>

      <div className="flex-1 w-full relative">
        {activeTab === 'saas' && <UsersClient initialUsers={saasUsers} />}
        {activeTab === 'legacy' && <LegacyUsersClient initialUsers={legacyUsers} />}
        {activeTab === 'admins' && <AdminsClient initialUsers={adminUsers} />}
      </div>
    </div>
  )
}
