'use client'

import { useState, useRef, useEffect } from 'react'
import { Search, Bell, KeyRound, LogOut, User, ChevronDown, Loader2, Eye, EyeOff, Check, X, Shield } from 'lucide-react'
import { createClient } from '@/utils/supabase/client'
import { useRouter } from 'next/navigation'
import { changeOwnPassword } from '@/app/dashboard/profile/actions'

interface HeaderProps {
  userName?: string;
  userEmail?: string;
  isChild?: boolean;
}

export default function Header({ userName = 'Usuario', userEmail = '', isChild = false }: HeaderProps) {
  const initials = userName.substring(0, 2).toUpperCase();
  const [dropdownOpen, setDropdownOpen] = useState(false)
  const [passwordModalOpen, setPasswordModalOpen] = useState(false)
  const dropdownRef = useRef<HTMLDivElement>(null)
  const router = useRouter()

  // Close dropdown on click outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setDropdownOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const handleLogout = async () => {
    const supabase = createClient()
    await supabase.auth.signOut()
    router.push('/login')
    router.refresh()
  }

  return (
    <>
      <header className="sticky top-0 z-10 flex h-16 flex-shrink-0 items-center gap-x-4 border-b border-border bg-surface/80 backdrop-blur-md px-4 shadow-sm sm:gap-x-6 sm:px-6 lg:px-8">
        <div className="flex flex-1 gap-x-4 self-stretch lg:gap-x-6">
          <form className="relative flex flex-1" action="#" method="GET">
            <label htmlFor="search-field" className="sr-only">
              Buscar
            </label>
            <Search
              className="pointer-events-none absolute inset-y-0 left-0 h-full w-5 text-foreground/40"
              aria-hidden="true"
            />
            <input
              id="search-field"
              className="block h-full w-full border-0 py-0 pl-8 pr-0 text-foreground bg-transparent placeholder:text-foreground/40 focus:ring-0 sm:text-sm"
              placeholder="Buscar firmas, empresas o transacciones..."
              type="search"
              name="search"
            />
          </form>
          <div className="flex items-center gap-x-4 lg:gap-x-6">
            <button type="button" className="-m-2.5 p-2.5 text-foreground/50 hover:text-foreground">
              <span className="sr-only">Ver notificaciones</span>
              <Bell className="h-5 w-5" aria-hidden="true" />
            </button>
            <div className="hidden lg:block lg:h-6 lg:w-px lg:bg-border" aria-hidden="true" />
            
            {/* Profile dropdown */}
            <div className="relative" ref={dropdownRef}>
              <button
                onClick={() => setDropdownOpen(prev => !prev)}
                className="flex items-center gap-x-3 rounded-lg px-2 py-1.5 hover:bg-muted/50 transition-colors"
              >
                <div className="h-8 w-8 rounded-full bg-brand/20 flex items-center justify-center text-brand font-semibold text-sm">
                  {initials}
                </div>
                <span className="hidden lg:flex lg:items-center gap-1">
                  <span className="text-sm font-semibold leading-6 text-foreground" aria-hidden="true">
                    {userName}
                  </span>
                  <ChevronDown className={`h-4 w-4 text-muted-foreground transition-transform ${dropdownOpen ? 'rotate-180' : ''}`} />
                </span>
              </button>

              {/* Dropdown Menu */}
              {dropdownOpen && (
                <div className="absolute right-0 top-full mt-2 w-64 origin-top-right rounded-xl bg-surface shadow-xl ring-1 ring-border animate-in fade-in zoom-in-95 duration-150 overflow-hidden z-50">
                  {/* User info header */}
                  <div className="px-4 py-3 border-b border-border bg-muted/30">
                    <p className="text-sm font-semibold text-foreground truncate">{userName}</p>
                    {userEmail && (
                      <p className="text-xs text-muted-foreground truncate mt-0.5">{userEmail}</p>
                    )}
                  </div>

                  <div className="py-1">
                    {/* Change password - only for non-child users */}
                    {!isChild && (
                      <button
                        onClick={() => {
                          setDropdownOpen(false)
                          setPasswordModalOpen(true)
                        }}
                        className="flex w-full items-center gap-3 px-4 py-2.5 text-sm text-foreground hover:bg-muted/50 transition-colors"
                      >
                        <KeyRound className="h-4 w-4 text-muted-foreground" />
                        Cambiar Contraseña
                      </button>
                    )}

                    <div className="border-t border-border my-1" />

                    <button
                      onClick={handleLogout}
                      className="flex w-full items-center gap-3 px-4 py-2.5 text-sm text-red-600 hover:bg-red-50 dark:hover:bg-red-500/10 transition-colors"
                    >
                      <LogOut className="h-4 w-4" />
                      Cerrar Sesión
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </header>

      {/* Password Change Modal */}
      {passwordModalOpen && (
        <PasswordChangeModal onClose={() => setPasswordModalOpen(false)} />
      )}
    </>
  )
}

// ————————————————————————————————————————————————————————
// Password Change Modal Component
// ————————————————————————————————————————————————————————
function PasswordChangeModal({ onClose }: { onClose: () => void }) {
  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [showCurrent, setShowCurrent] = useState(false)
  const [showNew, setShowNew] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState(false)

  const passwordValid = newPassword.length >= 6
  const passwordsMatch = newPassword === confirmPassword && confirmPassword.length > 0

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')

    if (!currentPassword) {
      setError('Ingresa tu contraseña actual.')
      return
    }
    if (newPassword.length < 6) {
      setError('La nueva contraseña debe tener al menos 6 caracteres.')
      return
    }
    if (newPassword !== confirmPassword) {
      setError('Las contraseñas no coinciden.')
      return
    }
    if (currentPassword === newPassword) {
      setError('La nueva contraseña debe ser diferente a la actual.')
      return
    }

    setLoading(true)
    const result = await changeOwnPassword({ currentPassword, newPassword })
    setLoading(false)

    if (result.success) {
      setSuccess(true)
      setTimeout(() => onClose(), 2000)
    } else {
      setError(result.error || 'Error al cambiar la contraseña.')
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm animate-in fade-in">
      <div className="w-full max-w-md bg-surface rounded-2xl shadow-2xl border border-border animate-in zoom-in-95 relative overflow-hidden">
        {/* Header */}
        <div className="px-6 py-4 border-b border-border bg-muted/30 flex items-center gap-3">
          <div className="h-10 w-10 rounded-xl bg-brand/10 flex items-center justify-center">
            <Shield className="h-5 w-5 text-brand" />
          </div>
          <div>
            <h3 className="text-lg font-bold text-foreground">Cambiar Contraseña</h3>
            <p className="text-xs text-muted-foreground">Actualiza tu contraseña de acceso a Ágora Plus</p>
          </div>
          <button onClick={onClose} className="absolute right-4 top-4 text-muted-foreground hover:text-foreground">
            <X className="h-5 w-5" />
          </button>
        </div>

        {success ? (
          <div className="p-6 text-center">
            <div className="h-16 w-16 rounded-full bg-green-500/10 flex items-center justify-center mx-auto mb-4">
              <Check className="h-8 w-8 text-green-600" />
            </div>
            <h4 className="text-lg font-bold text-foreground mb-1">¡Contraseña Actualizada!</h4>
            <p className="text-sm text-muted-foreground">Tu nueva contraseña está activa.</p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="p-6 space-y-4">
            {error && (
              <div className="rounded-lg bg-red-500/10 p-3 text-sm text-red-600 border border-red-500/20">
                {error}
              </div>
            )}

            {/* Current Password */}
            <div>
              <label className="block text-xs font-semibold text-muted-foreground mb-1.5">Contraseña Actual</label>
              <div className="relative">
                <input
                  type={showCurrent ? 'text' : 'password'}
                  required
                  className="w-full rounded-lg border-border bg-background px-3 py-2.5 pr-10 text-sm text-foreground focus:ring-2 focus:ring-brand outline-none"
                  placeholder="Tu contraseña actual"
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                />
                <button
                  type="button"
                  onClick={() => setShowCurrent(!showCurrent)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                >
                  {showCurrent ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>

            {/* New Password */}
            <div>
              <label className="block text-xs font-semibold text-muted-foreground mb-1.5">Nueva Contraseña</label>
              <div className="relative">
                <input
                  type={showNew ? 'text' : 'password'}
                  required
                  minLength={6}
                  className="w-full rounded-lg border-border bg-background px-3 py-2.5 pr-10 text-sm text-foreground focus:ring-2 focus:ring-brand outline-none"
                  placeholder="Mínimo 6 caracteres"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                />
                <button
                  type="button"
                  onClick={() => setShowNew(!showNew)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                >
                  {showNew ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
              {/* Password strength indicator */}
              {newPassword.length > 0 && (
                <div className="mt-2 flex items-center gap-2">
                  <div className="flex-1 h-1 rounded-full bg-muted overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all duration-300 ${
                        newPassword.length < 6 ? 'w-1/4 bg-red-500' :
                        newPassword.length < 8 ? 'w-2/4 bg-amber-500' :
                        newPassword.length < 12 ? 'w-3/4 bg-blue-500' :
                        'w-full bg-green-500'
                      }`}
                    />
                  </div>
                  <span className={`text-[10px] font-medium ${
                    newPassword.length < 6 ? 'text-red-500' :
                    newPassword.length < 8 ? 'text-amber-500' :
                    newPassword.length < 12 ? 'text-blue-500' :
                    'text-green-500'
                  }`}>
                    {newPassword.length < 6 ? 'Muy corta' :
                     newPassword.length < 8 ? 'Aceptable' :
                     newPassword.length < 12 ? 'Buena' :
                     'Fuerte'}
                  </span>
                </div>
              )}
            </div>

            {/* Confirm New Password */}
            <div>
              <label className="block text-xs font-semibold text-muted-foreground mb-1.5">Confirmar Nueva Contraseña</label>
              <div className="relative">
                <input
                  type="password"
                  required
                  className={`w-full rounded-lg border-border bg-background px-3 py-2.5 pr-10 text-sm text-foreground focus:ring-2 outline-none ${
                    confirmPassword.length > 0
                      ? passwordsMatch ? 'focus:ring-green-500 ring-1 ring-green-500/30' : 'focus:ring-red-500 ring-1 ring-red-500/30'
                      : 'focus:ring-brand'
                  }`}
                  placeholder="Repite la nueva contraseña"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                />
                {confirmPassword.length > 0 && (
                  <div className="absolute right-3 top-1/2 -translate-y-1/2">
                    {passwordsMatch ? (
                      <Check className="h-4 w-4 text-green-500" />
                    ) : (
                      <X className="h-4 w-4 text-red-500" />
                    )}
                  </div>
                )}
              </div>
            </div>

            <div className="pt-2 flex justify-end gap-3">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2.5 text-sm font-semibold text-muted-foreground hover:bg-muted rounded-lg transition-colors"
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={loading || !passwordValid || !passwordsMatch}
                className="flex items-center gap-2 px-5 py-2.5 text-sm font-semibold bg-brand text-white hover:bg-brand-hover rounded-lg transition-colors disabled:opacity-50"
              >
                {loading && <Loader2 className="h-4 w-4 animate-spin" />}
                Actualizar Contraseña
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  )
}
