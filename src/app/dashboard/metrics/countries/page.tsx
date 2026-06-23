import CountriesClient from './CountriesClient'

export default function MetricsCountriesPage() {
  return (
    <div className="flex flex-col h-full space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-700">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-3xl font-bold tracking-tight text-foreground">Métricas: Países</h2>
          <p className="mt-2 text-sm text-muted-foreground">Explora la actividad financiera y legal por región y país.</p>
        </div>
      </div>

      <CountriesClient />
    </div>
  )
}
