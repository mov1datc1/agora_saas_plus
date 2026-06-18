import { Server, Target, LineChart, Activity } from 'lucide-react'

export default function MarketingSettingsPage() {
  return (
    <div className="space-y-10 divide-y divide-border">
      <div className="grid grid-cols-1 gap-x-8 gap-y-8 pt-6 md:grid-cols-3">
        <div className="px-4 sm:px-0">
          <h2 className="text-base font-semibold leading-7 text-foreground flex items-center gap-2">
            <LineChart className="h-5 w-5 text-brand" />
            Google Analytics 4
          </h2>
          <p className="mt-1 text-sm leading-6 text-foreground/60">
            Medición de tráfico y eventos en la plataforma.
          </p>
          <div className="mt-4 rounded-md bg-blue-50 dark:bg-blue-900/20 p-4 ring-1 ring-blue-400/30">
            <div className="flex">
              <div className="ml-3">
                <h3 className="text-sm font-medium text-blue-800 dark:text-blue-500">Integración Serverless</h3>
                <div className="mt-2 text-sm text-blue-700 dark:text-blue-400">
                  <p>Configura esta variable en Vercel como <code>NEXT_PUBLIC_GA_MEASUREMENT_ID</code> para inyectar el script automáticamente en el Head.</p>
                </div>
              </div>
            </div>
          </div>
        </div>

        <form className="bg-surface shadow-sm ring-1 ring-border sm:rounded-xl md:col-span-2">
          <div className="px-4 py-6 sm:p-8">
            <div className="grid max-w-2xl grid-cols-1 gap-x-6 gap-y-8 sm:grid-cols-6">
              <div className="sm:col-span-4">
                <label htmlFor="ga-id" className="block text-sm font-medium leading-6 text-foreground">
                  Measurement ID (Ej. G-XXXXXXXXXX)
                </label>
                <div className="mt-2">
                  <input
                    type="text"
                    name="ga-id"
                    id="ga-id"
                    defaultValue={process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID || ""}
                    disabled
                    placeholder="G-"
                    className="block w-full rounded-md border-0 bg-muted py-1.5 text-foreground shadow-sm ring-1 ring-inset ring-border placeholder:text-foreground/40 sm:text-sm sm:leading-6"
                  />
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
              Actualizar en Vercel
            </a>
          </div>
        </form>
      </div>

      <div className="grid grid-cols-1 gap-x-8 gap-y-8 pt-10 md:grid-cols-3">
        <div className="px-4 sm:px-0">
          <h2 className="text-base font-semibold leading-7 text-foreground flex items-center gap-2">
            <Target className="h-5 w-5 text-brand" />
            Google Ads (Tracking)
          </h2>
          <p className="mt-1 text-sm leading-6 text-foreground/60">
            Seguimiento de conversiones de campañas de búsqueda hacia Stripe Checkout.
          </p>
        </div>

        <form className="bg-surface shadow-sm ring-1 ring-border sm:rounded-xl md:col-span-2">
          <div className="px-4 py-6 sm:p-8">
            <div className="grid max-w-2xl grid-cols-1 gap-x-6 gap-y-8 sm:grid-cols-6">
              <div className="sm:col-span-4">
                <label htmlFor="gads-id" className="block text-sm font-medium leading-6 text-foreground">
                  Conversion Tracking ID (Ej. AW-XXXXXXXXXX)
                </label>
                <div className="mt-2">
                  <input
                    type="text"
                    name="gads-id"
                    id="gads-id"
                    defaultValue={process.env.NEXT_PUBLIC_GOOGLE_ADS_ID || ""}
                    disabled
                    placeholder="AW-"
                    className="block w-full rounded-md border-0 bg-muted py-1.5 text-foreground shadow-sm ring-1 ring-inset ring-border placeholder:text-foreground/40 sm:text-sm sm:leading-6"
                  />
                </div>
              </div>

              <div className="sm:col-span-4">
                <label htmlFor="gads-label" className="block text-sm font-medium leading-6 text-foreground">
                  Conversion Label (Opcional)
                </label>
                <div className="mt-2">
                  <input
                    type="text"
                    name="gads-label"
                    id="gads-label"
                    defaultValue={process.env.NEXT_PUBLIC_GOOGLE_ADS_CONVERSION_LABEL || ""}
                    disabled
                    placeholder="Ej. lV_BCNz_r9MBE..."
                    className="block w-full rounded-md border-0 bg-muted py-1.5 text-foreground shadow-sm ring-1 ring-inset ring-border placeholder:text-foreground/40 sm:text-sm sm:leading-6"
                  />
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
              Actualizar en Vercel
            </a>
          </div>
        </form>
      </div>

      <div className="grid grid-cols-1 gap-x-8 gap-y-8 pt-10 md:grid-cols-3">
        <div className="px-4 sm:px-0">
          <h2 className="text-base font-semibold leading-7 text-foreground flex items-center gap-2">
            <Activity className="h-5 w-5 text-brand" />
            Meta Ads (Pixel)
          </h2>
          <p className="mt-1 text-sm leading-6 text-foreground/60">
            Seguimiento de eventos para campañas de retargeting en Facebook e Instagram.
          </p>
        </div>

        <form className="bg-surface shadow-sm ring-1 ring-border sm:rounded-xl md:col-span-2">
          <div className="px-4 py-6 sm:p-8">
            <div className="grid max-w-2xl grid-cols-1 gap-x-6 gap-y-8 sm:grid-cols-6">
              <div className="sm:col-span-4">
                <label htmlFor="meta-id" className="block text-sm font-medium leading-6 text-foreground">
                  Meta Pixel ID (15 dígitos)
                </label>
                <div className="mt-2">
                  <input
                    type="text"
                    name="meta-id"
                    id="meta-id"
                    defaultValue={process.env.NEXT_PUBLIC_META_PIXEL_ID || ""}
                    disabled
                    placeholder="123456789012345"
                    className="block w-full rounded-md border-0 bg-muted py-1.5 text-foreground shadow-sm ring-1 ring-inset ring-border placeholder:text-foreground/40 sm:text-sm sm:leading-6"
                  />
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
              Actualizar en Vercel
            </a>
          </div>
        </form>
      </div>
    </div>
  )
}
