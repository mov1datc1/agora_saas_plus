import { CreditCard, CheckCircle2, AlertCircle } from 'lucide-react'

export default function BillingPage() {
  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700 max-w-4xl">
      <div>
        <h2 className="text-3xl font-bold tracking-tight text-gray-900">Suscripción y Pago</h2>
        <p className="mt-2 text-sm text-gray-500">
          Gestiona tu plan activo, método de pago e historial de facturación.
        </p>
      </div>

      {/* Subscription Status Card */}
      <div className="overflow-hidden rounded-2xl bg-white shadow-sm ring-1 ring-gray-100">
        <div className="px-6 py-8 sm:p-10">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-base font-semibold leading-7 text-gray-900">Plan Actual</h3>
              <div className="mt-2 flex items-baseline gap-x-2">
                <span className="text-5xl font-bold tracking-tight text-gray-900">Prueba Activa</span>
              </div>
              <p className="mt-4 text-sm leading-6 text-gray-600">
                Tienes acceso total a todas las métricas de M&A y el directorio de firmas.
              </p>
            </div>
            <div className="hidden sm:block">
              <span className="inline-flex items-center gap-x-1.5 rounded-full bg-green-100 px-4 py-2 text-sm font-semibold text-green-700">
                <span className="h-2 w-2 rounded-full bg-green-500 animate-pulse" />
                14 días restantes
              </span>
            </div>
          </div>
          
          <div className="mt-8 flex flex-col sm:flex-row gap-4">
            <button className="rounded-xl bg-[#E05C50] px-6 py-3 text-sm font-semibold text-white shadow-sm hover:bg-[#c94b40] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#E05C50] transition-all">
              Pasar a Plan Pro ahora
            </button>
            <button className="rounded-xl bg-white px-6 py-3 text-sm font-semibold text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 hover:bg-gray-50 transition-all">
              Cancelar prueba
            </button>
          </div>
        </div>
        <div className="bg-gray-50 px-6 py-6 sm:px-10 flex items-start gap-4 border-t border-gray-100">
          <AlertCircle className="h-5 w-5 text-amber-500 flex-shrink-0 mt-0.5" />
          <p className="text-sm text-gray-600 leading-relaxed">
            Tu tarjeta será cargada automáticamente por <span className="font-semibold text-gray-900">$299.00 USD/mes</span> al finalizar tu prueba el <strong>25 de Junio de 2026</strong>. Cancela en cualquier momento antes de esta fecha para evitar cargos.
          </p>
        </div>
      </div>

      {/* Payment Method Card */}
      <div className="overflow-hidden rounded-2xl bg-white shadow-sm ring-1 ring-gray-100">
        <div className="px-6 py-6 border-b border-gray-100">
          <h3 className="text-lg font-semibold leading-6 text-gray-900">Método de Pago</h3>
        </div>
        <div className="px-6 py-6 sm:p-8">
          <div className="flex items-center gap-6">
            <div className="flex h-16 w-24 items-center justify-center rounded-lg border border-gray-200 bg-gray-50">
              <CreditCard className="h-8 w-8 text-gray-400" />
            </div>
            <div className="flex-1">
              <p className="text-base font-medium text-gray-900">Termina en •••• 4242</p>
              <p className="text-sm text-gray-500">Expira 12/2028</p>
            </div>
            <div>
              <button className="text-sm font-semibold text-[#E05C50] hover:text-[#c94b40]">
                Actualizar tarjeta
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Invoices List */}
      <div className="overflow-hidden rounded-2xl bg-white shadow-sm ring-1 ring-gray-100">
        <div className="px-6 py-6 border-b border-gray-100">
          <h3 className="text-lg font-semibold leading-6 text-gray-900">Historial de Facturación</h3>
        </div>
        <div className="px-6 py-6 sm:p-8 text-center text-sm text-gray-500">
          <p>No tienes facturas generadas aún. Tu primera factura se generará al finalizar tu periodo de prueba.</p>
        </div>
      </div>

    </div>
  )
}
