import { Save, Server, CreditCard, ShieldAlert } from 'lucide-react'

export default function SettingsPage() {
  return (
    <div className="space-y-10 divide-y divide-border">
      <div className="space-y-4">
        <div>
          <h2 className="text-2xl font-bold leading-7 text-foreground sm:truncate sm:text-3xl sm:tracking-tight">
            Panel de Administración
          </h2>
          <p className="mt-1 text-sm leading-6 text-foreground/60">
            Gestiona la configuración global del SaaS, conexiones de API y variables de entorno.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-x-8 gap-y-8 pt-10 md:grid-cols-3">
        <div className="px-4 sm:px-0">
          <h2 className="text-base font-semibold leading-7 text-foreground flex items-center gap-2">
            <Server className="h-5 w-5 text-brand" />
            Integración con Drupal
          </h2>
          <p className="mt-1 text-sm leading-6 text-foreground/60">
            Define la URL base de la API de Drupal. Puedes cambiar entre el servidor de pruebas y producción aquí.
          </p>
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
                      placeholder="agora-backup.lexlatin.com/jsonapi"
                      defaultValue="agora-backup.lexlatin.com/jsonapi"
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
          </div>
          <div className="flex items-center justify-end gap-x-6 border-t border-border px-4 py-4 sm:px-8">
            <button type="button" className="text-sm font-semibold leading-6 text-foreground hover:text-foreground/80">
              Cancelar
            </button>
            <button
              type="submit"
              className="flex items-center gap-2 rounded-md bg-brand px-3 py-2 text-sm font-semibold text-white shadow-sm hover:bg-brand-hover focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
            >
              <Save className="h-4 w-4" />
              Guardar Cambios
            </button>
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
                  <p>Por seguridad, las "Secret Keys" solo deben establecerse mediante variables de entorno en Vercel, pero puedes gestionar el ID del producto aquí.</p>
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
                    placeholder="price_1P..."
                    className="block w-full rounded-md border-0 bg-transparent py-1.5 text-foreground shadow-sm ring-1 ring-inset ring-border placeholder:text-foreground/40 focus:ring-2 focus:ring-inset focus:ring-brand sm:text-sm sm:leading-6"
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
            <button
              type="submit"
              className="flex items-center gap-2 rounded-md bg-brand px-3 py-2 text-sm font-semibold text-white shadow-sm hover:bg-brand-hover focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
            >
              <Save className="h-4 w-4" />
              Actualizar Stripe
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
