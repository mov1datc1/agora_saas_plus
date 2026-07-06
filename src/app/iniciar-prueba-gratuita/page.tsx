import { Check } from 'lucide-react'
import Image from 'next/image'
import Link from 'next/link'
import prisma from '@/lib/prisma'
import ScriptRenderer from './ScriptRenderer'

export const dynamic = 'force-dynamic'

export default async function IniciarPruebaGratuita() {
  const config = await prisma.systemConfig.findUnique({
    where: { id: 'global' }
  })
  
  const leadScript = config?.leadFormScript || null

  const features = [
    "Comparativo entre mercados geográficos.",
    "Especialidades.",
    "Transacciones por industria.",
    "Actividades en industrias.",
    "Filtros adaptables.",
    "Informes detallados con datos personalizados.",
    "Histórico de actividades realizadas.",
    "Interconexión con PerfilPlus para firmas de abogados."
  ]

  return (
    <div className="min-h-screen bg-white flex">
      {/* Columna Izquierda - Beneficios */}
      <div className="hidden lg:flex lg:w-1/2 bg-gray-50 flex-col justify-center px-16 py-12">
        <div className="max-w-xl">
          <h1 className="text-3xl lg:text-4xl font-bold text-gray-900 leading-tight mb-10">
            Con Ágora tendrás acceso a información sobre las operaciones de adquisiciones y financiamientos corporativos en América Latina
          </h1>
          
          <ul className="space-y-4 mb-10">
            {features.map((feature, i) => (
              <li key={i} className="flex items-start">
                <Check className="h-6 w-6 text-brand shrink-0 mr-3 mt-0.5" strokeWidth={3} />
                <span className="text-gray-800 text-lg">{feature}</span>
              </li>
            ))}
          </ul>
          
          <p className="text-sm text-gray-500 italic">
            Al completar este formulario, accede a 15 días de prueba gratuita. Al vencer ese período, se activará automáticamente la suscripción paga de la licencia individual. Puedes cancelar en cualquier momento antes del vencimiento para evitar el cobro.
          </p>
        </div>
      </div>

      {/* Columna Derecha - Formulario */}
      <div className="w-full lg:w-1/2 flex flex-col items-center py-12 px-6 sm:px-12 lg:px-20 overflow-y-auto">
        <div className="w-full max-w-md">
          {/* Logo */}
          <div className="flex justify-center lg:justify-start mb-8">
            <Link href="/">
              <Image 
                src="/logo.png" 
                alt="Ágora Logo" 
                width={160} 
                height={50} 
                className="h-12 w-auto object-contain"
              />
            </Link>
          </div>
          
          <h2 className="text-gray-800 font-medium text-lg mb-8 text-center lg:text-left">
            Completa el formulario y obtén tu prueba gratuita de <strong>Ágora</strong>.
          </h2>

          <div className="w-full">
            {leadScript ? (
              // Componente cliente para renderizar el script
              <ScriptRenderer script={leadScript} />
            ) : (
              <div className="bg-amber-50 border border-amber-200 p-6 rounded-xl text-center">
                <p className="text-amber-800 mb-6 text-sm">
                  (Modo de desarrollo: El script del CRM aún no se ha configurado en Administración).
                </p>
                <Link
                  href="/api/checkout"
                  className="block w-full bg-brand text-white font-semibold py-3 rounded-lg hover:bg-brand-hover transition-colors shadow-sm"
                >
                  Continuar al Pago Directo
                </Link>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
