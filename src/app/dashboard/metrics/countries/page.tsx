import CountriesClient from './CountriesClient'

export default function MetricsCountriesPage() {
  return (
    <div className="flex flex-col h-full space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-700">
      <CountriesClient />
    </div>
  )
}
