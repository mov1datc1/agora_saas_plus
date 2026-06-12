import { CreditCard, CheckCircle2, AlertCircle } from 'lucide-react'
import { createClient } from '@/utils/supabase/server'
import prisma from '@/lib/prisma'
import { redirect } from 'next/navigation'
import CheckoutButton from './CheckoutButton'
import PortalButton from './PortalButton'
import CancelSubscriptionModal from './CancelSubscriptionModal'

export default async function BillingPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user || !user.email) {
    redirect('/login')
  }

  const dbUser = await prisma.user.findUnique({
    where: { email: user.email },
    include: { subscription: true }
  })

  const subscription = dbUser?.subscription
  const hasActiveTrial = subscription?.status === 'TRIAL'
  const isCanceled = subscription?.status === 'CANCELED'
  const isCancelingAtPeriodEnd = subscription?.cancelAtPeriodEnd

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700 max-w-4xl">
      <div>
        <h2 className="text-3xl font-bold tracking-tight text-gray-900">Suscripción y Pago</h2>
        <p className="mt-2 text-sm text-gray-500">
          Gestiona tu plan activo, método de pago e historial de facturación.
        </p>
      </div>

      {(!subscription || subscription.status === 'INCOMPLETE') ? (
        <div className="bg-white p-12 rounded-3xl border border-gray-100 shadow-sm text-center">
          <h3 className="text-2xl font-bold text-gray-900 mb-4">Empieza tu Prueba Gratuita</h3>
          <p className="text-gray-500 max-w-lg mx-auto mb-8 leading-relaxed">
            Obtén acceso total a la plataforma de Ágora Plus durante 15 días. Se requiere tarjeta de crédito para evitar interrupciones, pero no se hará ningún cargo hasta que termine el periodo de prueba.
          </p>
          <CheckoutButton />
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="bg-white rounded-3xl p-8 border border-gray-100 shadow-sm flex flex-col justify-between relative overflow-hidden">
            <div className="absolute top-0 right-0 p-8 opacity-5">
              <CreditCard className="w-32 h-32" />
            </div>
            
            <div>
              <div className="flex items-center gap-3 mb-6">
                <div className={`p-2 rounded-full ${hasActiveTrial ? 'bg-amber-100' : isCanceled ? 'bg-red-100' : 'bg-green-100'}`}>
                  <CreditCard className={`w-5 h-5 ${hasActiveTrial ? 'text-amber-600' : isCanceled ? 'text-red-600' : 'text-green-600'}`} />
                </div>
                <h3 className="text-lg font-semibold text-gray-900">Plan Actual</h3>
              </div>
              
              <div className="space-y-1">
                <p className="text-4xl font-bold text-gray-900">
                  {isCanceled ? 'Cancelado' : 'Ágora Plus'}
                </p>
                <p className="text-sm font-medium text-gray-500 flex items-center gap-2">
                  Estado: 
                  <span className={`inline-flex items-center rounded-full px-2 py-1 text-xs font-medium ring-1 ring-inset ${
                    hasActiveTrial ? 'bg-amber-50 text-amber-700 ring-amber-600/20' : 
                    isCanceled ? 'bg-red-50 text-red-700 ring-red-600/20' : 
                    'bg-green-50 text-green-700 ring-green-600/20'
                  }`}>
                    {hasActiveTrial ? 'Prueba Activa' : isCanceled ? 'Cancelado' : 'Activo'}
                  </span>
                </p>
              </div>
              
              {isCancelingAtPeriodEnd && (
                <div className="mt-4 bg-red-50 border border-red-100 rounded-xl p-3 flex items-start gap-2">
                  <AlertCircle className="w-5 h-5 text-red-600 flex-none mt-0.5" />
                  <p className="text-sm text-red-800">
                    Tu suscripción se cancelará automáticamente el <strong>{subscription.currentPeriodEnd?.toLocaleDateString()}</strong>. Después de esta fecha perderás acceso a la plataforma.
                  </p>
                </div>
              )}
              
              <div className="mt-8 flex flex-col sm:flex-row gap-4">
                <PortalButton />
                {!isCanceled && !isCancelingAtPeriodEnd && (
                  <CancelSubscriptionModal />
                )}
              </div>
            </div>
            {hasActiveTrial && subscription.trialEndsAt && (
              <div className="bg-gray-50 px-6 py-6 sm:px-10 flex items-start gap-4 border-t border-gray-100">
                <AlertCircle className="h-5 w-5 text-amber-500 flex-shrink-0 mt-0.5" />
                <p className="text-sm text-gray-600 leading-relaxed">
                  Tu tarjeta será cargada automáticamente al finalizar tu prueba el <strong>{subscription.trialEndsAt.toLocaleDateString('es-ES', { day: 'numeric', month: 'long', year: 'numeric' })}</strong>. Cancela en cualquier momento antes de esta fecha para evitar cargos.
                </p>
              </div>
            )}
          </div>
          </div>
      )}
    </div>
  )
}
