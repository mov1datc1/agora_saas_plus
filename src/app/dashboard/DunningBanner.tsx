import { AlertCircle } from 'lucide-react'
import Link from 'next/link'

interface DunningBannerProps {
  status: string
}

export default function DunningBanner({ status }: DunningBannerProps) {
  // Solo mostramos el banner si el estado es past_due o unpaid
  if (status !== 'PAST_DUE' && status !== 'UNPAID') {
    return null
  }

  return (
    <div className="bg-red-600 px-4 py-3 text-white sm:px-6 lg:px-8 shadow-md relative z-50">
      <div className="mx-auto flex max-w-7xl items-center justify-between gap-x-6">
        <div className="flex items-center gap-x-3">
          <AlertCircle className="h-6 w-6 text-white/90" aria-hidden="true" />
          <p className="text-sm font-medium leading-6">
            <strong className="font-bold">Acción Requerida:</strong> Hubo un problema al procesar tu último pago. Por favor, actualiza tu método de pago para evitar la interrupción del servicio.
          </p>
        </div>
        <Link
          href="/dashboard/billing"
          className="flex-none rounded-full bg-white px-4 py-1.5 text-sm font-bold text-red-600 shadow-sm hover:bg-red-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white transition-colors"
        >
          Actualizar Tarjeta
        </Link>
      </div>
    </div>
  )
}
