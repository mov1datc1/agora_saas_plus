'use client'

import { useState, useTransition } from 'react'
import { toggleGlobalMetrics } from './actions'

export default function MetricsToggleClient({ initialEnabled }: { initialEnabled: boolean }) {
  const [enabled, setEnabled] = useState(initialEnabled)
  const [isPending, startTransition] = useTransition()

  const handleToggle = () => {
    const newState = !enabled
    setEnabled(newState)
    startTransition(() => {
      toggleGlobalMetrics(newState)
    })
  }

  return (
    <div className="flex items-start gap-x-3 mt-6">
      <div className="flex h-6 items-center">
        <input
          id="global-metrics-visibility"
          name="global-metrics-visibility"
          type="checkbox"
          checked={enabled}
          onChange={handleToggle}
          disabled={isPending}
          className="h-4 w-4 rounded border-border text-brand focus:ring-brand disabled:opacity-50"
        />
      </div>
      <div className="text-sm leading-6">
        <label htmlFor="global-metrics-visibility" className="font-medium text-foreground">
          Métricas Globales para Usuarios (Dashboard)
        </label>
        <p className="text-foreground/60">
          Si está activado, los usuarios finales podrán ver las tarjetas de métricas numéricas (Operaciones Registradas, Firmas, etc.) en su dashboard. (Los Administradores siempre las ven).
        </p>
      </div>
    </div>
  )
}
