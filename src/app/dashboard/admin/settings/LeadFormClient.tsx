'use client'

import { useState } from 'react'
import { Save, CheckCircle2, AlertCircle } from 'lucide-react'
import { saveLeadFormScript } from './actions'

interface LeadFormClientProps {
  initialScript: string
}

export default function LeadFormClient({ initialScript }: LeadFormClientProps) {
  const [script, setScript] = useState(initialScript || '')
  const [isSaving, setIsSaving] = useState(false)
  const [message, setMessage] = useState<{type: 'success'|'error', text: string} | null>(null)

  const handleSave = async () => {
    setIsSaving(true)
    setMessage(null)
    
    try {
      await saveLeadFormScript(script)
      setMessage({ type: 'success', text: 'Script de CRM guardado exitosamente.' })
    } catch (err: any) {
      setMessage({ type: 'error', text: 'Ocurrió un error al guardar el script.' })
    }
    
    setIsSaving(false)
    setTimeout(() => setMessage(null), 4000)
  }

  return (
    <div className="space-y-4">
      <div>
        <label htmlFor="lead-form-script" className="block text-sm font-medium leading-6 text-foreground">
          Código del Formulario CRM (HTML/Script)
        </label>
        <div className="mt-2">
          <textarea
            id="lead-form-script"
            name="lead-form-script"
            rows={8}
            value={script}
            onChange={(e) => setScript(e.target.value)}
            placeholder="<script type='text/javascript' src='https://ayudantex.com/form.js'></script>"
            className="block w-full rounded-xl border-0 py-3 px-4 bg-muted/30 font-mono text-sm text-foreground shadow-sm ring-1 ring-inset ring-border placeholder:text-muted-foreground focus:ring-2 focus:ring-inset focus:ring-brand sm:leading-6"
          />
        </div>
        <p className="mt-2 text-xs text-muted-foreground">
          Pega aquí el código proporcionado por AyudanteX u otro CRM. Se inyectará en la página <code>/iniciar-prueba-gratuita</code>. Recuerda configurar en tu CRM que la redirección tras llenar el formulario apunte a <strong>https://agora-plus.com/api/checkout</strong>
        </p>
      </div>

      <div className="flex items-center justify-between pt-2">
        <div className="flex-1">
          {message && (
            <div className={`flex items-center gap-2 text-sm ${message.type === 'success' ? 'text-emerald-500' : 'text-red-500'}`}>
              {message.type === 'success' ? <CheckCircle2 className="h-4 w-4" /> : <AlertCircle className="h-4 w-4" />}
              {message.text}
            </div>
          )}
        </div>
        <button
          onClick={handleSave}
          disabled={isSaving}
          className="flex items-center gap-2 bg-brand text-white px-5 py-2.5 rounded-xl text-sm font-semibold hover:bg-brand-hover transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          type="button"
        >
          <Save className="h-4 w-4" />
          {isSaving ? 'Guardando...' : 'Guardar Script'}
        </button>
      </div>
    </div>
  )
}
