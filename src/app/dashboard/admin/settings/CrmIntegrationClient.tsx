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

  const [testEmail, setTestEmail] = useState('pedro.perez@demolexlatin.com')
  const [testName, setTestName] = useState('Pedro Pérez')
  const [isTesting, setIsTesting] = useState(false)
  const [activeSimulation, setActiveSimulation] = useState<string | null>(null)
  const [countdown, setCountdown] = useState<number | null>(null)
  const [testLogs, setTestLogs] = useState<Array<{ time: string; text: string; success?: boolean }>>([])

  const handleSave = async (e?: React.FormEvent) => {
    if (e) e.preventDefault()
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

  const runSimulation = async (
    eventType: 'TRIAL_STARTED' | 'SUBSCRIPTION_ACTIVATED' | 'SUBSCRIPTION_CANCELED',
    label: string
  ) => {
    if (!webhookUrl.trim()) {
      alert('Por favor ingresa primero la URL del Webhook antes de hacer la prueba.')
      return false
    }

    setIsTesting(true)
    setActiveSimulation(eventType)

    // Ensure current config is saved
    await saveCrmConfig({
      crmWebhookUrl: webhookUrl,
      crmSyncEnabled: syncEnabled,
      crmTagTrial: tagTrial,
      crmTagActive: tagActive,
      crmTagCanceled: tagCanceled,
    })

    const timeStr = new Date().toLocaleTimeString()
    try {
      const res = await testCrmWebhookAction({
        testEmail,
        name: testName,
        eventType,
      })

      if (res.success) {
        setTestLogs(prev => [
          {
            time: timeStr,
            text: `✅ ${label} enviada con éxito para ${testName} (${testEmail}). Webhook respondió HTTP 200 OK.`,
            success: true
          },
          ...prev
        ])
        setIsTesting(false)
        setActiveSimulation(null)
        return true
      } else {
        setTestLogs(prev => [
          {
            time: timeStr,
            text: `❌ Error al enviar ${label}: ${res.error || 'Respuesta fallida'}`,
            success: false
          },
          ...prev
        ])
        setIsTesting(false)
        setActiveSimulation(null)
        return false
      }
    } catch (e: any) {
      setTestLogs(prev => [
        {
          time: timeStr,
          text: `❌ Error de red: ${e.message}`,
          success: false
        },
        ...prev
      ])
      setIsTesting(false)
      setActiveSimulation(null)
      return false
    }
  }

  const handleSimulateFullFlow = async () => {
    if (!webhookUrl.trim()) {
      alert('Por favor ingresa primero la URL del Webhook antes de hacer la prueba.')
      return
    }

    setIsTesting(true)
    setActiveSimulation('FULL_FLOW')
    setTestLogs([])

    // Paso 1: Enviar Trial
    const step1Ok = await runSimulation('TRIAL_STARTED', 'Paso 1/2: Inicio de Prueba (Trial con tag agora_en_prueba)')
    if (!step1Ok) {
      setActiveSimulation(null)
      setIsTesting(false)
      return
    }

    // Cuenta regresiva de 5 segundos
    setIsTesting(true)
    setActiveSimulation('FULL_FLOW')
    for (let c = 5; c > 0; c--) {
      setCountdown(c)
      await new Promise(r => setTimeout(r, 1000))
    }
    setCountdown(null)

    // Paso 2: Enviar Suscripción Activa
    await runSimulation('SUBSCRIPTION_ACTIVATED', 'Paso 2/2: Conversión a Suscriptor (Pago $149 USD con tag agora_suscriptor)')
    setActiveSimulation(null)
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

      {/* Simulador y Probador de Webhook */}
      <div className="mt-8 pt-6 border-t border-border bg-brand/5 dark:bg-brand/10 p-5 rounded-2xl border border-brand/20">
        <div className="flex items-center justify-between gap-2 mb-2">
          <div className="flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-brand" />
            <h5 className="text-sm font-semibold text-foreground">Estudio de Simulación y Pruebas en Vivo</h5>
          </div>
          <span className="text-[10px] font-semibold tracking-wider uppercase px-2.5 py-0.5 rounded-full bg-brand/10 text-brand border border-brand/20">
            Sandbox CRM
          </span>
        </div>
        <p className="text-xs text-muted-foreground mb-4">
          Prueba el ciclo de vida en Arquitex/Ayudante X. Puedes disparar la simulación automática completa para ver cómo Pedro Pérez entra al Pipeline en prueba y luego pasa a suscriptor, o probar cada evento por separado.
        </p>

        {/* Datos de contacto de prueba */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-4 p-3.5 bg-background rounded-xl border border-border">
          <div>
            <label htmlFor="test-name" className="block text-[11px] font-medium text-foreground mb-1">Nombre del Prospecto</label>
            <input
              id="test-name"
              type="text"
              value={testName}
              onChange={(e) => setTestName(e.target.value)}
              placeholder="Pedro Pérez"
              className="w-full rounded-lg border-0 py-1.5 px-3 bg-muted/40 text-xs text-foreground ring-1 ring-border focus:ring-brand"
            />
          </div>
          <div>
            <label htmlFor="test-email" className="block text-[11px] font-medium text-foreground mb-1">Correo Electrónico</label>
            <input
              id="test-email"
              type="email"
              value={testEmail}
              onChange={(e) => setTestEmail(e.target.value)}
              placeholder="pedro.perez@demolexlatin.com"
              className="w-full rounded-lg border-0 py-1.5 px-3 bg-muted/40 text-xs text-foreground ring-1 ring-border focus:ring-brand"
            />
          </div>
        </div>

        {/* Botón Principal: Simulación Automática Completa */}
        <div className="mb-4">
          <button
            type="button"
            onClick={handleSimulateFullFlow}
            disabled={isTesting || !webhookUrl.trim()}
            className="w-full flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-brand to-indigo-600 px-4 py-3 text-xs font-semibold text-white shadow-md hover:opacity-95 disabled:opacity-50 transition-all"
          >
            {isTesting && activeSimulation === 'FULL_FLOW' ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                {countdown !== null 
                  ? `Paso 1 completado. Esperando ${countdown}s para disparar conversión a Suscriptor...` 
                  : 'Procesando simulación automática...'}
              </>
            ) : (
              <>
                <Sparkles className="w-4 h-4" />
                <span>Simular Ciclo Completo (1. Registrar Trial ➔ Esperar 5s ➔ 2. Convertir en Suscriptor)</span>
              </>
            )}
          </button>
        </div>

        {/* Botones de simulación por evento individual */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
          <button
            type="button"
            onClick={() => runSimulation('TRIAL_STARTED', '1. Inicio de Prueba')}
            disabled={isTesting || !webhookUrl.trim()}
            className="flex flex-col items-start p-3 rounded-xl bg-amber-500/10 hover:bg-amber-500/15 border border-amber-500/30 text-left transition-colors disabled:opacity-50"
          >
            <div className="flex items-center justify-between w-full mb-1">
              <span className="text-[11px] font-bold text-amber-700 dark:text-amber-400">🟡 Simular En Prueba</span>
              {isTesting && activeSimulation === 'TRIAL_STARTED' && <Loader2 className="w-3 h-3 animate-spin text-amber-600" />}
            </div>
            <p className="text-[10px] text-muted-foreground">Envía tag <code className="text-amber-600 dark:text-amber-400 font-mono">{tagTrial}</code></p>
          </button>

          <button
            type="button"
            onClick={() => runSimulation('SUBSCRIPTION_ACTIVATED', '2. Compra / Suscriptor')}
            disabled={isTesting || !webhookUrl.trim()}
            className="flex flex-col items-start p-3 rounded-xl bg-emerald-500/10 hover:bg-emerald-500/15 border border-emerald-500/30 text-left transition-colors disabled:opacity-50"
          >
            <div className="flex items-center justify-between w-full mb-1">
              <span className="text-[11px] font-bold text-emerald-700 dark:text-emerald-400">🟢 Simular Suscriptor</span>
              {isTesting && activeSimulation === 'SUBSCRIPTION_ACTIVATED' && <Loader2 className="w-3 h-3 animate-spin text-emerald-600" />}
            </div>
            <p className="text-[10px] text-muted-foreground">Envía tag <code className="text-emerald-600 dark:text-emerald-400 font-mono">{tagActive}</code> ($149 USD)</p>
          </button>

          <button
            type="button"
            onClick={() => runSimulation('SUBSCRIPTION_CANCELED', '3. Canceló')}
            disabled={isTesting || !webhookUrl.trim()}
            className="flex flex-col items-start p-3 rounded-xl bg-rose-500/10 hover:bg-rose-500/15 border border-rose-500/30 text-left transition-colors disabled:opacity-50"
          >
            <div className="flex items-center justify-between w-full mb-1">
              <span className="text-[11px] font-bold text-rose-700 dark:text-rose-400">🔴 Simular Canceló</span>
              {isTesting && activeSimulation === 'SUBSCRIPTION_CANCELED' && <Loader2 className="w-3 h-3 animate-spin text-rose-600" />}
            </div>
            <p className="text-[10px] text-muted-foreground">Envía tag <code className="text-rose-600 dark:text-rose-400 font-mono">{tagCanceled}</code></p>
          </button>
        </div>

        {/* Logs de actividad en vivo */}
        {testLogs.length > 0 && (
          <div className="mt-4 p-3 bg-background/80 rounded-xl border border-border space-y-1.5 max-h-48 overflow-y-auto">
            <div className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-1">
              Registro de eventos enviados:
            </div>
            {testLogs.map((log, idx) => (
              <div 
                key={idx} 
                className={`text-xs p-2 rounded-lg flex items-start gap-2 ${log.success ? 'bg-emerald-50 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300' : 'bg-rose-50 text-rose-800 dark:bg-rose-950/40 dark:text-rose-300'}`}
              >
                <span className="font-mono text-[10px] opacity-70 flex-shrink-0">{log.time}</span>
                <span className="flex-1">{log.text}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
