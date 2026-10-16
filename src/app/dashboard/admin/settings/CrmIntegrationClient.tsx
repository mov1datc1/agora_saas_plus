'use client'

import { useState } from 'react'
import { Webhook, Save, Send, CheckCircle2, AlertCircle, Loader2, Sparkles, Tag, ArrowRight } from 'lucide-react'
import { saveCrmConfig, testCrmWebhookAction } from './actions'

interface CrmIntegrationClientProps {
  initialConfig: {
    crmWebhookUrl?: string | null
    crmSyncEnabled?: boolean
    crmTagTrial?: string | null
    crmTagActive?: string | null
    crmTagCanceled?: string | null
  }
}

export default function CrmIntegrationClient({ initialConfig }: CrmIntegrationClientProps) {
  const [webhookUrl, setWebhookUrl] = useState(initialConfig.crmWebhookUrl || '')
  const [syncEnabled, setSyncEnabled] = useState(initialConfig.crmSyncEnabled || false)
  const [tagTrial, setTagTrial] = useState(initialConfig.crmTagTrial || 'agora_en_prueba')
  const [tagActive, setTagActive] = useState(initialConfig.crmTagActive || 'agora_suscriptor')
  const [tagCanceled, setTagCanceled] = useState(initialConfig.crmTagCanceled || 'agora_cancelo')

  const [isSaving, setIsSaving] = useState(false)
  const [saveMessage, setSaveMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null)

  const [testEmail, setTestEmail] = useState('demo@lexlatin.com')
  const [isTesting, setIsTesting] = useState(false)
  const [testResult, setTestResult] = useState<{ success: boolean; message: string } | null>(null)

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsSaving(true)
    setSaveMessage(null)

    try {
      await saveCrmConfig({
        crmWebhookUrl: webhookUrl,
        crmSyncEnabled: syncEnabled,
        crmTagTrial: tagTrial,
        crmTagActive: tagActive,
        crmTagCanceled: tagCanceled,
      })
      setSaveMessage({ type: 'success', text: 'Configuración de CRM guardada exitosamente.' })
    } catch (err: any) {
      setSaveMessage({ type: 'error', text: err.message || 'Error al guardar la configuración.' })
    }

    setIsSaving(false)
    setTimeout(() => setSaveMessage(null), 4000)
  }

  const handleTestPing = async () => {
    if (!webhookUrl.trim()) {
      alert('Por favor ingresa primero la URL del Webhook antes de hacer la prueba.')
      return
    }

    setIsTesting(true)
    setTestResult(null)

    try {
      // First save if needed
      await saveCrmConfig({
        crmWebhookUrl: webhookUrl,
        crmSyncEnabled: syncEnabled,
        crmTagTrial: tagTrial,
        crmTagActive: tagActive,
        crmTagCanceled: tagCanceled,
      })

      const res = await testCrmWebhookAction(testEmail)
      if (res.success) {
        setTestResult({
          success: true,
          message: '✅ Conexión exitosa. El Webhook de AyudanteX/Arquitex respondió correctamente (HTTP 200).'
        })
      } else {
        setTestResult({
          success: false,
          message: `❌ Error al conectar con el Webhook: ${res.error || 'Respuesta fallida'}`
        })
      }
    } catch (e: any) {
      setTestResult({
        success: false,
        message: `❌ Error en el envío: ${e.message}`
      })
    }

    setIsTesting(false)
  }

  return (
    <div className="space-y-6">
      {/* Estado general */}
      <div className="flex items-center justify-between pb-4 border-b border-border">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-brand/10 text-brand flex items-center justify-center">
            <Webhook className="w-5 h-5" />
          </div>
          <div>
            <h4 className="text-sm font-semibold text-foreground">Sincronización en Tiempo Real</h4>
            <p className="text-xs text-muted-foreground">Envía altas, compras y cancelaciones al CRM para automatizar correos</p>
          </div>
        </div>
        <label className="relative inline-flex items-center cursor-pointer">
          <input
            type="checkbox"
            checked={syncEnabled}
            onChange={(e) => setSyncEnabled(e.target.checked)}
            className="sr-only peer"
          />
          <div className="w-11 h-6 bg-muted peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-emerald-600"></div>
          <span className="ml-2.5 text-xs font-semibold text-foreground">
            {syncEnabled ? 'Activo' : 'Pausado'}
          </span>
        </label>
      </div>

      <form onSubmit={handleSave} className="space-y-5">
        {/* URL Webhook */}
        <div>
          <label htmlFor="crm-webhook-url" className="block text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1.5">
            URL del Webhook (Ayudante X / Arquitex / GoHighLevel)
          </label>
          <div className="relative">
            <input
              id="crm-webhook-url"
              type="url"
              value={webhookUrl}
              onChange={(e) => setWebhookUrl(e.target.value)}
              placeholder="https://services.leadconnectorhq.com/hooks/..."
              className="block w-full rounded-xl border-0 py-2.5 px-3.5 bg-muted/40 font-mono text-xs text-foreground shadow-sm ring-1 ring-inset ring-border placeholder:text-muted-foreground focus:ring-2 focus:ring-inset focus:ring-brand"
            />
          </div>
          <p className="mt-1.5 text-xs text-muted-foreground">
            Pega aquí la URL del <strong>Inbound Webhook</strong> generado en el workflow de Arquitex/AyudanteX.
          </p>
        </div>

        {/* Tags mapping */}
        <div className="pt-2">
          <h5 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-1.5">
            <Tag className="w-3.5 h-3.5" /> Mapeo de Etiquetas (Tags) enviadas al CRM
          </h5>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="bg-muted/20 p-3.5 rounded-xl border border-border">
              <label htmlFor="tag-trial" className="block text-xs font-medium text-foreground mb-1">
                Etiqueta: En Prueba (Trial)
              </label>
              <input
                id="tag-trial"
                type="text"
                value={tagTrial}
                onChange={(e) => setTagTrial(e.target.value)}
                placeholder="agora_en_prueba"
                className="w-full rounded-lg border-0 py-1.5 px-2.5 bg-background text-xs font-mono text-foreground ring-1 ring-border focus:ring-brand"
              />
              <span className="inline-block mt-2 text-[10px] text-amber-600 dark:text-amber-400 font-medium">
                Al registrarse o iniciar trial
              </span>
            </div>

            <div className="bg-muted/20 p-3.5 rounded-xl border border-border">
              <label htmlFor="tag-active" className="block text-xs font-medium text-foreground mb-1">
                Etiqueta: Suscriptor Activo
              </label>
              <input
                id="tag-active"
                type="text"
                value={tagActive}
                onChange={(e) => setTagActive(e.target.value)}
                placeholder="agora_suscriptor"
                className="w-full rounded-lg border-0 py-1.5 px-2.5 bg-background text-xs font-mono text-foreground ring-1 ring-border focus:ring-brand"
              />
              <span className="inline-block mt-2 text-[10px] text-emerald-600 dark:text-emerald-400 font-medium">
                Al pagar en Stripe / Compra exitosa
              </span>
            </div>

            <div className="bg-muted/20 p-3.5 rounded-xl border border-border">
              <label htmlFor="tag-canceled" className="block text-xs font-medium text-foreground mb-1">
                Etiqueta: Canceló / Vencido
              </label>
              <input
                id="tag-canceled"
                type="text"
                value={tagCanceled}
                onChange={(e) => setTagCanceled(e.target.value)}
                placeholder="agora_cancelo"
                className="w-full rounded-lg border-0 py-1.5 px-2.5 bg-background text-xs font-mono text-foreground ring-1 ring-border focus:ring-brand"
              />
              <span className="inline-block mt-2 text-[10px] text-rose-600 dark:text-rose-400 font-medium">
                Al cancelar o expirar la prueba
              </span>
            </div>
          </div>
        </div>

        {/* Botón Guardar */}
        <div className="flex items-center justify-between pt-3">
          <div className="flex-1">
            {saveMessage && (
              <div className={`flex items-center gap-2 text-xs font-medium ${saveMessage.type === 'success' ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600'}`}>
                {saveMessage.type === 'success' ? <CheckCircle2 className="w-4 h-4" /> : <AlertCircle className="w-4 h-4" />}
                {saveMessage.text}
              </div>
            )}
          </div>
          <button
            type="submit"
            disabled={isSaving}
            className="inline-flex items-center gap-1.5 rounded-lg bg-foreground px-4 py-2 text-xs font-semibold text-background hover:bg-foreground/80 disabled:opacity-50 transition-colors"
          >
            {isSaving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
            {isSaving ? 'Guardando...' : 'Guardar Configuración'}
          </button>
        </div>
      </form>

      {/* Probador de Webhook */}
      <div className="mt-6 pt-5 border-t border-border bg-brand/5 dark:bg-brand/10 p-4 rounded-xl border border-brand/20">
        <div className="flex items-center gap-2 mb-2">
          <Sparkles className="w-4 h-4 text-brand" />
          <h5 className="text-xs font-semibold text-foreground">Probar Conexión con AyudanteX / Arquitex</h5>
        </div>
        <p className="text-xs text-muted-foreground mb-3">
          Envía un evento de prueba simulado (<code className="text-brand">TEST_PING</code>) para verificar que el webhook de Arquitex reciba los datos y mueva las oportunidades correctamente.
        </p>

        <div className="flex flex-col sm:flex-row items-center gap-2.5">
          <input
            type="email"
            value={testEmail}
            onChange={(e) => setTestEmail(e.target.value)}
            placeholder="correo_prueba@ejemplo.com"
            className="flex-1 w-full rounded-lg border-0 py-2 px-3 bg-background text-xs text-foreground ring-1 ring-border focus:ring-brand"
          />
          <button
            type="button"
            onClick={handleTestPing}
            disabled={isTesting || !webhookUrl}
            className="w-full sm:w-auto inline-flex items-center justify-center gap-1.5 rounded-lg bg-brand px-4 py-2 text-xs font-semibold text-white hover:bg-brand/90 disabled:opacity-50 transition-colors whitespace-nowrap shadow-sm"
          >
            {isTesting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
            {isTesting ? 'Enviando...' : 'Enviar Prueba'}
          </button>
        </div>

        {testResult && (
          <div className={`mt-3 p-2.5 rounded-lg text-xs flex items-center gap-2 ${testResult.success ? 'bg-emerald-50 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300 border border-emerald-300/40' : 'bg-rose-50 text-rose-800 dark:bg-rose-950/40 dark:text-rose-300 border border-rose-300/40'}`}>
            {testResult.success ? <CheckCircle2 className="w-4 h-4 flex-shrink-0" /> : <AlertCircle className="w-4 h-4 flex-shrink-0" />}
            <span>{testResult.message}</span>
          </div>
        )}
      </div>
    </div>
  )
}
