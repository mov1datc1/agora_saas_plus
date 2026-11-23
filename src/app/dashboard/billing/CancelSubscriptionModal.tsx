'use client'

import { useState } from 'react'
import { AlertCircle, X, AlertTriangle } from 'lucide-react'

import { useRouter } from 'next/navigation'

interface CancelSubscriptionModalProps {
  isTrial?: boolean
  currentPeriodEnd?: string | null
}

export default function CancelSubscriptionModal({
  isTrial = false,
  currentPeriodEnd = null,
}: CancelSubscriptionModalProps) {
  const router = useRouter()
  const [isOpen, setIsOpen] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const formattedPeriodEnd = currentPeriodEnd
    ? new Date(currentPeriodEnd).toLocaleDateString('es-ES', {
        day: 'numeric',
        month: 'long',
        year: 'numeric',
      })
    : 'el final de tu ciclo de facturación actual'

  const handleCancel = async () => {
    try {
      setIsLoading(true)
      setError(null)
      const res = await fetch('/api/subscription/cancel', {
        method: 'POST',
      })

      if (!res.ok) {
        throw new Error('Error al cancelar la suscripción')
      }

      const data = await res.json().catch(() => ({}))
      setIsOpen(false)

      if (data.cancelAtPeriodEnd) {
        router.refresh()
      } else {
        router.push('/deactivated')
      }
    } catch (err: any) {
      setError(err.message)
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <>
      <button
        onClick={() => setIsOpen(true)}
        className="rounded-xl px-6 py-3 text-sm font-semibold text-gray-700 bg-white shadow-sm ring-1 ring-inset ring-gray-300 hover:bg-gray-50 transition-all focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gray-600"
      >
        Cancelar Suscripción
      </button>

      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-gray-900/50 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full overflow-hidden animate-in zoom-in-95 duration-200">
            <div className="p-6">
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-3 text-red-600">
                  <div className="p-2 bg-red-100 rounded-full">
                    <AlertTriangle className="h-6 w-6" />
                  </div>
                  <h3 className="text-xl font-bold text-gray-900">¿Deseas cancelar tu suscripción?</h3>
                </div>
                <button 
                  onClick={() => setIsOpen(false)}
                  className="text-gray-400 hover:text-gray-500 transition-colors"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              <div className="mt-6 space-y-4 text-sm text-gray-600">
                <p className="font-medium text-gray-900">Por favor, lee con atención antes de confirmar tu cancelación:</p>
                <ul className="space-y-3 list-disc pl-5">
                  {isTrial ? (
                    <>
                      <li>
                        <strong>Cancelación Inmediata:</strong> Al cancelar durante tu prueba gratuita, perderás de inmediato el acceso a la plataforma y al buscador de operaciones.
                      </li>
                      <li>
                        <strong>Garantía de Cero Cargos:</strong> Confirmamos que no se realizará ningún cargo a tu tarjeta registrada.
                      </li>
                    </>
                  ) : (
                    <>
                      <li>
                        <strong>Mantienes Acceso Completo:</strong> Seguirás teniendo acceso total a Ágora hasta el <strong>{formattedPeriodEnd}</strong>, fecha en la que finaliza el mes ya pagado.
                      </li>
                      <li>
                        <strong>Sin Renovaciones Automáticas:</strong> Confirmamos que no se realizará ningún cargo futuro a tu tarjeta registrada.
                      </li>
                    </>
                  )}
                  <li>
                    <strong>Reactivación Disponible:</strong> Si cambias de opinión, podrás reactivar tu suscripción desde el portal de facturación o escribiendo a nuestro equipo de soporte.
                  </li>
                </ul>
              </div>

              {error && (
                <div className="mt-6 flex items-center gap-2 text-sm text-red-600 bg-red-50 p-3 rounded-lg">
                  <AlertCircle className="h-5 w-5 flex-none" />
                  <p>{error}</p>
                </div>
              )}
            </div>

            <div className="bg-gray-50 px-6 py-4 flex flex-col-reverse sm:flex-row gap-3 justify-end rounded-b-2xl">
              <button
                onClick={() => setIsOpen(false)}
                disabled={isLoading}
                className="w-full sm:w-auto px-4 py-2.5 text-sm font-semibold text-gray-900 bg-white border border-gray-300 rounded-lg shadow-sm hover:bg-gray-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gray-600 transition-all"
              >
                Mantener Suscripción
              </button>
              <button
                onClick={handleCancel}
                disabled={isLoading}
                className="w-full sm:w-auto px-4 py-2.5 text-sm font-semibold text-white bg-red-600 rounded-lg shadow-sm hover:bg-red-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-red-600 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex justify-center items-center gap-2"
              >
                {isLoading ? (
                  <>
                    <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></span>
                    Procesando...
                  </>
                ) : (
                  'Sí, quiero cancelar'
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
