import { CreditCard, CheckCircle2, AlertCircle } from 'lucide-react'
import { createClient } from '@/utils/supabase/server'
import prisma from '@/lib/prisma'
import { redirect } from 'next/navigation'
import CheckoutButton from './CheckoutButton'
import PortalButton from './PortalButton'

export default async function BillingPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user?.email) {
    redirect('/login')
  }

  const dbUser = await prisma.user.findUnique({
    where: { email: user.email },
    include: { subscription: true }
  })

  if (!dbUser) {
    redirect('/login')
  }

  const subscription = dbUser.subscription
  const hasActiveTrial = subscription && subscription.status === 'TRIAL'
  const isActive = subscription && subscription.status === 'ACTIVE'
  
  let daysLeft = 0
  if (hasActiveTrial && subscription.trialEndsAt) {
    const diffTime = subscription.trialEndsAt.getTime() - new Date().getTime()
    daysLeft = Math.ceil(diffTime / (1000 * 60 * 60 * 24))
  }

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700 max-w-4xl">
      <div>
        <h2 className="text-3xl font-bold tracking-tight text-gray-900">Suscripción y Pago</h2>
        <p className="mt-2 text-sm text-gray-500">
          Gestiona tu plan activo, método de pago e historial de facturación.
        </p>
      </div>

      {!subscription || subscription.status === 'INCOMPLETE' || subscription.status === 'CANCELED' ? (
        <div className="overflow-hidden rounded-2xl bg-white shadow-sm ring-1 ring-gray-100">
          <div className="px-6 py-8 sm:p-10 text-center">
            <h3 className="text-2xl font-bold leading-7 text-gray-900 mb-4">Empieza tu Prueba Gratuita</h3>
            <p className="text-gray-600 mb-8 max-w-lg mx-auto">
              Obtén acceso total a la plataforma de Ágora Plus durante 15 días. Se requiere tarjeta de crédito para evitar interrupciones, pero no se hará ningún cargo hasta que termine el periodo de prueba.
            </p>
            <CheckoutButton />
          </div>
        </div>
      ) : (
        <>
          {/* Subscription Status Card */}
          <div className="overflow-hidden rounded-2xl bg-white shadow-sm ring-1 ring-gray-100">
            <div className="px-6 py-8 sm:p-10">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-base font-semibold leading-7 text-gray-900">Plan Actual</h3>
                  <div className="mt-2 flex items-baseline gap-x-2">
                    <span className="text-5xl font-bold tracking-tight text-gray-900">
                      {hasActiveTrial ? 'Prueba Activa' : 'Plan Pro'}
                    </span>
                  </div>
                  <p className="mt-4 text-sm leading-6 text-gray-600">
                    Tienes acceso total a todas las métricas de M&A y el directorio de firmas.
                  </p>
                </div>
                {hasActiveTrial && daysLeft > 0 && (
                  <div className="hidden sm:block">
                    <span className="inline-flex items-center gap-x-1.5 rounded-full bg-green-100 px-4 py-2 text-sm font-semibold text-green-700">
                      <span className="h-2 w-2 rounded-full bg-green-500 animate-pulse" />
                      {daysLeft} días restantes
                    </span>
                  </div>
                )}
              </div>
              
              <div className="mt-8 flex flex-col sm:flex-row gap-4">
                <PortalButton />
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
        </>
      )}
    </div>
  )
}
