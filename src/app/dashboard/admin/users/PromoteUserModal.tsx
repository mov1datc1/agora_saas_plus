'use client'

import { useState } from 'react'
import { promoteUserToLegacy } from './user-actions'
import { Loader2, X, User, Users, Building2, ArrowUpRight } from 'lucide-react'

const ACCOUNT_TYPES = [
  {
    value: 'INDIVIDUAL',
    label: 'Individual',
    description: '1 usuario único',
    icon: User,
    color: 'from-gray-500/20 to-gray-600/20',
    borderColor: 'border-gray-400/30',
    selectedBorder: 'ring-2 ring-gray-500 border-gray-500',
    iconBg: 'bg-gray-500/10 text-gray-600',
  },
  {
    value: 'CORPORATE_3',
    label: 'Corporativo 3',
    description: '1 titular + 2 miembros',
    icon: Users,
    color: 'from-blue-500/20 to-blue-600/20',
    borderColor: 'border-blue-400/30',
    selectedBorder: 'ring-2 ring-blue-500 border-blue-500',
    iconBg: 'bg-blue-500/10 text-blue-600',
  },
  {
    value: 'CORPORATE',
    label: 'Corporativo 5',
    description: '1 titular + 4 miembros',
    icon: Building2,
    color: 'from-violet-500/20 to-violet-600/20',
    borderColor: 'border-violet-400/30',
    selectedBorder: 'ring-2 ring-violet-500 border-violet-500',
    iconBg: 'bg-violet-500/10 text-violet-600',
  },
]

type PromoteUser = {
  id: string
  name: string
  email: string
}

export default function PromoteUserModal({
  isOpen,
  onClose,
  user,
  onSuccess,
}: {
  isOpen: boolean
  onClose: () => void
  user: PromoteUser | null
  onSuccess: (userId: string) => void
}) {
  const [loading, setLoading] = useState(false)
  const [accountType, setAccountType] = useState('INDIVIDUAL')
  const [expiryDate, setExpiryDate] = useState('')
  const [error, setError] = useState('')

  if (!isOpen || !user) return null

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')

    if (!expiryDate) {
      setError('Debes establecer una fecha de vencimiento para el acuerdo Legacy.')
      return
    }

    setLoading(true)
    const res = await promoteUserToLegacy(user.id, accountType, expiryDate)
    setLoading(false)

    if (res.success) {
      onSuccess(user.id)
      onClose()
      setAccountType('INDIVIDUAL')
      setExpiryDate('')
    } else {
      setError(res.error || 'Error al promover usuario')
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm animate-in fade-in">
      <div className="w-full max-w-lg bg-surface rounded-2xl shadow-2xl p-6 border border-border animate-in zoom-in-95 relative max-h-[90vh] overflow-y-auto">
        <button onClick={onClose} className="absolute right-4 top-4 text-muted-foreground hover:text-foreground z-10">
          <X className="h-5 w-5" />
        </button>

        {/* Header with icon */}
        <div className="flex items-center gap-3 mb-1">
          <div className="h-10 w-10 rounded-xl bg-amber-500/10 flex items-center justify-center">
            <ArrowUpRight className="h-5 w-5 text-amber-600" />
          </div>
          <div>
            <h3 className="text-xl font-bold text-foreground">Promover a Legacy</h3>
          </div>
        </div>
        <p className="text-sm text-muted-foreground mb-6 ml-[52px]">
          Convierte este usuario SaaS en un cliente de acuerdo comercial (Legacy).
        </p>

        {/* User info card */}
        <div className="bg-muted/50 rounded-xl p-3 border border-border mb-5 flex items-center gap-3">
          <div className="h-10 w-10 flex-shrink-0 rounded-full bg-brand/10 flex items-center justify-center font-bold text-brand uppercase">
            {user.name.charAt(0) || user.email.charAt(0)}
          </div>
          <div>
            <p className="font-medium text-foreground text-sm">{user.name}</p>
            <p className="text-xs text-muted-foreground">{user.email}</p>
          </div>
        </div>

        {error && (
          <div className="mb-4 rounded-lg bg-red-500/10 p-3 text-sm text-red-600 border border-red-500/20">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Account Type Selector (same PRO design as CreateManualUserModal) */}
          <div>
            <label className="block text-xs font-semibold text-muted-foreground mb-2">Tipo de Cuenta Comercial</label>
            <div className="grid grid-cols-3 gap-2">
              {ACCOUNT_TYPES.map((type) => {
                const Icon = type.icon
                const isSelected = accountType === type.value
                return (
                  <button
                    key={type.value}
                    type="button"
                    onClick={() => setAccountType(type.value)}
                    className={`relative flex flex-col items-center gap-1.5 p-3 rounded-xl border transition-all duration-200 cursor-pointer ${
                      isSelected
                        ? `${type.selectedBorder} bg-gradient-to-b ${type.color} shadow-sm`
                        : `${type.borderColor} bg-background hover:bg-muted/50 hover:border-foreground/20`
                    }`}
                  >
                    <div className={`h-8 w-8 rounded-lg flex items-center justify-center ${type.iconBg}`}>
                      <Icon className="h-4 w-4" />
                    </div>
                    <span className={`text-xs font-bold ${isSelected ? 'text-foreground' : 'text-foreground/70'}`}>
                      {type.label}
                    </span>
                    <span className={`text-[10px] leading-tight text-center ${isSelected ? 'text-foreground/70' : 'text-muted-foreground'}`}>
                      {type.description}
                    </span>
                    {isSelected && (
                      <div className="absolute -top-1 -right-1 h-4 w-4 rounded-full bg-foreground flex items-center justify-center">
                        <svg className="h-2.5 w-2.5 text-background" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                        </svg>
                      </div>
                    )}
                  </button>
                )
              })}
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-muted-foreground mb-1">Fecha de Vencimiento del Acuerdo</label>
            <input
              type="date"
              required
              className="w-full rounded-lg border-border bg-background px-3 py-2 text-sm text-foreground focus:ring-2 focus:ring-brand outline-none"
              value={expiryDate}
              onChange={(e) => setExpiryDate(e.target.value)}
            />
          </div>

          {/* Warning banner */}
          <div className="rounded-lg bg-amber-500/10 p-3 border border-amber-500/20">
            <p className="text-xs text-amber-700 leading-relaxed">
              <strong>Atención:</strong> Al promover, el usuario pasará de la pestaña SaaS a Legacy. Su acceso por Stripe será reemplazado por un acuerdo manual con la fecha de vencimiento indicada.
            </p>
          </div>

          <div className="pt-2 flex justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-sm font-semibold text-muted-foreground hover:bg-muted rounded-lg transition-colors"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={loading}
              className="flex items-center gap-2 px-4 py-2 text-sm font-semibold bg-amber-600 text-white hover:bg-amber-700 rounded-lg transition-colors disabled:opacity-50"
            >
              {loading && <Loader2 className="h-4 w-4 animate-spin" />}
              Promover a Legacy
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
