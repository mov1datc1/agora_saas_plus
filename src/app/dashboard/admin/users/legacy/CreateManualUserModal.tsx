'use client'

import { useState } from 'react'
import { createManualUser } from '../user-actions'
import { Loader2, X, User, Users, Building2 } from 'lucide-react'

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

export default function CreateManualUserModal({ 
  isOpen, 
  onClose,
  role
}: { 
  isOpen: boolean, 
  onClose: () => void,
  role: 'USER' | 'ADMIN'
}) {
  const [loading, setLoading] = useState(false)
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    password: '',
    expiryDate: '',
    accountType: 'INDIVIDUAL'
  })
  const [error, setError] = useState('')

  if (!isOpen) return null

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    
    if (!formData.name || !formData.email || !formData.password) {
      setError('Por favor completa los campos obligatorios.')
      return
    }

    if (role === 'USER' && !formData.expiryDate) {
      setError('Debes establecer una fecha de vencimiento para el usuario manual.')
      return
    }

    setLoading(true)
    const res = await createManualUser({ ...formData, role })
    setLoading(false)

    if (res.success) {
      onClose()
      setFormData({ name: '', email: '', password: '', expiryDate: '', accountType: 'INDIVIDUAL' })
    } else {
      setError(res.error || 'Error al crear usuario')
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm animate-in fade-in">
      <div className="w-full max-w-lg bg-surface rounded-2xl shadow-2xl p-6 border border-border animate-in zoom-in-95 relative max-h-[90vh] overflow-y-auto">
        <button onClick={onClose} className="absolute right-4 top-4 text-muted-foreground hover:text-foreground z-10">
          <X className="h-5 w-5" />
        </button>
        
        <h3 className="text-xl font-bold text-foreground mb-1">
          {role === 'ADMIN' ? 'Nuevo Administrador' : 'Nuevo Usuario Manual'}
        </h3>
        <p className="text-sm text-muted-foreground mb-6">
          {role === 'ADMIN' 
            ? 'Crea una cuenta con acceso total al panel de administración.' 
            : 'Crea una cuenta de acceso sin pasar por Stripe (acuerdo comercial).'}
        </p>

        {error && (
          <div className="mb-4 rounded-lg bg-red-500/10 p-3 text-sm text-red-600 border border-red-500/20">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-muted-foreground mb-1">Nombre Completo</label>
            <input 
              type="text" 
              required
              placeholder="Ej. Juan Pérez"
              className="w-full rounded-lg border-border bg-background px-3 py-2 text-sm text-foreground focus:ring-2 focus:ring-brand outline-none"
              value={formData.name}
              onChange={(e) => setFormData(p => ({...p, name: e.target.value}))}
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-muted-foreground mb-1">Correo Electrónico</label>
            <input 
              type="email" 
              required
              placeholder="juan@empresa.com"
              className="w-full rounded-lg border-border bg-background px-3 py-2 text-sm text-foreground focus:ring-2 focus:ring-brand outline-none"
              value={formData.email}
              onChange={(e) => setFormData(p => ({...p, email: e.target.value}))}
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-muted-foreground mb-1">Contraseña (Mínimo 6 caracteres)</label>
            <input 
              type="password" 
              required
              minLength={6}
              placeholder="Asigna una contraseña segura"
              className="w-full rounded-lg border-border bg-background px-3 py-2 text-sm text-foreground focus:ring-2 focus:ring-brand outline-none"
              value={formData.password}
              onChange={(e) => setFormData(p => ({...p, password: e.target.value}))}
            />
          </div>

          {role === 'USER' && (
            <>
              {/* PRO Account Type Selector */}
              <div>
                <label className="block text-xs font-semibold text-muted-foreground mb-2">Tipo de Cuenta Comercial</label>
                <div className="grid grid-cols-3 gap-2">
                  {ACCOUNT_TYPES.map((type) => {
                    const Icon = type.icon
                    const isSelected = formData.accountType === type.value
                    return (
                      <button
                        key={type.value}
                        type="button"
                        onClick={() => setFormData(p => ({...p, accountType: type.value}))}
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
                  value={formData.expiryDate}
                  onChange={(e) => setFormData(p => ({...p, expiryDate: e.target.value}))}
                />
              </div>
            </>
          )}

          <div className="pt-4 flex justify-end gap-3">
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
              className="flex items-center gap-2 px-4 py-2 text-sm font-semibold bg-brand text-white hover:bg-brand-hover rounded-lg transition-colors disabled:opacity-50"
            >
              {loading && <Loader2 className="h-4 w-4 animate-spin" />}
              Crear Cuenta
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
