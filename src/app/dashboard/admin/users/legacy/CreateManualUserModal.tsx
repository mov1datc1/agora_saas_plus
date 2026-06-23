'use client'

import { useState } from 'react'
import { createManualUser } from '../user-actions'
import { Loader2, X } from 'lucide-react'

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
    expiryDate: ''
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
      setFormData({ name: '', email: '', password: '', expiryDate: '' })
    } else {
      setError(res.error || 'Error al crear usuario')
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm animate-in fade-in">
      <div className="w-full max-w-md bg-surface rounded-2xl shadow-2xl p-6 border border-border animate-in zoom-in-95 relative">
        <button onClick={onClose} className="absolute right-4 top-4 text-muted-foreground hover:text-foreground">
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
