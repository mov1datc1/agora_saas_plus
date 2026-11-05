'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/utils/supabase/client'
import Link from 'next/link'
import { Eye, EyeOff, Lock, AlertCircle, CheckCircle, ArrowLeft, Loader2 } from 'lucide-react'

interface ResetPasswordClientProps {
  initialUserEmail?: string
}

export default function ResetPasswordClient({ initialUserEmail }: ResetPasswordClientProps) {
  const router = useRouter()
  const supabase = createClient()

  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = useState(false)

  const [isLoadingAuth, setIsLoadingAuth] = useState(!initialUserEmail)
  const [hasValidSession, setHasValidSession] = useState(!!initialUserEmail)
  const [userEmail, setUserEmail] = useState(initialUserEmail || '')

  const [isSubmitting, setIsSubmitting] = useState(false)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)
  const [successMsg, setSuccessMsg] = useState<string | null>(null)

  useEffect(() => {
    let mounted = true

    async function checkAuth() {
      // 1. Manejo de tokens en hash (caso de redirección directa de Supabase)
      if (typeof window !== 'undefined' && window.location.hash.includes('access_token=')) {
        try {
          const hashParams = new URLSearchParams(window.location.hash.substring(1))
          const access_token = hashParams.get('access_token')
          const refresh_token = hashParams.get('refresh_token')

          if (access_token && refresh_token) {
            const { data, error } = await supabase.auth.setSession({ access_token, refresh_token })
            if (!error && data?.user && mounted) {
              setHasValidSession(true)
              setUserEmail(data.user.email || '')
              setIsLoadingAuth(false)
              return
            }
          }
        } catch (hashErr) {
          console.warn('[HASH_PARSE_WARN]', hashErr)
        }
      }

      // 2. Comprobar sesión activa (establecida por cookie desde /auth/callback)
      try {
        const { data: { session } } = await supabase.auth.getSession()
        if (mounted) {
          if (session?.user) {
            setHasValidSession(true)
            setUserEmail(session.user.email || '')
          } else if (!initialUserEmail) {
            setHasValidSession(false)
          }
          setIsLoadingAuth(false)
        }
      } catch (err) {
        if (mounted) {
          if (!initialUserEmail) setHasValidSession(false)
          setIsLoadingAuth(false)
        }
      }
    }

    checkAuth()

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (mounted && (event === 'PASSWORD_RECOVERY' || event === 'SIGNED_IN') && session?.user) {
        setHasValidSession(true)
        setUserEmail(session.user.email || '')
        setIsLoadingAuth(false)
      }
    })

    return () => {
      mounted = false
      subscription.unsubscribe()
    }
  }, [supabase, initialUserEmail])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setErrorMsg(null)
    setSuccessMsg(null)

    if (password.length < 6) {
      setErrorMsg('La contraseña debe tener al menos 6 caracteres.')
      return
    }

    if (password !== confirmPassword) {
      setErrorMsg('Las contraseñas no coinciden. Por favor verifica ambos campos.')
      return
    }

    setIsSubmitting(true)

    try {
      const { data, error } = await supabase.auth.updateUser({
        password: password
      })

      if (error) {
        setErrorMsg(error.message || 'Error al actualizar la contraseña.')
        setIsSubmitting(false)
        return
      }

      setSuccessMsg('¡Contraseña actualizada con éxito! Redirigiendo a tu cuenta...')
      
      setTimeout(() => {
        router.refresh()
        router.push('/dashboard')
      }, 1500)
    } catch (err: any) {
      console.error('[UPDATE_PASSWORD_ERROR]', err)
      setErrorMsg('Ocurrió un error inesperado. Por favor intenta de nuevo.')
      setIsSubmitting(false)
    }
  }

  if (isLoadingAuth) {
    return (
      <div className="py-12 text-center">
        <Loader2 className="w-8 h-8 text-[#E05C50] animate-spin mx-auto mb-4" />
        <p className="text-sm font-medium text-gray-600">Verificando enlace de recuperación...</p>
      </div>
    )
  }

  if (!hasValidSession) {
    return (
      <div className="text-center py-4">
        <div className="mx-auto w-12 h-12 rounded-2xl bg-amber-50 border border-amber-200 flex items-center justify-center text-amber-600 mb-4">
          <AlertCircle className="w-6 h-6" />
        </div>
        <h2 className="text-xl font-bold tracking-tight text-gray-900">Enlace no válido o expirado</h2>
        <p className="text-sm text-gray-500 mt-2 leading-relaxed">
          Por motivos de seguridad, los enlaces para restablecer contraseña son de un solo uso y tienen una vigencia limitada.
        </p>

        <div className="mt-8 space-y-3">
          <Link
            href="/forgot-password"
            className="flex w-full justify-center rounded-xl bg-[#E05C50] px-4 py-3 text-sm font-semibold text-white shadow-sm hover:bg-[#c94b40] transition-all hover:scale-[1.02]"
          >
            Solicitar nuevo enlace
          </Link>
          <Link
            href="/login"
            className="flex w-full justify-center rounded-xl bg-white px-4 py-3 text-sm font-semibold text-gray-700 ring-1 ring-inset ring-gray-300 hover:bg-gray-50 transition-colors"
          >
            Volver a Iniciar Sesión
          </Link>
        </div>
      </div>
    )
  }

  return (
    <>
      <div className="text-center mb-8">
        <div className="mx-auto w-12 h-12 rounded-2xl bg-[#E05C50]/10 flex items-center justify-center text-[#E05C50] mb-4">
          <Lock className="w-6 h-6" />
        </div>
        <h2 className="text-2xl font-bold tracking-tight text-gray-900">Establecer Nueva Contraseña</h2>
        <p className="text-sm text-gray-500 mt-2">
          {userEmail ? (
            <>Crea tu nueva contraseña para <strong>{userEmail}</strong>.</>
          ) : (
            <>Crea una contraseña segura para tu cuenta.</>
          )}
        </p>
      </div>

      {errorMsg && (
        <div className="mb-6 p-4 rounded-xl bg-red-50 border border-red-200 text-sm text-red-700 flex items-start gap-3 animate-in fade-in">
          <AlertCircle className="w-5 h-5 text-red-500 shrink-0 mt-0.5" />
          <div>
            <p className="font-semibold">Atención</p>
            <p className="mt-0.5 text-red-600">{errorMsg}</p>
          </div>
        </div>
      )}

      {successMsg && (
        <div className="mb-6 p-4 rounded-xl bg-emerald-50 border border-emerald-200 text-sm text-emerald-800 flex items-start gap-3 animate-in fade-in">
          <CheckCircle className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
          <div>
            <p className="font-semibold">¡Completado!</p>
            <p className="mt-0.5 text-emerald-700">{successMsg}</p>
          </div>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-5">
        <div>
          <label htmlFor="new-password" className="block text-sm font-medium leading-6 text-gray-900">
            Nueva Contraseña
          </label>
          <div className="mt-2 relative">
            <input
              id="new-password"
              type={showPassword ? 'text' : 'password'}
              required
              minLength={6}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="block w-full rounded-xl border-0 py-3 pl-4 pr-12 text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 placeholder:text-gray-400 focus:ring-2 focus:ring-inset focus:ring-[#E05C50] sm:text-sm sm:leading-6 transition-all"
              placeholder="Mínimo 6 caracteres"
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="absolute inset-y-0 right-0 flex items-center pr-3 text-gray-400 hover:text-gray-600 focus:outline-none transition-colors"
            >
              {showPassword ? (
                <EyeOff className="h-5 w-5" aria-hidden="true" />
              ) : (
                <Eye className="h-5 w-5" aria-hidden="true" />
              )}
            </button>
          </div>
        </div>

        <div>
          <label htmlFor="confirm-password" className="block text-sm font-medium leading-6 text-gray-900">
            Confirmar Contraseña
          </label>
          <div className="mt-2 relative">
            <input
              id="confirm-password"
              type={showConfirmPassword ? 'text' : 'password'}
              required
              minLength={6}
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              className="block w-full rounded-xl border-0 py-3 pl-4 pr-12 text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 placeholder:text-gray-400 focus:ring-2 focus:ring-inset focus:ring-[#E05C50] sm:text-sm sm:leading-6 transition-all"
              placeholder="Repite tu nueva contraseña"
            />
            <button
              type="button"
              onClick={() => setShowConfirmPassword(!showConfirmPassword)}
              className="absolute inset-y-0 right-0 flex items-center pr-3 text-gray-400 hover:text-gray-600 focus:outline-none transition-colors"
            >
              {showConfirmPassword ? (
                <EyeOff className="h-5 w-5" aria-hidden="true" />
              ) : (
                <Eye className="h-5 w-5" aria-hidden="true" />
              )}
            </button>
          </div>
        </div>

        <button
          type="submit"
          disabled={isSubmitting || !!successMsg}
          className="flex w-full justify-center items-center gap-2 rounded-xl bg-[#E05C50] px-3 py-3 text-sm font-semibold leading-6 text-white shadow-sm hover:bg-[#c94b40] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#E05C50] transition-all hover:scale-[1.02] disabled:opacity-50 disabled:pointer-events-none"
        >
          {isSubmitting ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              Guardando contraseña...
            </>
          ) : (
            'Guardar Contraseña e Ingresar'
          )}
        </button>
      </form>

      <div className="mt-8 pt-6 border-t border-gray-100 flex items-center justify-center text-sm">
        <Link
          href="/login"
          className="inline-flex items-center gap-1.5 font-medium text-gray-600 hover:text-gray-900 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          Volver a Iniciar Sesión
        </Link>
      </div>
    </>
  )
}

