import { signup } from './actions'
import Link from 'next/link'
import { AlertCircle, ArrowRight } from 'lucide-react'

export default async function RegisterPage(props: {
  searchParams?: Promise<{ error?: string; alreadyRegistered?: string; email?: string }>
}) {
  const searchParams = props.searchParams ? await props.searchParams : {}
  const alreadyRegistered = searchParams?.alreadyRegistered === 'true'
  const emailParam = searchParams?.email || ''
  const errorParam = searchParams?.error

  return (
    <>
      <div className="text-center mb-8">
        <h2 className="text-2xl font-bold tracking-tight text-gray-900">Crea tu cuenta</h2>
        <p className="text-sm text-gray-500 mt-2">
          Inicia tu prueba gratuita de 15 días hoy mismo.
        </p>
      </div>

      {alreadyRegistered && (
        <div className="mb-6 rounded-2xl bg-amber-50 p-5 border border-amber-200 text-left animate-in fade-in duration-300">
          <div className="flex items-start gap-3">
            <AlertCircle className="h-5 w-5 text-amber-600 flex-shrink-0 mt-0.5" />
            <div className="space-y-2">
              <h3 className="text-sm font-bold text-amber-900">
                Este correo ya se registró para una prueba gratuita
              </h3>
              <p className="text-xs text-amber-800 leading-relaxed">
                El periodo de prueba para <strong>{emailParam || 'este correo'}</strong> ya fue utilizado o finalizado. Si deseas suscribirte a Ágora Plus, puedes ingresar al checkout para pagar tu plan oficial.
              </p>
              <div className="pt-1">
                <Link
                  href={`/api/public-checkout?email=${encodeURIComponent(emailParam)}&noTrial=true`}
                  className="inline-flex items-center gap-1.5 rounded-xl bg-[#E05C50] px-4 py-2 text-xs font-bold text-white shadow-sm hover:bg-[#c94b40] transition-colors"
                >
                  Ir al Checkout y Pagar
                  <ArrowRight className="h-3.5 w-3.5" />
                </Link>
              </div>
            </div>
          </div>
        </div>
      )}

      {errorParam && !alreadyRegistered && (
        <div className="mb-6 rounded-xl bg-red-50 p-4 border border-red-200 text-sm text-red-700 flex items-center gap-2">
          <AlertCircle className="h-5 w-5 flex-shrink-0 text-red-500" />
          <span>{decodeURIComponent(errorParam)}</span>
        </div>
      )}

      <form className="space-y-6">
        <div>
          <label htmlFor="name" className="block text-sm font-medium leading-6 text-gray-900">
            Nombre Completo
          </label>
          <div className="mt-2">
            <input
              id="name"
              name="name"
              type="text"
              autoComplete="name"
              required
              className="block w-full rounded-xl border-0 py-3 px-4 text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 placeholder:text-gray-400 focus:ring-2 focus:ring-inset focus:ring-[#E05C50] sm:text-sm sm:leading-6 transition-all"
              placeholder="Juan Pérez"
            />
          </div>
        </div>

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

        <div>
          <label htmlFor="password" className="block text-sm font-medium leading-6 text-gray-900">
            Contraseña
          </label>
          <div className="mt-2">
            <input
              id="password"
              name="password"
              type="password"
              autoComplete="new-password"
              required
              className="block w-full rounded-xl border-0 py-3 px-4 text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 placeholder:text-gray-400 focus:ring-2 focus:ring-inset focus:ring-[#E05C50] sm:text-sm sm:leading-6 transition-all"
              placeholder="••••••••"
            />
          </div>
        </div>

        <div>
          <button
            formAction={signup}
            className="flex w-full justify-center rounded-xl bg-[#E05C50] px-3 py-3 text-sm font-semibold leading-6 text-white shadow-sm hover:bg-[#c94b40] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#E05C50] transition-all hover:scale-[1.02]"
          >
            Registrarse y Continuar
          </button>
        </div>
      </form>

      <p className="mt-8 text-center text-sm text-gray-500">
        ¿Ya tienes una cuenta?{' '}
        <Link href="/login" className="font-semibold leading-6 text-[#E05C50] hover:text-[#c94b40] transition-colors">
          Inicia sesión aquí
        </Link>
      </p>
    </>
  )
}
