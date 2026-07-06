'use client'

import { useState, useEffect } from 'react'
import { Mail, Key, ExternalLink, Save, CheckCircle2, AlertCircle, Send } from 'lucide-react'
import { getEmailTemplates, saveEmailTemplate, testResendConnection } from '@/app/actions/smtp'

const DEFAULT_WELCOME = `<h1>¡Bienvenido a Ágora Plus!</h1>\n<p>Hola {{userFirstname}},</p>\n<p>Tu suscripción PRO se ha activado con éxito. Ahora tienes acceso total a nuestra base de datos y al <strong>Ágora Copilot</strong> impulsado por IA.</p>\n<p><a href="{{dashboardUrl}}">Ir a mi Dashboard</a></p>\n<p>Saludos,<br>Equipo Ágora Plus</p>`
const DEFAULT_DUNNING = `<h1>Hubo un problema con tu pago</h1>\n<p>Hola {{userFirstname}},</p>\n<p>No pudimos procesar el último cargo de tu suscripción a <strong>Ágora Plus</strong>. Para evitar interrupciones, por favor actualiza tu tarjeta.</p>\n<p><a href="{{dashboardUrl}}/billing">Actualizar Método de Pago</a></p>\n<p>Saludos,<br>Equipo Ágora Plus</p>`
const DEFAULT_REMINDER_TRIAL = `<h1>Tu prueba de Ágora Plus está por terminar</h1>\n<p>Hola {{userFirstname}},</p>\n<p>Esperamos que hayas disfrutado de tu prueba gratuita. Te recordamos que en 3 días comenzará tu suscripción PRO y se realizará el cargo automático a tu método de pago registrado.</p>\n<p>Si deseas continuar con nosotros, no tienes que hacer nada. Si necesitas revisar tu método de pago o cancelación, visita el enlace abajo:</p>\n<p><a href="{{dashboardUrl}}/billing">Ver Mi Facturación</a></p>\n<p>Saludos,<br>Equipo Ágora Plus</p>`

export default function SMTPSettingsPage() {
  const [activeTab, setActiveTab] = useState<'WELCOME' | 'DUNNING' | 'REMINDER_TRIAL'>('WELCOME')
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
  const [templates, setTemplates] = useState<Record<string, { subject: string, htmlBody: string }>>({
    'WELCOME': { subject: '¡Bienvenido a Ágora Plus PRO!', htmlBody: DEFAULT_WELCOME },
    'DUNNING': { subject: 'Acción Requerida: Actualiza tu método de pago', htmlBody: DEFAULT_DUNNING },
    'REMINDER_TRIAL': { subject: 'Aviso: Tu prueba gratuita está por concluir', htmlBody: DEFAULT_REMINDER_TRIAL }
  })

  useEffect(() => {
    async function load() {
      const data = await getEmailTemplates()
      const newTemplates = { ...templates }
      data.forEach(t => {
        newTemplates[t.type] = { subject: t.subject, htmlBody: t.htmlBody }
      })
      setTemplates(newTemplates)
      setSubject(newTemplates['WELCOME'].subject)
      setHtmlBody(newTemplates['WELCOME'].htmlBody)
      setIsLoading(false)
    }
    load()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const handleTabChange = (type: 'WELCOME' | 'DUNNING' | 'REMINDER_TRIAL') => {
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
                    href="https://vercel.com/jhons-projects-2d167afe/agora-saas-plus/settings/environment-variables" 
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
        <div className="px-4 py-6 sm:px-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h3 className="text-base font-semibold leading-7 text-foreground flex items-center gap-2">
              <Mail className="h-5 w-5 text-brand" />
              Plantillas Dinámicas de Correo
            </h3>
            <p className="mt-1 max-w-2xl text-sm leading-6 text-foreground/60">
              Personaliza el asunto y el HTML de los correos automáticos.
            </p>
          </div>
          
          <div className="flex bg-muted/50 p-1 rounded-xl w-fit">
            <button
              onClick={() => handleTabChange('WELCOME')}
              className={`px-4 py-2 text-sm font-medium rounded-lg transition-all ${activeTab === 'WELCOME' ? 'bg-surface text-brand shadow-sm border border-border' : 'text-foreground/60 hover:text-foreground'}`}
            >
              Bienvenida
            </button>
            <button
              onClick={() => handleTabChange('DUNNING')}
              className={`px-4 py-2 text-sm font-medium rounded-lg transition-all ${activeTab === 'DUNNING' ? 'bg-surface text-brand shadow-sm border border-border' : 'text-foreground/60 hover:text-foreground'}`}
            >
              Recuperación
            </button>
            <button
              onClick={() => handleTabChange('REMINDER_TRIAL')}
              className={`px-4 py-2 text-sm font-medium rounded-lg transition-all ${activeTab === 'REMINDER_TRIAL' ? 'bg-surface text-brand shadow-sm border border-border' : 'text-foreground/60 hover:text-foreground'}`}
            >
              Recordatorio (Prueba)
            </button>
          </div>
        </div>
        
        <div className="border-t border-border px-4 py-6 sm:p-6">
          <div className="space-y-6">
            
            {/* Legend / Variables */}
            <div className="bg-brand/5 border border-brand/20 rounded-xl p-4 text-sm text-foreground/80">
              <p className="font-semibold text-brand mb-1">Variables Dinámicas Disponibles:</p>
              <ul className="list-disc pl-5 space-y-1 text-xs">
                <li><code>{'{'}{'{'}userFirstname{'}'}{'}'}</code>: Nombre del cliente (Ej. Jonathan)</li>
                <li><code>{'{'}{'{'}dashboardUrl{'}'}{'}'}</code>: URL del dominio principal ({process.env.NEXT_PUBLIC_SITE_URL || 'https://agora-plus.com'}/dashboard)</li>
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
                  rows={14}
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
