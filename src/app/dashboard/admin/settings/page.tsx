import { Save, Server, CreditCard, ShieldAlert, ShieldCheck } from 'lucide-react'
import { getSystemConfig } from './actions'
import SettingsClient from './SettingsClient'
import MassiveSyncClient from './MassiveSyncClient'
import ClearCacheClient from './ClearCacheClient'
import MaintenanceClient from './MaintenanceClient'
import LeadFormClient from './LeadFormClient'
export const dynamic = 'force-dynamic'

export default async function SettingsPage() {
  const config = await getSystemConfig()

  return (
    <div className="space-y-10 divide-y divide-border">
      {/* Cache Clearing Section */}
      <div className="grid grid-cols-1 gap-x-8 gap-y-8 pt-6 md:grid-cols-3">
        <div className="px-4 sm:px-0">
          <h2 className="text-base font-semibold leading-7 text-foreground flex items-center gap-2">
            Mantenimiento del Sistema
          </h2>
          <p className="mt-1 text-sm leading-6 text-foreground/60">
            Libera la caché de Next.js si notas que los tableros no muestran la información más reciente después de una sincronización masiva.
          </p>
        </div>
        <div className="bg-surface shadow-sm ring-1 ring-border sm:rounded-xl md:col-span-2">
          <div className="px-4 py-6 sm:p-8 flex items-center h-full">
            <ClearCacheClient />
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-x-8 gap-y-8 pt-10 md:grid-cols-3">
        <div className="px-4 sm:px-0">
          <h2 className="text-base font-semibold leading-7 text-foreground flex items-center gap-2">
            <Server className="h-5 w-5 text-brand" />
            Integración con Drupal
          </h2>
            <p className="mt-1 text-sm leading-6 text-foreground/60">
            Define la URL base de la API de Drupal y la clave del Cronjob. Por la arquitectura Serverless, estos valores se configuran como Variables de Entorno en Vercel.
          </p>
          <div className="mt-4 rounded-md bg-blue-50 dark:bg-blue-900/20 p-4 ring-1 ring-blue-400/30">
            <div className="flex">
              <div className="ml-3">
                <h3 className="text-sm font-medium text-blue-800 dark:text-blue-500">¿Cómo cambiar a Producción?</h3>
                <div className="mt-2 text-sm text-blue-700 dark:text-blue-400">
                  <p>Para conectar al servidor oficial de LexLatin, ve a tu panel de Vercel (Project Settings {'>'} Environment Variables) y cambia la variable <code>DRUPAL_API_URL</code> a la nueva ruta, luego haz un Re-deploy.</p>
                </div>
              </div>
            </div>
          </div>
        </div>

        <form className="bg-surface shadow-sm ring-1 ring-border sm:rounded-xl md:col-span-2">
          <div className="px-4 py-6 sm:p-8">
            <div className="grid max-w-2xl grid-cols-1 gap-x-6 gap-y-8 sm:grid-cols-6">
              <div className="sm:col-span-4">
                <label htmlFor="drupal-api-url" className="block text-sm font-medium leading-6 text-foreground">
                  URL Base de la API (JSON:API)
                </label>
                <div className="mt-2">
                  <div className="flex rounded-md shadow-sm ring-1 ring-inset ring-border focus-within:ring-2 focus-within:ring-inset focus-within:ring-brand sm:max-w-md">
                    <span className="flex select-none items-center pl-3 text-foreground/50 sm:text-sm">https://</span>
                    <input
                      type="text"
                      name="drupal-api-url"
                      id="drupal-api-url"
                      className="block flex-1 border-0 bg-transparent py-1.5 pl-1 text-foreground placeholder:text-foreground/40 focus:ring-0 sm:text-sm sm:leading-6"
                      defaultValue={process.env.DRUPAL_API_URL || "https://phpstack-763726-5097902.cloudwaysapps.com/jsonapi"}
                      disabled
                      title="Editable desde Vercel Env Variables"
                    />
                  </div>
                </div>
              </div>

              <div className="sm:col-span-6">
                <div className="flex items-start gap-x-3">
                  <div className="flex h-6 items-center">
                    <input
                      id="sync-enabled"
                      name="sync-enabled"
                      type="checkbox"
                      defaultChecked
                      className="h-4 w-4 rounded border-border text-brand focus:ring-brand"
                    />
                  </div>
                  <div className="text-sm leading-6">
                    <label htmlFor="sync-enabled" className="font-medium text-foreground">
                      Sincronización Diaria Automática
                    </label>
                    <p className="text-foreground/60">Activa o desactiva el Cronjob que trae datos nuevos todas las madrugadas.</p>
                  </div>
                </div>
              </div>
            </div>
            <MassiveSyncClient drupalUrl={process.env.DRUPAL_API_URL || "https://phpstack-763726-5097902.cloudwaysapps.com/jsonapi"} />
          </div>
          <div className="flex items-center justify-end gap-x-6 border-t border-border px-4 py-4 sm:px-8">
            <button type="button" className="text-sm font-semibold leading-6 text-foreground hover:text-foreground/80">
              Cancelar
            </button>
            <a
              href="https://vercel.com"
              target="_blank"
              className="flex items-center gap-2 rounded-md bg-brand px-3 py-2 text-sm font-semibold text-white shadow-sm hover:bg-brand-hover focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
            >
              <Server className="h-4 w-4" />
              Ir a Vercel
            </a>
          </div>
        </form>
      </div>

      <div className="grid grid-cols-1 gap-x-8 gap-y-8 pt-10 md:grid-cols-3">
        <div className="px-4 sm:px-0">
          <h2 className="text-base font-semibold leading-7 text-foreground flex items-center gap-2">
            <CreditCard className="h-5 w-5 text-brand" />
            Pasarela de Pagos (Stripe)
          </h2>
          <p className="mt-1 text-sm leading-6 text-foreground/60">
            Administra las credenciales de facturación.
          </p>
          <div className="mt-4 rounded-md bg-yellow-50 dark:bg-yellow-900/20 p-4 ring-1 ring-yellow-400/30">
            <div className="flex">
              <div className="flex-shrink-0">
                <ShieldAlert className="h-5 w-5 text-yellow-600 dark:text-yellow-500" aria-hidden="true" />
              </div>
              <div className="ml-3">
                <h3 className="text-sm font-medium text-yellow-800 dark:text-yellow-500">Aviso de Seguridad</h3>
                <div className="mt-2 text-sm text-yellow-700 dark:text-yellow-400">
                  <p>Para pasar a la cuenta de Stripe de Producción, debes ir a Vercel y actualizar: <code>NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY</code> y <code>STRIPE_SECRET_KEY</code>.</p>
                </div>
              </div>
            </div>
          </div>
        </div>

        <form className="bg-surface shadow-sm ring-1 ring-border sm:rounded-xl md:col-span-2">
          <div className="px-4 py-6 sm:p-8">
            <div className="grid max-w-2xl grid-cols-1 gap-x-6 gap-y-8 sm:grid-cols-6">
              <div className="sm:col-span-4">
                <label htmlFor="stripe-product-id" className="block text-sm font-medium leading-6 text-foreground">
                  Stripe Product ID (Suscripción Base)
                </label>
                <div className="mt-2">
                  <input
                    type="text"
                    name="stripe-product-id"
                    id="stripe-product-id"
                    defaultValue={process.env.STRIPE_PRODUCT_ID || ""}
                    disabled
                    className="block w-full rounded-md border-0 bg-muted py-1.5 text-foreground shadow-sm ring-1 ring-inset ring-border placeholder:text-foreground/40 sm:text-sm sm:leading-6"
                  />
                </div>
              </div>

              <div className="sm:col-span-6">
                <div className="flex items-center gap-x-3">
                  <input
                    id="stripe-mode"
                    name="stripe-mode"
                    type="checkbox"
                    className="h-4 w-4 rounded border-border text-brand focus:ring-brand"
                  />
                  <label htmlFor="stripe-mode" className="text-sm font-medium leading-6 text-foreground">
                    Forzar Modo de Pruebas (Test Mode)
                  </label>
                </div>
              </div>
            </div>
          </div>
          <div className="flex items-center justify-end gap-x-6 border-t border-border px-4 py-4 sm:px-8">
            <a
              href="https://vercel.com"
              target="_blank"
              className="flex items-center gap-2 rounded-md bg-brand px-3 py-2 text-sm font-semibold text-white shadow-sm hover:bg-brand-hover focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
            >
              <Server className="h-4 w-4" />
              Ir a Vercel
            </a>
          </div>
        </form>
      </div>

      <div className="grid grid-cols-1 gap-x-8 gap-y-8 pt-10 md:grid-cols-3">
        <div className="px-4 sm:px-0">
          <h2 className="text-base font-semibold leading-7 text-foreground flex items-center gap-2">
            <ShieldCheck className="h-5 w-5 text-brand" />
            Control de Seguridad
          </h2>
          <p className="mt-1 text-sm leading-6 text-foreground/60">
            Ajusta las políticas de seguridad y límites de uso del SaaS.
          </p>
        </div>

        <form className="bg-surface shadow-sm ring-1 ring-border sm:rounded-xl md:col-span-2">
          <div className="px-4 py-6 sm:p-8">
            <div className="grid max-w-2xl grid-cols-1 gap-x-6 gap-y-8 sm:grid-cols-6">
              <div className="sm:col-span-6">
                <SettingsClient initialEnabled={config.trialRestrictionsEnabled} />
                <MaintenanceClient initialEnabled={config.maintenanceModeEnabled} />
              </div>
            </div>
          </div>
        </form>
      </div>
      <div className="grid grid-cols-1 gap-x-8 gap-y-8 pt-10 md:grid-cols-3">
        <div className="px-4 sm:px-0">
          <h2 className="text-base font-semibold leading-7 text-foreground flex items-center gap-2">
            Captura de Leads (CRM)
          </h2>
          <p className="mt-1 text-sm leading-6 text-foreground/60">
            Pega aquí el código del formulario de AyudanteX (u otro CRM) que se mostrará antes del pago.
          </p>
        </div>

        <form className="bg-surface shadow-sm ring-1 ring-border sm:rounded-xl md:col-span-2">
          <div className="px-4 py-6 sm:p-8">
            <div className="grid max-w-2xl grid-cols-1 gap-x-6 gap-y-8 sm:grid-cols-6">
              <div className="sm:col-span-6">
                <LeadFormClient initialScript={config.leadFormScript || ''} />
              </div>
            </div>
          </div>
        </form>
      </div>
    </div>
  )
}
