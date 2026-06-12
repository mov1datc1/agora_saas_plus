import { CheckCircle2 } from 'lucide-react'
import Link from 'next/link'

export default function SuccessPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
      <div className="max-w-md w-full bg-white rounded-3xl shadow-xl overflow-hidden animate-in zoom-in-95 duration-500">
        <div className="bg-green-500 p-8 text-center flex flex-col items-center">
          <div className="bg-white/20 p-3 rounded-full mb-4">
            <CheckCircle2 className="w-12 h-12 text-white" />
          </div>
          <h1 className="text-2xl font-bold text-white">¡Pago Exitoso!</h1>
        </div>
        <div className="p-8 text-center space-y-6">
          <p className="text-gray-600 text-base leading-relaxed">
            Tu prueba gratuita de 15 días ha sido activada correctamente.
          </p>
          <div className="bg-gray-50 rounded-xl p-4 border border-gray-100">
            <h3 className="font-semibold text-gray-900 mb-2">Revisa tu correo</h3>
            <p className="text-sm text-gray-500">
              Te hemos enviado un enlace de acceso seguro a tu correo electrónico para que inicies sesión y establezcas tu contraseña.
            </p>
          </div>
          <div className="pt-4">
            <Link 
              href="/login"
              className="w-full flex items-center justify-center py-3 px-4 border border-transparent rounded-xl shadow-sm text-sm font-semibold text-white bg-[#E05C50] hover:bg-[#c94b40] focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-[#E05C50] transition-colors"
            >
              Ir a Iniciar Sesión
            </Link>
          </div>
        </div>
      </div>
    </div>
  )
}
