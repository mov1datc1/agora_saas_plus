'use client'

import { useState, useMemo } from 'react'
import { Search, Loader2, UserPlus, Power, PowerOff, Calendar } from 'lucide-react'
import { toggleUserActiveStatus, updateManualSubscription } from '../user-actions'
import ConfirmModal from '@/components/ui/ConfirmModal'
import CreateManualUserModal from './CreateManualUserModal'

type UIUser = {
  id: string
  name: string
  email: string
  role: string
  status: string
  isActive: boolean
  currentPeriodEnd: string | null
  createdAt: string
}

export default function LegacyUsersClient({ initialUsers }: { initialUsers: UIUser[] }) {
  const [users, setUsers] = useState<UIUser[]>(initialUsers)
  const [searchQuery, setSearchQuery] = useState('')
  const [loadingId, setLoadingId] = useState<string | null>(null)
  
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false)
  const [isConfirmOpen, setIsConfirmOpen] = useState(false)
  const [confirmAction, setConfirmAction] = useState<{ id: string, activate: boolean } | null>(null)

  const [renewModalOpen, setRenewModalOpen] = useState(false)
  const [renewUser, setRenewUser] = useState<UIUser | null>(null)
  const [newDate, setNewDate] = useState('')

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

  const handleRenew = async () => {
    if (!renewUser || !newDate) return
    setLoadingId(renewUser.id)
    setRenewModalOpen(false)

    const res = await updateManualSubscription(renewUser.id, newDate)
    if (res.success) {
      setUsers(prev => prev.map(u => u.id === renewUser.id ? { ...u, currentPeriodEnd: new Date(newDate).toISOString(), isActive: true } : u))
    } else {
      alert(res.error)
    }
    setLoadingId(null)
    setRenewUser(null)
    setNewDate('')
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
            placeholder="Buscar usuario legacy..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
        <button 
          onClick={() => setIsCreateModalOpen(true)}
          className="flex items-center gap-2 rounded-lg bg-foreground px-4 py-2.5 text-sm font-semibold text-background shadow-sm hover:bg-foreground/90 transition-colors w-full sm:w-auto"
        >
          <UserPlus className="h-4 w-4" />
          Nuevo Usuario
        </button>
      </div>

      <div className="flex-1 overflow-x-auto">
        <table className="min-w-full divide-y divide-border">
          <thead className="bg-muted/50">
            <tr>
              <th scope="col" className="py-3.5 pl-4 pr-3 text-left text-sm font-semibold text-foreground sm:pl-6">
                Usuario
              </th>
              <th scope="col" className="px-3 py-3.5 text-left text-sm font-semibold text-foreground">
                Estado Sistema
              </th>
              <th scope="col" className="px-3 py-3.5 text-left text-sm font-semibold text-foreground">
                Vencimiento
              </th>
              <th scope="col" className="relative py-3.5 pl-3 pr-4 sm:pr-6">
                <span className="sr-only">Acciones</span>
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border bg-transparent">
            {filteredUsers.map((user) => {
              const isExpired = user.currentPeriodEnd ? new Date(user.currentPeriodEnd) < new Date() : true
              
              return (
              <tr key={user.id} className={`hover:bg-muted/30 transition-colors ${!user.isActive ? 'opacity-70' : ''}`}>
                <td className="whitespace-nowrap py-4 pl-4 pr-3 text-sm sm:pl-6">
                  <div className="flex items-center">
                    <div className={`h-10 w-10 flex-shrink-0 rounded-full flex items-center justify-center font-bold uppercase ${user.isActive ? 'bg-brand/10 text-brand' : 'bg-muted text-muted-foreground'}`}>
                      {user.name.charAt(0) || user.email.charAt(0)}
                    </div>
                    <div className="ml-4">
                      <div className="font-medium text-foreground flex items-center gap-2">
                        {user.name}
                        {isExpired && user.isActive && <span className="inline-flex items-center rounded-full bg-red-100 px-1.5 py-0.5 text-[10px] font-medium text-red-700">Vencido</span>}
                      </div>
                      <div className="text-muted-foreground">{user.email}</div>
                    </div>
                  </div>
                </td>
                <td className="whitespace-nowrap px-3 py-4 text-sm">
                  {user.isActive ? (
                    <span className="inline-flex items-center gap-1.5 rounded-md bg-green-500/10 px-2 py-1 text-xs font-medium text-green-600 ring-1 ring-inset ring-green-500/20">
                      Activo (Legacy)
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1.5 rounded-md bg-red-500/10 px-2 py-1 text-xs font-medium text-red-600 ring-1 ring-inset ring-red-500/20">
                      Desactivado Manual
                    </span>
                  )}
                </td>
                <td className="whitespace-nowrap px-3 py-4 text-sm text-foreground font-medium">
                  {user.currentPeriodEnd ? new Date(user.currentPeriodEnd).toLocaleDateString('es-ES', { day: '2-digit', month: 'short', year: 'numeric'}) : 'Sin fecha'}
                </td>
                <td className="relative whitespace-nowrap py-4 pl-3 pr-4 text-right text-sm font-medium sm:pr-6 flex justify-end gap-3 items-center">
                  {loadingId === user.id ? (
                    <Loader2 className="h-5 w-5 animate-spin text-muted-foreground inline-block" />
                  ) : (
                    <>
                      <button
                        onClick={() => {
                          setRenewUser(user)
                          setRenewModalOpen(true)
                        }}
                        className="text-brand hover:text-brand-hover flex items-center gap-1"
                        title="Cambiar fecha de vencimiento"
                      >
                        <Calendar className="h-4 w-4" /> Renovar
                      </button>
                      {user.isActive ? (
                        <button
                          onClick={() => {
                            setConfirmAction({ id: user.id, activate: false })
                            setIsConfirmOpen(true)
                          }}
                          className="text-[#E05C50] hover:text-[#E05C50]/80 flex items-center gap-1"
                          title="Cortar acceso"
                        >
                          <PowerOff className="h-4 w-4" /> Apagar
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
                          <Power className="h-4 w-4" /> Encender
                        </button>
                      )}
                    </>
                  )}
                </td>
              </tr>
            )})}
            {filteredUsers.length === 0 && (
              <tr>
                <td colSpan={4} className="py-10 text-center text-muted-foreground text-sm">
                  No se encontraron usuarios manuales.
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
        title={confirmAction?.activate ? "Reactivar Usuario" : "Desactivar Usuario"}
        message={confirmAction?.activate 
          ? "¿Estás seguro de que deseas reactivar el acceso de este usuario a la plataforma?" 
          : "Al desactivar, el usuario no podrá iniciar sesión en Ágora Plus hasta que sea reactivado manualmente."}
        confirmText={confirmAction?.activate ? "Sí, reactivar" : "Sí, apagar acceso"}
        cancelText="Cancelar"
      />

      <CreateManualUserModal 
        isOpen={isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
        role="USER"
      />

      {/* Modal para Renovar */}
      {renewModalOpen && renewUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm animate-in fade-in">
          <div className="w-full max-w-sm bg-surface rounded-2xl shadow-2xl p-6 border border-border animate-in zoom-in-95">
            <h3 className="text-lg font-bold text-foreground mb-1">Extender Vencimiento</h3>
            <p className="text-sm text-muted-foreground mb-4">Actualiza la fecha límite de acceso para {renewUser.name}.</p>
            
            <div className="mb-6">
              <label className="block text-xs font-semibold text-muted-foreground mb-1">Nueva Fecha de Vencimiento</label>
              <input 
                type="date" 
                className="w-full rounded-lg border-border bg-background px-3 py-2 text-sm text-foreground focus:ring-2 focus:ring-brand outline-none"
                value={newDate}
                onChange={(e) => setNewDate(e.target.value)}
              />
            </div>

            <div className="flex justify-end gap-3">
              <button 
                onClick={() => setRenewModalOpen(false)}
                className="px-4 py-2 text-sm font-semibold text-muted-foreground hover:bg-muted rounded-lg transition-colors"
              >
                Cancelar
              </button>
              <button 
                onClick={handleRenew}
                disabled={!newDate}
                className="px-4 py-2 text-sm font-semibold bg-brand text-white hover:bg-brand-hover rounded-lg transition-colors disabled:opacity-50"
              >
                Actualizar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
