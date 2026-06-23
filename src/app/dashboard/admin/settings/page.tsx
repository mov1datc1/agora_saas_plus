import { getSystemConfig } from './actions'
import SettingsClient from './SettingsClient'

export const dynamic = 'force-dynamic'

export default async function SettingsPage() {
  const config = await getSystemConfig()

  return (
    <div className="pt-6 max-w-4xl">
      <h3 className="text-xl font-bold leading-6 text-foreground mb-6">Configuración del Sistema</h3>
      
      <div className="bg-surface rounded-2xl p-6 shadow-sm border border-border">
        <h4 className="text-lg font-semibold text-foreground mb-4">Seguridad y Paywall</h4>
        <SettingsClient initialEnabled={config.trialRestrictionsEnabled} />
      </div>
    </div>
  )
}
