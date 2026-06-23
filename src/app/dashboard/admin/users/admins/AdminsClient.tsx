'use client'

import { useState, useMemo } from 'react'
import { Search, Loader2, UserPlus, Power, PowerOff, ShieldCheck } from 'lucide-react'
import { toggleUserActiveStatus } from '../user-actions'
import ConfirmModal from '@/components/ui/ConfirmModal'
import CreateManualUserModal from '../legacy/CreateManualUserModal'

type UIUser = {
  id: string
  name: string
  email: string
  role: string
  isActive: boolean
  createdAt: string
}

export default function AdminsClient({ initialUsers }: { initialUsers: UIUser[] }) {
  const [users, setUsers] = useState<UIUser[]>(initialUsers)
  const [searchQuery, setSearchQuery] = useState('')
  const [loadingId, setLoadingId] = useState<string | null>(null)
  
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false)
  const [isConfirmOpen, setIsConfirmOpen] = useState(false)
  const [confirmAction, setConfirmAction] = useState<{ id: string, activate: boolean } | null>(null)

  const filteredUsers = useMemo(() => {
    return users.filter(u => 
      u.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
      u.email.toLowerCase().includes(searchQuery.toLowerCase())
    )
  }, [users, searchQuery])

  const handleToggleActive = async () => {
    if (!confirmAction) return
    setLoadingId(confirmAction.id)
    setIsConfirmOpen(false)
    
    const res = await toggleUserActiveStatus(confirmAction.id, confirmAction.activate)
    if (res.success) {
      setUsers(prev => prev.map(u => u.id === confirmAction.id ? { ...u, isActive: confirmAction.activate } : u))
    } else {
      alert(res.error)
    }
    setLoadingId(null)
    setConfirmAction(null)
  }

  return (
    <div className="flex-1 flex flex-col bg-surface rounded-2xl shadow-sm border border-border overflow-hidden mt-4">
      <div className="p-4 border-b border-border bg-muted/30 flex flex-col sm:flex-row gap-4 items-center justify-between">
        <div className="relative w-full max-w-md">
          <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
            <Search className="h-5 w-5 text-muted-foreground" aria-hidden="true" />
          </div>
          <input
            type="text"
            className="block w-full rounded-xl border-0 py-2.5 pl-10 pr-3 text-foreground bg-background ring-1 ring-inset ring-border placeholder:text-muted-foreground focus:ring-2 focus:ring-inset focus:ring-brand sm:text-sm sm:leading-6"
            placeholder="Buscar administrador..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
        <button 
          onClick={() => setIsCreateModalOpen(true)}
          className="flex items-center gap-2 rounded-lg bg-foreground px-4 py-2.5 text-sm font-semibold text-background shadow-sm hover:bg-foreground/90 transition-colors w-full sm:w-auto"
        >
          <UserPlus className="h-4 w-4" />
          Nuevo Administrador
        </button>
      </div>

      <div className="flex-1 overflow-x-auto">
        <table className="min-w-full divide-y divide-border">
          <thead className="bg-muted/50">
            <tr>
              <th scope="col" className="py-3.5 pl-4 pr-3 text-left text-sm font-semibold text-foreground sm:pl-6">
                Usuario Admin
              </th>
              <th scope="col" className="px-3 py-3.5 text-left text-sm font-semibold text-foreground">
                Estado de Acceso
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
              <tr key={user.id} className={`hover:bg-muted/30 transition-colors ${!user.isActive ? 'opacity-70' : ''}`}>
                <td className="whitespace-nowrap py-4 pl-4 pr-3 text-sm sm:pl-6">
                  <div className="flex items-center">
                    <div className={`h-10 w-10 flex-shrink-0 rounded-full flex items-center justify-center font-bold uppercase ${user.isActive ? 'bg-purple-100 text-purple-700' : 'bg-muted text-muted-foreground'}`}>
                      <ShieldCheck className="h-5 w-5" />
                    </div>
                    <div className="ml-4">
                      <div className="font-medium text-foreground">{user.name}</div>
                      <div className="text-muted-foreground">{user.email}</div>
                    </div>
                  </div>
                </td>
                <td className="whitespace-nowrap px-3 py-4 text-sm">
                  {user.isActive ? (
                    <span className="inline-flex items-center gap-1.5 rounded-md bg-green-500/10 px-2 py-1 text-xs font-medium text-green-600 ring-1 ring-inset ring-green-500/20">
                      Acceso Total
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1.5 rounded-md bg-red-500/10 px-2 py-1 text-xs font-medium text-red-600 ring-1 ring-inset ring-red-500/20">
                      Desactivado Manual
                    </span>
                  )}
                </td>
                <td className="whitespace-nowrap px-3 py-4 text-sm text-foreground">
                  {new Date(user.createdAt).toLocaleDateString('es-ES')}
                </td>
                <td className="relative whitespace-nowrap py-4 pl-3 pr-4 text-right text-sm font-medium sm:pr-6 flex justify-end items-center">
                  {loadingId === user.id ? (
                    <Loader2 className="h-5 w-5 animate-spin text-muted-foreground inline-block" />
                  ) : (
                    <>
                      {user.isActive ? (
                        <button
                          onClick={() => {
                            setConfirmAction({ id: user.id, activate: false })
                            setIsConfirmOpen(true)
                          }}
                          className="text-[#E05C50] hover:text-[#E05C50]/80 flex items-center gap-1"
                          title="Revocar acceso de administrador"
                        >
                          <PowerOff className="h-4 w-4" /> Desactivar
                        </button>
                      ) : (
                        <button
                          onClick={() => {
                            setConfirmAction({ id: user.id, activate: true })
                            setIsConfirmOpen(true)
                          }}
                          className="text-green-600 hover:text-green-700 flex items-center gap-1"
                          title="Restaurar acceso"
                        >
                          <Power className="h-4 w-4" /> Reactivar
                        </button>
                      )}
                    </>
                  )}
                </td>
              </tr>
            ))}
            {filteredUsers.length === 0 && (
              <tr>
                <td colSpan={4} className="py-10 text-center text-muted-foreground text-sm">
                  No se encontraron administradores.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <ConfirmModal
        isOpen={isConfirmOpen}
        onClose={() => {
          setIsConfirmOpen(false)
          setConfirmAction(null)
        }}
        onConfirm={handleToggleActive}
        title={confirmAction?.activate ? "Reactivar Administrador" : "Revocar Acceso"}
        message={confirmAction?.activate 
          ? "¿Estás seguro de que deseas reactivar el acceso de administrador para este usuario?" 
          : "Al desactivar, este administrador perderá instantáneamente acceso al panel y no podrá iniciar sesión."}
        confirmText={confirmAction?.activate ? "Sí, reactivar" : "Sí, revocar acceso"}
        cancelText="Cancelar"
      />

      <CreateManualUserModal 
        isOpen={isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
        role="ADMIN"
      />
    </div>
  )
}
