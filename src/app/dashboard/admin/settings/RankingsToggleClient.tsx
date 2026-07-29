'use client'

import { useState, useTransition } from 'react'
import { toggleRankingsVisibility } from './actions'

export default function RankingsToggleClient({ initialEnabled }: { initialEnabled: boolean }) {
  const [enabled, setEnabled] = useState(initialEnabled)
  const [isPending, startTransition] = useTransition()

  const handleToggle = () => {
    const newState = !enabled
    setEnabled(newState)
    startTransition(() => {
      toggleRankingsVisibility(newState)
    })
  }

  return (
    <div className="flex items-start gap-x-3 mt-6">
      <div className="flex h-6 items-center">
        <input
          id="rankings-visibility"
          name="rankings-visibility"
          type="checkbox"
          checked={enabled}
          onChange={handleToggle}
          disabled={isPending}
          className="h-4 w-4 rounded border-border text-brand focus:ring-brand disabled:opacity-50"
        />
      </div>
      <div className="text-sm leading-6">
        <label htmlFor="rankings-visibility" className="font-medium text-foreground">
          Rankings Analíticos para Usuarios
        </label>
        <p className="text-foreground/60">
          Si está activado, los usuarios finales (SaaS y Legacy) podrán ver los módulos de Rankings Analíticos (Firmas Asesoras, Industrias, Jurisdicciones) en su panel lateral. (Los Administradores siempre los ven).
        </p>
      </div>
    </div>
  )
}
