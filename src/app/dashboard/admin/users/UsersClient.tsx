'use client'

import { useState, useMemo } from 'react'
import { Search, MoreVertical, CheckCircle2, XCircle, Shield, ShieldOff, Loader2 } from 'lucide-react'
import { deactivateUser, reactivateUser } from './actions'

type UIUser = {
  id: string
  name: string
  email: string
  role: string
  status: string
  createdAt: string
}

export default function UsersClient({ initialUsers }: { initialUsers: UIUser[] }) {
  const [users, setUsers] = useState<UIUser[]>(initialUsers)
  const [searchQuery, setSearchQuery] = useState('')
  const [loadingId, setLoadingId] = useState<string | null>(null)

  const filteredUsers = useMemo(() => {
    return users.filter(u => 
      u.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
      u.email.toLowerCase().includes(searchQuery.toLowerCase())
    )
  }, [users, searchQuery])

  const handleDeactivate = async (id: string) => {
    setLoadingId(id)
    const res = await deactivateUser(id)
    if (res.success) {
      setUsers(prev => prev.map(u => u.id === id ? { ...u, status: 'CANCELED' } : u))
    }
    setLoadingId(null)
  }

  const handleReactivate = async (id: string) => {
    setLoadingId(id)
    const res = await reactivateUser(id)
    if (res.success) {
      setUsers(prev => prev.map(u => u.id === id ? { ...u, status: 'ACTIVE' } : u))
    }
    setLoadingId(null)
  }

  return (
    <div className="flex-1 flex flex-col bg-surface rounded-2xl shadow-sm border border-border overflow-hidden">
      
      {/* Buscador */}
      <div className="p-4 border-b border-border bg-muted/30">
        <div className="relative max-w-md">
          <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
            <Search className="h-5 w-5 text-muted-foreground" aria-hidden="true" />
          </div>
          <input
            type="text"
            className="block w-full rounded-xl border-0 py-2.5 pl-10 pr-3 text-foreground bg-background ring-1 ring-inset ring-border placeholder:text-muted-foreground focus:ring-2 focus:ring-inset focus:ring-brand sm:text-sm sm:leading-6"
            placeholder="Buscar por nombre o correo electrónico..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
      </div>

      {/* Tabla */}
      <div className="flex-1 overflow-x-auto">
        <table className="min-w-full divide-y divide-border">
          <thead className="bg-muted/50">
            <tr>
              <th scope="col" className="py-3.5 pl-4 pr-3 text-left text-sm font-semibold text-foreground sm:pl-6">
                Usuario
              </th>
              <th scope="col" className="px-3 py-3.5 text-left text-sm font-semibold text-foreground">
                Rol
              </th>
              <th scope="col" className="px-3 py-3.5 text-left text-sm font-semibold text-foreground">
                Estado Suscripción
              </th>
              <th scope="col" className="px-3 py-3.5 text-left text-sm font-semibold text-foreground">
                Fecha Registro
              </th>
              <th scope="col" className="relative py-3.5 pl-3 pr-4 sm:pr-6">
                <span className="sr-only">Acciones</span>
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border bg-transparent">
            {filteredUsers.map((user) => (
              <tr key={user.id} className="hover:bg-muted/30 transition-colors">
                <td className="whitespace-nowrap py-4 pl-4 pr-3 text-sm sm:pl-6">
                  <div className="flex items-center">
                    <div className="h-10 w-10 flex-shrink-0 rounded-full bg-brand/10 flex items-center justify-center font-bold text-brand uppercase">
                      {user.name.charAt(0) || user.email.charAt(0)}
                    </div>
                    <div className="ml-4">
                      <div className="font-medium text-foreground">{user.name}</div>
                      <div className="text-muted-foreground">{user.email}</div>
                    </div>
                  </div>
                </td>
                <td className="whitespace-nowrap px-3 py-4 text-sm text-muted-foreground">
                  {user.role === 'ADMIN' ? (
                    <span className="inline-flex items-center gap-1.5 rounded-md bg-purple-500/10 px-2 py-1 text-xs font-medium text-purple-600 ring-1 ring-inset ring-purple-500/20">
                      <Shield className="h-3 w-3" /> Admin
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1.5 rounded-md bg-gray-500/10 px-2 py-1 text-xs font-medium text-gray-600 ring-1 ring-inset ring-gray-500/20">
                      Usuario
                    </span>
                  )}
                </td>
                <td className="whitespace-nowrap px-3 py-4 text-sm text-muted-foreground">
                  {user.status === 'ACTIVE' && <span className="inline-flex items-center gap-1.5 rounded-md bg-green-500/10 px-2 py-1 text-xs font-medium text-green-600 ring-1 ring-inset ring-green-500/20">Activa</span>}
                  {user.status === 'TRIAL' && <span className="inline-flex items-center gap-1.5 rounded-md bg-yellow-500/10 px-2 py-1 text-xs font-medium text-yellow-600 ring-1 ring-inset ring-yellow-500/20">Prueba</span>}
                  {user.status === 'CANCELED' && <span className="inline-flex items-center gap-1.5 rounded-md bg-red-500/10 px-2 py-1 text-xs font-medium text-red-600 ring-1 ring-inset ring-red-500/20">Cancelada</span>}
                  {user.status === 'INCOMPLETE' && <span className="inline-flex items-center gap-1.5 rounded-md bg-gray-500/10 px-2 py-1 text-xs font-medium text-gray-600 ring-1 ring-inset ring-gray-500/20">Incompleta</span>}
                  {user.status === 'PAST_DUE' && <span className="inline-flex items-center gap-1.5 rounded-md bg-orange-500/10 px-2 py-1 text-xs font-medium text-orange-600 ring-1 ring-inset ring-orange-500/20">Atrasada</span>}
                </td>
                <td className="whitespace-nowrap px-3 py-4 text-sm text-muted-foreground">
                  {new Date(user.createdAt).toLocaleDateString('es-ES')}
                </td>
                <td className="relative whitespace-nowrap py-4 pl-3 pr-4 text-right text-sm font-medium sm:pr-6">
                  {loadingId === user.id ? (
                    <Loader2 className="h-5 w-5 animate-spin text-muted-foreground inline-block" />
                  ) : (
                    <>
                      {user.status === 'CANCELED' ? (
                        <button
                          onClick={() => handleReactivate(user.id)}
                          className="text-brand hover:text-brand-hover flex items-center justify-end gap-1.5 w-full"
                          title="Reactivar Usuario"
                        >
                          <CheckCircle2 className="h-4 w-4" /> Reactivar
                        </button>
                      ) : (
                        <button
                          onClick={() => handleDeactivate(user.id)}
                          className="text-[#E05C50] hover:text-[#E05C50]/80 flex items-center justify-end gap-1.5 w-full"
                          title="Desactivar Usuario"
                        >
                          <XCircle className="h-4 w-4" /> Desactivar
                        </button>
                      )}
                    </>
                  )}
                </td>
              </tr>
            ))}
            {filteredUsers.length === 0 && (
              <tr>
                <td colSpan={5} className="py-10 text-center text-muted-foreground text-sm">
                  No se encontraron usuarios.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
