'use client'

import { useState } from 'react'
import { toggleCopilotEnabled } from './actions'
import { Sparkles } from 'lucide-react'

export default function CopilotToggleClient({ initialEnabled }: { initialEnabled: boolean }) {
  const [enabled, setEnabled] = useState(initialEnabled)
  const [isUpdating, setIsUpdating] = useState(false)

  const handleToggle = async () => {
    setIsUpdating(true)
    const newState = !enabled
    setEnabled(newState)
    
    try {
      await toggleCopilotEnabled(newState)
    } catch (error) {
      console.error('Error toggling copilot mode:', error)
      setEnabled(enabled) // revert on error
    } finally {
      setIsUpdating(false)
    }
  }

  return (
    <div className="flex items-start gap-x-3 mt-8">
      <div className="flex h-6 items-center">
        <input
          id="copilot-enabled"
          name="copilot-enabled"
          type="checkbox"
          checked={enabled}
          onChange={handleToggle}
          disabled={isUpdating}
          className="h-4 w-4 rounded border-border text-brand focus:ring-brand cursor-pointer disabled:opacity-50"
        />
      </div>
      <div className="text-sm leading-6">
        <label htmlFor="copilot-enabled" className="font-medium text-foreground flex items-center gap-2 cursor-pointer">
          <Sparkles className="h-4 w-4 text-brand" />
          Habilitar Ágora Copilot (Fase Beta)
        </label>
        <p className="text-foreground/60">
          Activa o desactiva el acceso al asistente de IA para los usuarios regulares de la plataforma. (Administradores siempre tendrán acceso).
        </p>
      </div>
    </div>
  )
}
