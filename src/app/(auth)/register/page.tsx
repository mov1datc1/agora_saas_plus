import { signup } from './actions'
import Link from 'next/link'

export default function RegisterPage() {
  return (
    <>
      <div className="text-center mb-8">
        <h2 className="text-2xl font-bold tracking-tight text-gray-900">Crea tu cuenta</h2>
        <p className="text-sm text-gray-500 mt-2">
          Inicia tu prueba gratuita de 15 días hoy mismo.
        </p>
      </div>

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
              className="block w-full rounded-xl border-0 py-3 text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 placeholder:text-gray-400 focus:ring-2 focus:ring-inset focus:ring-[#E05C50] sm:text-sm sm:leading-6 transition-all"
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
              className="block w-full rounded-xl border-0 py-3 text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 placeholder:text-gray-400 focus:ring-2 focus:ring-inset focus:ring-[#E05C50] sm:text-sm sm:leading-6 transition-all"
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
              className="block w-full rounded-xl border-0 py-3 text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 placeholder:text-gray-400 focus:ring-2 focus:ring-inset focus:ring-[#E05C50] sm:text-sm sm:leading-6 transition-all"
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
