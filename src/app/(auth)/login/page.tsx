'use client'

import { useState } from 'react'
import { login, loginWithMagicLink } from './actions'
import Link from 'next/link'
import { Eye, EyeOff } from 'lucide-react'

export default function LoginPage() {
  const [showPassword, setShowPassword] = useState(false)

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
          <div className="mt-2 relative">
            <input
              id="password"
              name="password"
              type={showPassword ? 'text' : 'password'}
              autoComplete="current-password"
              className="block w-full rounded-xl border-0 py-3 pl-4 pr-12 text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 placeholder:text-gray-400 focus:ring-2 focus:ring-inset focus:ring-[#E05C50] sm:text-sm sm:leading-6 transition-all"
              placeholder="•••••••• (Opcional si usas Enlace Mágico)"
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

        <div className="space-y-3">
          <button
            formAction={login}
            className="flex w-full justify-center rounded-xl bg-[#E05C50] px-3 py-3 text-sm font-semibold leading-6 text-white shadow-sm hover:bg-[#c94b40] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#E05C50] transition-all hover:scale-[1.02]"
          >
            Iniciar Sesión con Contraseña
          </button>
          
          <div className="relative">
            <div className="absolute inset-0 flex items-center" aria-hidden="true">
              <div className="w-full border-t border-gray-200" />
            </div>
            <div className="relative flex justify-center text-sm font-medium leading-6">
              <span className="bg-white px-6 text-gray-900">O sin contraseña</span>
            </div>
          </div>

          <button
            formAction={loginWithMagicLink}
            className="flex w-full justify-center rounded-xl bg-white px-3 py-3 text-sm font-semibold leading-6 text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 hover:bg-gray-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#E05C50] transition-all hover:scale-[1.02]"
          >
            Enviar Enlace Mágico de Acceso
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
