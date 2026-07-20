'use client'

import { useState, useMemo } from 'react'
import { Search, Loader2, UserPlus, Power, PowerOff, Calendar, ChevronDown, ChevronRight, Users, User } from 'lucide-react'
import { toggleUserActiveStatus, updateManualSubscription } from '../user-actions'
import ConfirmModal from '@/components/ui/ConfirmModal'
import CreateManualUserModal from './CreateManualUserModal'

type UIUser = {
  id: string
  name: string
  email: string
  role: string
  accountType?: string
  parentId?: string | null
  status: string
  isActive: boolean
  currentPeriodEnd: string | null
  createdAt: string
}

// Helper to get account type label and style
function getAccountBadge(accountType?: string, isChild?: boolean) {
  if (isChild) {
    return {
      label: 'Miembro',
      className: 'bg-emerald-50 text-emerald-700 ring-emerald-600/10',
    }
  }
  switch (accountType) {
    case 'CORPORATE':
      return {
        label: 'Corporativo 5',
        className: 'bg-violet-50 text-violet-700 ring-violet-600/10',
      }
    case 'CORPORATE_3':
      return {
        label: 'Corporativo 3',
        className: 'bg-blue-50 text-blue-700 ring-blue-600/10',
      }
    default:
      return {
        label: 'Individual',
        className: 'bg-gray-50 text-gray-600 ring-gray-500/10',
      }
  }
}

function UserRow({ 
  user, 
  loadingId, 
  onToggle, 
  onRenew,
  isChild = false,
  isLast = false
}: { 
  user: UIUser
  loadingId: string | null
  onToggle: (id: string, activate: boolean) => void
  onRenew: (user: UIUser) => void
  isChild?: boolean
  isLast?: boolean
}) {
  const isExpired = user.currentPeriodEnd ? new Date(user.currentPeriodEnd) < new Date() : true
  const badge = getAccountBadge(user.accountType, isChild)

  return (
    <tr className={`hover:bg-muted/30 transition-colors ${!user.isActive ? 'opacity-70' : ''} ${isChild ? 'bg-muted/10' : ''}`}>
      <td className="whitespace-nowrap py-4 pl-4 pr-3 text-sm sm:pl-6">
        <div className="flex items-center">
          {isChild && (
            <div className="flex items-center mr-2 text-muted-foreground/40">
              <div className={`w-4 border-l-2 border-b-2 border-muted-foreground/20 ${isLast ? 'h-4 rounded-bl' : 'h-4 rounded-bl'}`} style={{ marginTop: '-8px' }} />
            </div>
          )}
          <div className={`h-10 w-10 flex-shrink-0 rounded-full flex items-center justify-center font-bold uppercase ${
            isChild 
              ? 'bg-emerald-500/10 text-emerald-600' 
              : user.isActive ? 'bg-brand/10 text-brand' : 'bg-muted text-muted-foreground'
          }`}>
            {user.name.charAt(0) || user.email.charAt(0)}
          </div>
          <div className="ml-3">
            <div className="font-medium text-foreground flex items-center gap-2 flex-wrap">
              {user.name}
              <span className={`inline-flex items-center rounded-md px-2 py-0.5 text-[10px] font-semibold ring-1 ring-inset ${badge.className}`}>
                {badge.label}
              </span>
              {isExpired && user.isActive && <span className="inline-flex items-center rounded-full bg-red-100 px-1.5 py-0.5 text-[10px] font-medium text-red-700">Vencido</span>}
            </div>
            <div className="text-muted-foreground text-xs">{user.email}</div>
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
              onClick={() => onRenew(user)}
              className="text-brand hover:text-brand-hover flex items-center gap-1"
              title="Cambiar fecha de vencimiento"
            >
              <Calendar className="h-4 w-4" /> Renovar
            </button>
            {user.isActive ? (
              <button
                onClick={() => onToggle(user.id, false)}
                className="text-[#E05C50] hover:text-[#E05C50]/80 flex items-center gap-1"
                title="Cortar acceso"
              >
                <PowerOff className="h-4 w-4" /> Apagar
              </button>
            ) : (
              <button
                onClick={() => onToggle(user.id, true)}
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
  )
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

  // Track which parent rows are expanded
  const [expandedParents, setExpandedParents] = useState<Set<string>>(new Set())

  const toggleExpanded = (parentId: string) => {
    setExpandedParents(prev => {
      const next = new Set(prev)
      if (next.has(parentId)) next.delete(parentId)
      else next.add(parentId)
      return next
    })
  }

  // Build parent-child groups
  const { parentUsers, childMap, standaloneUsers } = useMemo(() => {
    const childMap: Record<string, UIUser[]> = {}
    const parentIds = new Set<string>()
    
    // Identify children and group them
    for (const u of users) {
      if (u.parentId) {
        if (!childMap[u.parentId]) childMap[u.parentId] = []
        childMap[u.parentId].push(u)
        parentIds.add(u.parentId)
      }
    }

    // Users who are parents (have children pointing to them) OR are corporate without parentId
    const parentUsers = users.filter(u => !u.parentId && (childMap[u.id]?.length > 0 || u.accountType === 'CORPORATE' || u.accountType === 'CORPORATE_3'))
    const standaloneUsers = users.filter(u => !u.parentId && !childMap[u.id]?.length && u.accountType !== 'CORPORATE' && u.accountType !== 'CORPORATE_3')

    return { parentUsers, childMap, standaloneUsers }
  }, [users])

  const filteredParents = useMemo(() => {
    if (!searchQuery) return parentUsers
    const q = searchQuery.toLowerCase()
    return parentUsers.filter(u => {
      // Match parent or any of their children
      if (u.name.toLowerCase().includes(q) || u.email.toLowerCase().includes(q)) return true
      const children = childMap[u.id] || []
      return children.some(c => c.name.toLowerCase().includes(q) || c.email.toLowerCase().includes(q))
    })
  }, [parentUsers, childMap, searchQuery])

  const filteredStandalone = useMemo(() => {
    if (!searchQuery) return standaloneUsers
    const q = searchQuery.toLowerCase()
    return standaloneUsers.filter(u => u.name.toLowerCase().includes(q) || u.email.toLowerCase().includes(q))
  }, [standaloneUsers, searchQuery])

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

  const onToggle = (id: string, activate: boolean) => {
    setConfirmAction({ id, activate })
    setIsConfirmOpen(true)
  }

  const onRenew = (user: UIUser) => {
    setRenewUser(user)
    setRenewModalOpen(true)
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
            {/* Corporate parent users with expandable children */}
            {filteredParents.map((parent) => {
              const children = childMap[parent.id] || []
              const isExpanded = expandedParents.has(parent.id)
              const hasChildren = children.length > 0
              const isCorp = parent.accountType === 'CORPORATE' || parent.accountType === 'CORPORATE_3'
              const maxSlots = parent.accountType === 'CORPORATE_3' ? 2 : 4
              const isExpiredParent = parent.currentPeriodEnd ? new Date(parent.currentPeriodEnd) < new Date() : true
              const badge = getAccountBadge(parent.accountType)

              return (
                <> 
                  {/* Parent row with expand toggle */}
                  <tr key={parent.id} className={`hover:bg-muted/30 transition-colors ${!parent.isActive ? 'opacity-70' : ''}`}>
                    <td className="whitespace-nowrap py-4 pl-4 pr-3 text-sm sm:pl-6">
                      <div className="flex items-center">
                        {/* Expand/collapse button for corporate parents */}
                        {isCorp ? (
                          <button 
                            onClick={() => toggleExpanded(parent.id)}
                            className={`mr-2 h-6 w-6 rounded flex items-center justify-center transition-colors ${
                              hasChildren 
                                ? 'bg-brand/10 text-brand hover:bg-brand/20 cursor-pointer' 
                                : 'bg-muted/50 text-muted-foreground/40 cursor-default'
                            }`}
                            title={hasChildren ? (isExpanded ? 'Contraer equipo' : 'Expandir equipo') : 'Sin miembros'}
                          >
                            {isExpanded ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
                          </button>
                        ) : null}
                        <div className={`h-10 w-10 flex-shrink-0 rounded-full flex items-center justify-center font-bold uppercase ${parent.isActive ? 'bg-brand/10 text-brand' : 'bg-muted text-muted-foreground'}`}>
                          {parent.name.charAt(0) || parent.email.charAt(0)}
                        </div>
                        <div className="ml-3">
                          <div className="font-medium text-foreground flex items-center gap-2 flex-wrap">
                            {parent.name}
                            <span className={`inline-flex items-center rounded-md px-2 py-0.5 text-[10px] font-semibold ring-1 ring-inset ${badge.className}`}>
                              {badge.label}
                            </span>
                            {isCorp && (
                              <span className="inline-flex items-center gap-1 rounded-full bg-muted px-2 py-0.5 text-[10px] font-medium text-muted-foreground">
                                <Users className="h-3 w-3" />
                                {children.length}/{maxSlots}
                              </span>
                            )}
                            {isExpiredParent && parent.isActive && <span className="inline-flex items-center rounded-full bg-red-100 px-1.5 py-0.5 text-[10px] font-medium text-red-700">Vencido</span>}
                          </div>
                          <div className="text-muted-foreground text-xs">{parent.email}</div>
                        </div>
                      </div>
                    </td>
                    <td className="whitespace-nowrap px-3 py-4 text-sm">
                      {parent.isActive ? (
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
                      {parent.currentPeriodEnd ? new Date(parent.currentPeriodEnd).toLocaleDateString('es-ES', { day: '2-digit', month: 'short', year: 'numeric'}) : 'Sin fecha'}
                    </td>
                    <td className="relative whitespace-nowrap py-4 pl-3 pr-4 text-right text-sm font-medium sm:pr-6 flex justify-end gap-3 items-center">
                      {loadingId === parent.id ? (
                        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground inline-block" />
                      ) : (
                        <>
                          <button
                            onClick={() => onRenew(parent)}
                            className="text-brand hover:text-brand-hover flex items-center gap-1"
                            title="Cambiar fecha de vencimiento"
                          >
                            <Calendar className="h-4 w-4" /> Renovar
                          </button>
                          {parent.isActive ? (
                            <button
                              onClick={() => onToggle(parent.id, false)}
                              className="text-[#E05C50] hover:text-[#E05C50]/80 flex items-center gap-1"
                              title="Cortar acceso"
                            >
                              <PowerOff className="h-4 w-4" /> Apagar
                            </button>
                          ) : (
                            <button
                              onClick={() => onToggle(parent.id, true)}
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

                  {/* Children rows (visible when expanded) */}
                  {isExpanded && children.map((child, idx) => (
                    <UserRow 
                      key={child.id} 
                      user={child} 
                      loadingId={loadingId} 
                      onToggle={onToggle} 
                      onRenew={onRenew} 
                      isChild={true}
                      isLast={idx === children.length - 1}
                    />
                  ))}
                </>
              )
            })}

            {/* Standalone individual users */}
            {filteredStandalone.map((user) => (
              <UserRow key={user.id} user={user} loadingId={loadingId} onToggle={onToggle} onRenew={onRenew} />
            ))}

            {filteredParents.length === 0 && filteredStandalone.length === 0 && (
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
