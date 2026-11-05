'use client'

import { Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import { sendPasswordResetLink } from './actions'
import Link from 'next/link'
import { AlertCircle, CheckCircle, ArrowLeft, Mail } from 'lucide-react'

function FeedbackAlerts() {
  const searchParams = useSearchParams()
  const rawError = searchParams.get('error')
  const rawMessage = searchParams.get('message')

  if (rawError && rawError !== '{}') {
    return (
      <div className="mb-6 p-4 rounded-xl bg-red-50 border border-red-200 text-sm text-red-700 flex items-start gap-3 animate-in fade-in">
        <AlertCircle className="w-5 h-5 text-red-500 shrink-0 mt-0.5" />
        <div>
          <p className="font-semibold">No se pudo enviar el enlace</p>
          <p className="mt-0.5 text-red-600">{decodeURIComponent(rawError)}</p>
        </div>
      </div>
    )
  }

  if (rawMessage) {
    return (
      <div className="mb-6 p-4 rounded-xl bg-emerald-50 border border-emerald-200 text-sm text-emerald-800 flex items-start gap-3 animate-in fade-in">
        <CheckCircle className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
        <div>
          <p className="font-semibold">Revisa tu correo</p>
          <p className="mt-0.5 text-emerald-700">{decodeURIComponent(rawMessage)}</p>
        </div>
      </div>
    )
  }

  return null
}

export default function ForgotPasswordPage() {
  return (
    <>
      <div className="text-center mb-8">
        <div className="mx-auto w-12 h-12 rounded-2xl bg-[#E05C50]/10 flex items-center justify-center text-[#E05C50] mb-4">
          <Mail className="w-6 h-6" />
        </div>
        <h2 className="text-2xl font-bold tracking-tight text-gray-900">¿Olvidaste tu contraseña?</h2>
        <p className="text-sm text-gray-500 mt-2">
          Ingresa tu correo registrado y te enviaremos un enlace seguro para restablecerla.
        </p>
      </div>

      <Suspense fallback={null}>
        <FeedbackAlerts />
      </Suspense>

      <form className="space-y-6">
        <div>
          <label htmlFor="email" className="block text-sm font-medium leading-6 text-gray-900">
            Correo Electrónico
          </label>
          <div className="mt-2">
            <input
              id="email"
              name="email"
              type="email"
              autoComplete="email"
              required
              className="block w-full rounded-xl border-0 py-3 px-4 text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 placeholder:text-gray-400 focus:ring-2 focus:ring-inset focus:ring-[#E05C50] sm:text-sm sm:leading-6 transition-all"
              placeholder="tu@empresa.com"
            />
          </div>
        </div>

        <button
          formAction={sendPasswordResetLink}
          className="flex w-full justify-center rounded-xl bg-[#E05C50] px-3 py-3 text-sm font-semibold leading-6 text-white shadow-sm hover:bg-[#c94b40] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#E05C50] transition-all hover:scale-[1.02]"
        >
          Enviar Enlace de Recuperación
        </button>
      </form>

      <div className="mt-8 pt-6 border-t border-gray-100 flex items-center justify-between text-sm">
        <Link
          href="/login"
          className="inline-flex items-center gap-1.5 font-medium text-gray-600 hover:text-gray-900 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          Volver a Iniciar Sesión
        </Link>
        <Link
          href="/register"
          className="font-semibold text-[#E05C50] hover:text-[#c94b40] transition-colors"
        >
          Crear cuenta
        </Link>
      </div>
    </>
  )
}
