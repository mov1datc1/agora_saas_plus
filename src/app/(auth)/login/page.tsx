import { login } from './actions'
import Link from 'next/link'

export default function LoginPage() {
  return (
    <>
      <div className="text-center mb-8">
        <h2 className="text-2xl font-bold tracking-tight text-gray-900">Bienvenido de nuevo</h2>
        <p className="text-sm text-gray-500 mt-2">
          Ingresa a tu cuenta para acceder a la inteligencia de negocios.
        </p>
      </div>

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

        <div>
          <div className="flex items-center justify-between">
            <label htmlFor="password" className="block text-sm font-medium leading-6 text-gray-900">
              Contraseña
            </label>
            <div className="text-sm">
              <a href="#" className="font-semibold text-[#E05C50] hover:text-[#c94b40] transition-colors">
                ¿Olvidaste tu contraseña?
              </a>
            </div>
          </div>
          <div className="mt-2">
            <input
              id="password"
              name="password"
              type="password"
              autoComplete="current-password"
              required
              className="block w-full rounded-xl border-0 py-3 px-4 text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 placeholder:text-gray-400 focus:ring-2 focus:ring-inset focus:ring-[#E05C50] sm:text-sm sm:leading-6 transition-all"
              placeholder="••••••••"
            />
          </div>
        </div>

        <div>
          <button
            formAction={login}
            className="flex w-full justify-center rounded-xl bg-[#E05C50] px-3 py-3 text-sm font-semibold leading-6 text-white shadow-sm hover:bg-[#c94b40] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#E05C50] transition-all hover:scale-[1.02]"
          >
            Iniciar Sesión
          </button>
        </div>
      </form>

      <p className="mt-8 text-center text-sm text-gray-500">
        ¿No tienes una cuenta?{' '}
        <Link href="/register" className="font-semibold leading-6 text-[#E05C50] hover:text-[#c94b40] transition-colors">
          Comienza tu prueba gratuita
        </Link>
      </p>
    </>
  )
}
