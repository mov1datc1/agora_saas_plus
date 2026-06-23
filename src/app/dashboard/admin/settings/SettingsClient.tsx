'use client'

import { useState, useTransition } from 'react'
import { toggleTrialRestrictions } from './actions'

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
    <div className="flex items-start gap-x-3">
      <div className="flex h-6 items-center">
        <input
          id="trial-restrictions"
          name="trial-restrictions"
          type="checkbox"
          checked={enabled}
          onChange={handleToggle}
          disabled={isPending}
          className="h-4 w-4 rounded border-border text-brand focus:ring-brand disabled:opacity-50"
        />
      </div>
      <div className="text-sm leading-6">
        <label htmlFor="trial-restrictions" className="font-medium text-foreground">
          Límites de Suscripción Trial (Anti-Scraping)
        </label>
        <p className="text-foreground/60">
          Activa o desactiva el límite de 5 consultas diarias y el bloqueo de descargas para cuentas en prueba.
        </p>
      </div>
    </div>
  )
}
