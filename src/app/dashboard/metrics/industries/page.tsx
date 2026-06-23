import IndustriesClient from './IndustriesClient'

export default function MetricsIndustriesPage() {
  return (
    <div className="flex flex-col h-full space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-700">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-3xl font-bold tracking-tight text-foreground">Métricas: Industrias</h2>
          <p className="mt-2 text-sm text-muted-foreground">Analiza el desempeño y distribución global por sector.</p>
        </div>
      </div>

      <IndustriesClient />
    </div>
  )
}
