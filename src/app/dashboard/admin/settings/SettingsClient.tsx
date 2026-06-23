'use client'

import { useState, useTransition } from 'react'
import { toggleTrialRestrictions } from './actions'
import { ShieldAlert, ShieldCheck } from 'lucide-react'

export default function SettingsClient({ initialEnabled }: { initialEnabled: boolean }) {
  const [enabled, setEnabled] = useState(initialEnabled)
  const [isPending, startTransition] = useTransition()

  const handleToggle = () => {
    const newState = !enabled
    setEnabled(newState)
    startTransition(() => {
      toggleTrialRestrictions(newState)
    })
  }

  return (
    <div className="flex items-center justify-between bg-background p-4 rounded-xl border border-border">
      <div className="flex items-center gap-4">
        <div className={`p-3 rounded-full ${enabled ? 'bg-brand/10 text-brand' : 'bg-muted text-muted-foreground'}`}>
          {enabled ? <ShieldCheck className="w-6 h-6" /> : <ShieldAlert className="w-6 h-6" />}
        </div>
        <div>
          <p className="font-medium text-foreground">Anti-Scraping para Trial (15 Días)</p>
          <p className="text-sm text-muted-foreground">
            Activa o desactiva el límite de 5 consultas diarias y el bloqueo de descargas para cuentas en prueba.
          </p>
        </div>
      </div>

      <button
        type="button"
        role="switch"
        aria-checked={enabled}
        disabled={isPending}
        onClick={handleToggle}
        className={`${
          enabled ? 'bg-brand' : 'bg-muted-foreground/30'
        } relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-brand focus:ring-offset-2 disabled:opacity-50`}
      >
        <span
          aria-hidden="true"
          className={`${
            enabled ? 'translate-x-5' : 'translate-x-0'
          } pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out`}
        />
      </button>
    </div>
  )
}
