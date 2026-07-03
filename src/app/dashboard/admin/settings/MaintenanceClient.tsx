'use client'

import { useState, useTransition } from 'react'
import { toggleMaintenanceMode } from '@/app/actions/system'

export default function MaintenanceClient({ initialEnabled }: { initialEnabled: boolean }) {
  const [enabled, setEnabled] = useState(initialEnabled)
  const [isPending, startTransition] = useTransition()

  const handleToggle = () => {
    const newState = !enabled
    setEnabled(newState)
    startTransition(() => {
      toggleMaintenanceMode(newState)
    })
  }

  return (
    <div className="flex items-start gap-x-3 mt-6">
      <div className="flex h-6 items-center">
        <input
          id="maintenance-mode"
          name="maintenance-mode"
          type="checkbox"
          checked={enabled}
          onChange={handleToggle}
          disabled={isPending}
          className="h-4 w-4 rounded border-border text-red-600 focus:ring-red-600 disabled:opacity-50"
        />
      </div>
      <div className="text-sm leading-6">
        <label htmlFor="maintenance-mode" className="font-medium text-red-600 dark:text-red-500 flex items-center gap-2">
          Modo Mantenimiento (Under Construction)
        </label>
        <p className="text-foreground/60">
          Si se activa, todos los usuarios verán una pantalla de mantenimiento y no podrán acceder a la plataforma (excepto los Administradores).
        </p>
      </div>
    </div>
  )
}
