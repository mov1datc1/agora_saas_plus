'use client'

import { useState, useEffect } from 'react'
import { Mail, Key, ExternalLink, Save, CheckCircle2, AlertCircle, Send } from 'lucide-react'
import { getEmailTemplates, saveEmailTemplate, testResendConnection } from '@/app/actions/smtp'

const DEFAULT_WELCOME = `<h1>¡Bienvenido a Ágora Plus!</h1>
<p>Hola {{userFirstname}},</p>
<p>Tu prueba gratuita de <strong>15 días</strong> se ha activado con éxito. Ahora tienes acceso total a nuestra base de datos transaccional y al <strong>Ágora Copilot</strong> impulsado por IA.</p>
<p style="margin: 24px 0;">
  <a href="{{dashboardUrl}}" style="background-color: #E05C50; color: #ffffff; padding: 12px 24px; text-decoration: none; border-radius: 8px; font-weight: bold; display: inline-block;">
    Comenzar en mi Dashboard
  </a>
</p>
<p>Recuerda que puedes explorar firmas asesoras, transacciones por industria y generar informes personalizados durante tu periodo de prueba sin costo alguno.</p>
<p>Saludos cordiales,<br><strong>Equipo Ágora Plus</strong></p>`

const DEFAULT_REMINDER_TRIAL = `<h1>Tu prueba de Ágora Plus está por concluir</h1>
<p>Hola {{userFirstname}},</p>
<p>Esperamos que estés aprovechando al máximo la plataforma y las herramientas de analítica legal y financiera de Ágora Plus.</p>
<p>Te recordamos que en <strong>3 días</strong> finalizará tu periodo de prueba gratuita y se procesará automáticamente el cobro de tu suscripción mensual oficial a tu tarjeta registrada.</p>
<div style="background-color: #f9fafb; border: 1px solid #e5e7eb; border-radius: 8px; padding: 16px; margin: 20px 0;">
  <p style="margin: 0; font-size: 14px; color: #4b5563;">
    <strong>¿Deseas continuar disfrutando del servicio?</strong> No tienes que hacer nada, tu cuenta continuará activa sin interrupciones.<br><br>
    Si prefieres gestionar tu método de pago o cancelar antes del cobro para no generar cargos, puedes hacerlo desde tu panel de facturación:
  </p>
</div>
<p style="margin: 24px 0;">
  <a href="{{dashboardUrl}}/billing" style="background-color: #1f2937; color: #ffffff; padding: 12px 24px; text-decoration: none; border-radius: 8px; font-weight: bold; display: inline-block;">
    Ver Mi Facturación y Métodos de Pago
  </a>
</p>
<p>Saludos,<br><strong>Equipo Ágora Plus</strong></p>`

const DEFAULT_TRIAL_CANCELLED = `<h1>Tu suscripción de prueba ha sido cancelada</h1>
<p>Hola {{userFirstname}},</p>
<p>Te confirmamos que tu solicitud de cancelación ha sido procesada con éxito.</p>
<div style="background-color: #f0fdf4; border: 1px solid #bbf7d0; border-radius: 8px; padding: 16px; margin: 20px 0;">
  <h3 style="color: #166534; margin-top: 0;">Garantía de Cero Cargos</h3>
  <p style="color: #15803d; margin-bottom: 0; font-size: 14px;">
    Confirmamos que <strong>no se ha realizado ningún cobro</strong> y que tu método de pago registrado <strong>no recibirá ningún cargo futuro</strong>. Tu suscripción en Stripe ha quedado totalmente anulada.
  </p>
</div>
<p>Lamentamos verte partir. Si en el futuro deseas reactivar tu acceso a las transacciones de América Latina o al Copilot de Ágora, serás bienvenido nuevamente en cualquier momento.</p>
<p style="margin: 24px 0;">
  <a href="{{dashboardUrl}}" style="background-color: #4b5563; color: #ffffff; padding: 10px 20px; text-decoration: none; border-radius: 8px; font-size: 14px; display: inline-block;">
    Ir a Ágora Plus
  </a>
</p>
<p>Atentamente,<br><strong>Equipo Ágora Plus</strong></p>`

const DEFAULT_PAYMENT_SUCCESS = `<h1>¡Tu suscripción PRO está oficialmente activa!</h1>
<p>Hola {{userFirstname}},</p>
<p>Te confirmamos que el cobro de tu membresía a <strong>Ágora Plus PRO</strong> ha sido procesado exitosamente tras culminar tu periodo de prueba.</p>
<div style="background-color: #f9fafb; border: 1px solid #e5e7eb; border-radius: 8px; padding: 16px; margin: 20px 0;">
  <h3 style="margin-top: 0; color: #111827;">Detalle de la Transacción</h3>
  <ul style="color: #4b5563; font-size: 14px; line-height: 1.8; margin-bottom: 0;">
    <li><strong>Estado:</strong> Pagado con éxito</li>
    <li><strong>Plan:</strong> Suscripción Mensual Ágora Plus PRO</li>
    <li><strong>Acceso:</strong> Ilimitado a la plataforma y reportes analíticos</li>
  </ul>
</div>
<h3>Beneficios activos en tu cuenta:</h3>
<ul style="color: #374151; font-size: 14px; line-height: 1.6;">
  <li>Acceso completo a la base histórica de M&A, emisiones y financiamientos de América Latina.</li>
  <li>Consultas ilimitadas con <strong>Ágora Copilot (IA)</strong>.</li>
  <li>Rankings interactivos de firmas asesoras, abogados e industrias.</li>
  <li>Exportación de datos e informes de mercado personalizados.</li>
</ul>
<p style="margin: 24px 0;">
  <a href="{{dashboardUrl}}" style="background-color: #E05C50; color: #ffffff; padding: 12px 24px; text-decoration: none; border-radius: 8px; font-weight: bold; display: inline-block;">
    Acceder a mi Dashboard
  </a>
</p>
<p>Gracias por confiar en Ágora.<br><strong>Equipo Ágora Plus</strong></p>`

const DEFAULT_DUNNING = `<h1>Hubo un problema con tu método de pago</h1>
<p>Hola {{userFirstname}},</p>
<p>Intentamos procesar el cargo correspondiente a tu suscripción de <strong>Ágora Plus</strong>, pero el banco emisor de tu tarjeta no autorizó la transacción.</p>
<div style="background-color: #fef2f2; border: 1px solid #fecaca; border-radius: 8px; padding: 16px; margin: 20px 0;">
  <p style="color: #991b1b; margin: 0; font-size: 14px;">
    <strong>Para evitar la suspensión de tu acceso:</strong> por favor ingresa a tu panel de facturación y actualiza tu tarjeta o selecciona otro método de pago. Realizaremos un nuevo intento de cobro en las próximas horas.
  </p>
</div>
<p style="margin: 24px 0;">
  <a href="{{dashboardUrl}}/billing" style="background-color: #dc2626; color: #ffffff; padding: 12px 24px; text-decoration: none; border-radius: 8px; font-weight: bold; display: inline-block;">
    Actualizar Método de Pago Ahora
  </a>
</p>
<p>Si consideras que esto es un error de tu banco, te recomendamos contactarlos para autorizar cargos recurrentes de Ágora / Stripe.</p>
<p>Saludos,<br><strong>Equipo Ágora Plus</strong></p>`

const DEFAULT_UPCOMING_RENEWAL = `<h1>Aviso de próxima renovación mensual</h1>
<p>Hola {{userFirstname}},</p>
<p>Te informamos que en <strong>3 días</strong> se procesará la renovación automática de tu suscripción mensual a <strong>Ágora Plus PRO</strong>.</p>
<div style="background-color: #f9fafb; border: 1px solid #e5e7eb; border-radius: 8px; padding: 16px; margin: 20px 0;">
  <p style="margin: 0; font-size: 14px; color: #4b5563;">
    El cobro se realizará de forma automática a la tarjeta registrada en tu cuenta. No es necesario que realices ninguna acción para mantener tu servicio activo.<br><br>
    Si necesitas descargar tus facturas anteriores, actualizar tu método de pago o consultar los datos de tu suscripción, puedes hacerlo aquí:
  </p>
</div>
<p style="margin: 24px 0;">
  <a href="{{dashboardUrl}}/billing" style="background-color: #1f2937; color: #ffffff; padding: 12px 24px; text-decoration: none; border-radius: 8px; font-weight: bold; display: inline-block;">
    Gestionar Mi Facturación
  </a>
</p>
<p>Gracias por seguir formando parte de Ágora.<br><strong>Equipo Ágora Plus</strong></p>`

type TemplateType = 'WELCOME' | 'REMINDER_TRIAL' | 'TRIAL_CANCELLED' | 'PAYMENT_SUCCESS' | 'DUNNING' | 'UPCOMING_RENEWAL'

const TABS: { type: TemplateType; label: string; desc: string }[] = [
  { type: 'WELCOME', label: '1. Bienvenida (Magic Link)', desc: 'Enviado al completar el checkout de prueba de 15 días.' },
  { type: 'REMINDER_TRIAL', label: '2. Fin de Prueba (3 días)', desc: 'Aviso enviado 3 días antes de culminar la prueba gratuita.' },
  { type: 'TRIAL_CANCELLED', label: '3. Cancelación Prueba', desc: 'Confirmación de cero cargos al cancelar durante el periodo de prueba.' },
  { type: 'PAYMENT_SUCCESS', label: '4. Cobro Exitoso PRO', desc: 'Confirmación de cobro exitoso y activación oficial de suscripción.' },
  { type: 'DUNNING', label: '5. Cobro Fallido', desc: 'Alerta inmediata cuando la tarjeta es declinada.' },
  { type: 'UPCOMING_RENEWAL', label: '6. Próxima Renovación', desc: 'Aviso 3 días antes de cobrar las mensualidades recurrentes.' },
]

export default function SMTPSettingsPage() {
  const [activeTab, setActiveTab] = useState<TemplateType>('WELCOME')
  const [subject, setSubject] = useState('')
  const [htmlBody, setHtmlBody] = useState('')
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [message, setMessage] = useState<{type: 'success'|'error', text: string} | null>(null)

  // Test Connection State
  const [testEmail, setTestEmail] = useState('')
  const [testFromEmail, setTestFromEmail] = useState('soporte@agora-lexlatin.com')
  const [isTesting, setIsTesting] = useState(false)
  const [testMessage, setTestMessage] = useState<{type: 'success'|'error', text: string} | null>(null)

  // Local cache to avoid losing unsaved edits when switching tabs
  const [templates, setTemplates] = useState<Record<TemplateType, { subject: string, htmlBody: string }>>({
    'WELCOME': { subject: '¡Bienvenido a Ágora Plus PRO!', htmlBody: DEFAULT_WELCOME },
    'REMINDER_TRIAL': { subject: 'Aviso: Tu prueba gratuita de Ágora Plus finaliza en 3 días', htmlBody: DEFAULT_REMINDER_TRIAL },
    'TRIAL_CANCELLED': { subject: 'Confirmación: Tu prueba gratuita de Ágora Plus ha sido cancelada', htmlBody: DEFAULT_TRIAL_CANCELLED },
    'PAYMENT_SUCCESS': { subject: '¡Pago confirmado! Bienvenido a tu suscripción oficial de Ágora Plus PRO', htmlBody: DEFAULT_PAYMENT_SUCCESS },
    'DUNNING': { subject: 'Acción requerida: Problema al procesar tu pago de Ágora Plus', htmlBody: DEFAULT_DUNNING },
    'UPCOMING_RENEWAL': { subject: 'Aviso: Tu suscripción a Ágora Plus se renovará en 3 días', htmlBody: DEFAULT_UPCOMING_RENEWAL }
  })

  useEffect(() => {
    async function load() {
      const data = await getEmailTemplates()
      const newTemplates = { ...templates }
      data.forEach((t: any) => {
        if (newTemplates[t.type as TemplateType]) {
          newTemplates[t.type as TemplateType] = { subject: t.subject, htmlBody: t.htmlBody }
        }
      })
      setTemplates(newTemplates)
      setSubject(newTemplates['WELCOME'].subject)
      setHtmlBody(newTemplates['WELCOME'].htmlBody)
      setIsLoading(false)
    }
    load()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const handleTabChange = (type: TemplateType) => {
    // Save current active tab to local state
    setTemplates(prev => ({
      ...prev,
      [activeTab]: { subject, htmlBody }
    }))
    
    // Switch to new tab
    setActiveTab(type)
    setSubject(templates[type].subject)
    setHtmlBody(templates[type].htmlBody)
    setMessage(null)
  }

  const handleSave = async () => {
    setIsSaving(true)
    setMessage(null)
    const result = await saveEmailTemplate(activeTab, subject, htmlBody)
    
    if (result.success) {
      setMessage({ type: 'success', text: 'Plantilla guardada exitosamente.' })
      setTemplates(prev => ({
        ...prev,
        [activeTab]: { subject, htmlBody }
      }))
    } else {
      setMessage({ type: 'error', text: result.error || 'Ocurrió un error al guardar.' })
    }
    setIsSaving(false)
    
    setTimeout(() => setMessage(null), 4000)
  }

  const handleTestConnection = async () => {
    if (!testEmail || !testFromEmail) return
    setIsTesting(true)
    setTestMessage(null)
    const result = await testResendConnection(testEmail, testFromEmail)
    if (result.success) {
      setTestMessage({ type: 'success', text: '¡Correo enviado! Revisa tu bandeja de entrada. La API está funcionando.' })
    } else {
      setTestMessage({ type: 'error', text: result.error || 'Error al conectar con Resend.' })
    }
    setIsTesting(false)
  }

  if (isLoading) {
    return <div className="p-8 text-muted-foreground animate-pulse">Cargando plantillas...</div>
  }

  const currentTabMeta = TABS.find(t => t.type === activeTab)

  return (
    <div className="space-y-8 animate-in fade-in zoom-in-95 duration-500">
      
      {/* Resend Configuration Status */}
      <div className="bg-surface border border-border shadow-sm sm:rounded-2xl overflow-hidden">
        <div className="px-4 py-6 sm:px-6">
          <h3 className="text-base font-semibold leading-7 text-foreground flex items-center gap-2">
            <Key className="h-5 w-5 text-brand" />
            Configuración del Servidor SMTP (Resend)
          </h3>
          <p className="mt-1 max-w-2xl text-sm leading-6 text-foreground/60">
            Credenciales maestras para el envío de correos transaccionales automatizados.
          </p>
        </div>
        <div className="border-t border-border px-4 py-6 sm:p-6 bg-muted/20">
          <dl className="grid grid-cols-1 gap-x-4 gap-y-6 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <dt className="text-sm font-medium text-foreground">RESEND_API_KEY</dt>
              <dd className="mt-2 text-sm text-foreground/80">
                <input
                  type="password"
                  disabled
                  value="********************************"
                  className="block w-full max-w-md rounded-xl border-0 py-2.5 px-3 text-foreground shadow-sm ring-1 ring-inset ring-border bg-muted/50 sm:text-sm sm:leading-6"
                />
                <p className="mt-3 text-xs text-muted-foreground flex flex-col gap-2">
                  <span>Por seguridad en entornos Serverless, esta llave no es editable desde el panel de control.</span>
                  <a 
                    href="https://vercel.com/jhons-projects-2d167afe/agora-plus/settings/environment-variables" 
                    target="_blank" 
                    rel="noreferrer"
                    className="inline-flex items-center gap-1 text-brand hover:underline w-fit"
                  >
                    Actualizar variable en Vercel <ExternalLink className="h-3 w-3" />
                  </a>
                </p>
              </dd>
            </div>
          </dl>
        </div>
        {/* Test Connection Section */}
        <div className="border-t border-border px-4 py-6 sm:px-6 bg-surface">
          <h4 className="text-sm font-medium text-foreground mb-4">Validar Conexión y Dominio</h4>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 items-end max-w-2xl">
            <div>
              <label className="block text-xs text-muted-foreground mb-1">Correo Remitente (From)</label>
              <input 
                type="email" 
                value={testFromEmail}
                onChange={(e) => setTestFromEmail(e.target.value)}
                className="block w-full rounded-xl border-0 py-2 px-3 text-foreground shadow-sm ring-1 ring-inset ring-border bg-surface sm:text-sm"
                placeholder="soporte@tu-dominio.com"
              />
            </div>
            <div>
              <label className="block text-xs text-muted-foreground mb-1">Enviar Prueba A (To)</label>
              <input 
                type="email" 
                value={testEmail}
                onChange={(e) => setTestEmail(e.target.value)}
                className="block w-full rounded-xl border-0 py-2 px-3 text-foreground shadow-sm ring-1 ring-inset ring-border bg-surface sm:text-sm"
                placeholder="tu-correo@gmail.com"
              />
            </div>
            <div className="sm:col-span-2 flex items-center justify-between mt-2">
              <div className="flex-1">
                {testMessage && (
                  <div className={`flex items-center gap-2 text-sm ${testMessage.type === 'success' ? 'text-emerald-500' : 'text-red-500'}`}>
                    {testMessage.type === 'success' ? <CheckCircle2 className="h-4 w-4 shrink-0" /> : <AlertCircle className="h-4 w-4 shrink-0" />}
                    <span>{testMessage.text}</span>
                  </div>
                )}
              </div>
              <button
                onClick={handleTestConnection}
                disabled={isTesting || !testEmail || !testFromEmail}
                className="flex items-center gap-2 bg-surface border border-border text-foreground px-4 py-2 rounded-xl text-sm font-medium hover:bg-muted transition-colors disabled:opacity-50"
              >
                <Send className="h-4 w-4" />
                {isTesting ? 'Enviando...' : 'Probar Conexión'}
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Editor de Plantillas */}
      <div className="bg-surface border border-border shadow-sm sm:rounded-2xl overflow-hidden">
        <div className="px-4 py-6 sm:px-6 flex flex-col gap-4">
          <div>
            <h3 className="text-base font-semibold leading-7 text-foreground flex items-center gap-2">
              <Mail className="h-5 w-5 text-brand" />
              Plantillas Dinámicas de Correo (Ciclo de Suscripción)
            </h3>
            <p className="mt-1 max-w-2xl text-sm leading-6 text-foreground/60">
              Personaliza el asunto y el código HTML de cada notificación del ciclo de vida del usuario.
            </p>
          </div>
          
          {/* Tabs Selector */}
          <div className="flex flex-wrap gap-2 bg-muted/40 p-1.5 rounded-xl border border-border">
            {TABS.map((tab) => (
              <button
                key={tab.type}
                onClick={() => handleTabChange(tab.type)}
                className={`px-3 py-2 text-xs sm:text-sm font-medium rounded-lg transition-all ${
                  activeTab === tab.type 
                    ? 'bg-surface text-brand shadow-sm border border-border font-semibold' 
                    : 'text-foreground/70 hover:text-foreground hover:bg-surface/50'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {currentTabMeta && (
            <p className="text-xs text-muted-foreground italic">
              ℹ️ {currentTabMeta.desc}
            </p>
          )}
        </div>
        
        <div className="border-t border-border px-4 py-6 sm:p-6">
          <div className="space-y-6">
            
            {/* Legend / Variables */}
            <div className="bg-brand/5 border border-brand/20 rounded-xl p-4 text-sm text-foreground/80">
              <p className="font-semibold text-brand mb-1">Variables Dinámicas Disponibles:</p>
              <ul className="list-disc pl-5 space-y-1 text-xs">
                <li><code>{'{'}{'{'}userFirstname{'}'}{'}'}</code>: Nombre del cliente (Ej. Henry)</li>
                <li><code>{'{'}{'{'}dashboardUrl{'}'}{'}'}</code>: URL del Dashboard o Enlace Mágico de acceso directo</li>
              </ul>
            </div>

            <div>
              <label className="block text-sm font-medium leading-6 text-foreground">
                Asunto del Correo (Subject)
              </label>
              <div className="mt-2">
                <input
                  type="text"
                  value={subject}
                  onChange={(e) => setSubject(e.target.value)}
                  className="block w-full rounded-xl border-0 py-2.5 px-3 bg-surface text-foreground shadow-sm ring-1 ring-inset ring-border placeholder:text-muted-foreground focus:ring-2 focus:ring-inset focus:ring-brand sm:text-sm sm:leading-6"
                  placeholder="Ej. ¡Bienvenido a Ágora Plus!"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium leading-6 text-foreground flex justify-between">
                <span>Cuerpo del Correo (Código HTML)</span>
              </label>
              <div className="mt-2">
                <textarea
                  rows={16}
                  value={htmlBody}
                  onChange={(e) => setHtmlBody(e.target.value)}
                  className="block w-full rounded-xl border-0 py-3 px-4 bg-muted/30 font-mono text-sm text-foreground shadow-sm ring-1 ring-inset ring-border placeholder:text-muted-foreground focus:ring-2 focus:ring-inset focus:ring-brand sm:leading-6 scrollbar-thin scrollbar-thumb-muted"
                  placeholder="<h1>Hola {{userFirstname}}</h1>..."
                />
              </div>
              <p className="mt-2 text-xs text-muted-foreground">
                El texto se enviará interpretado como HTML. Asegúrate de usar etiquetas válidas como &lt;p&gt;, &lt;h1&gt;, &lt;a&gt;, etc.
              </p>
            </div>

            <div className="flex items-center justify-between pt-4 border-t border-border">
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
                disabled={isSaving || !subject || !htmlBody}
                className="flex items-center gap-2 bg-brand text-white px-5 py-2.5 rounded-xl text-sm font-semibold hover:bg-brand-hover transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <Save className="h-4 w-4" />
                {isSaving ? 'Guardando...' : 'Guardar Plantilla'}
              </button>
            </div>

          </div>
        </div>
      </div>
    </div>
  )
}
