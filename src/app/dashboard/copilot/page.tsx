'use client'

import { useChat } from '@ai-sdk/react'
import { Sparkles, Send, Download, AlertCircle, Bot, User, FileText } from 'lucide-react'
import { useState, useEffect, useRef } from 'react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'

export default function CopilotPage() {
  const [input, setInput] = useState('')
  const { messages, sendMessage, status, error } = useChat({
    onError: (err) => {
      console.error(err)
    }
  })

  const isLoading = status === 'streaming' || status === 'submitted'

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setInput(e.target.value)
  }

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    if (!input.trim() || isLoading) return
    sendMessage({ role: 'user', parts: [{ type: 'text', text: input }] })
    setInput('')
  }

  const messagesEndRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  const handleDownload = (content: string) => {
    const blob = new Blob([content], { type: 'text/markdown;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `Reporte_Agora_${new Date().toISOString().slice(0,10)}.md`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
  }

  const suggestions = [
    "Genera un reporte de las industrias más activas en el último año.",
    "¿Cuáles son los despachos con más operaciones legales registradas?",
    "Muéstrame los países con mayor volumen de fusiones y adquisiciones en 2024.",
  ]

  return (
    <div className="flex h-[calc(100vh-6rem)] flex-col lg:px-8 px-4 py-6 max-w-5xl mx-auto w-full">
      
      {/* Encabezado */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
          <Sparkles className="h-6 w-6 text-brand" />
          Ágora Copilot
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          Tu asistente financiero y legal impulsado por IA. Puedes hacer 5 reportes por mes.
        </p>
      </div>

      {/* Ventana de Chat */}
      <div className="flex-1 overflow-y-auto rounded-2xl bg-surface border border-border shadow-sm p-4 sm:p-6 space-y-6 scrollbar-thin scrollbar-thumb-muted">
        {messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center space-y-8 animate-in fade-in zoom-in duration-500">
            <div className="h-20 w-20 rounded-full bg-brand/10 flex items-center justify-center">
              <Bot className="h-10 w-10 text-brand" />
            </div>
            <div className="max-w-md">
              <h2 className="text-xl font-semibold text-foreground mb-2">¿En qué puedo ayudarte hoy?</h2>
              <p className="text-muted-foreground text-sm mb-6">
                Tengo acceso directo a la base de datos de Ágora. Puedo cruzar datos, listar transacciones y generar reportes analíticos precisos en segundos.
              </p>
              <div className="grid grid-cols-1 gap-3 text-left">
                {suggestions.map((suggestion, idx) => (
                  <button
                    key={idx}
                    onClick={() => sendMessage({ role: 'user', parts: [{ type: 'text', text: suggestion }] })}
                    className="p-3 text-sm rounded-xl border border-border bg-background hover:border-brand/50 hover:bg-brand/5 transition-colors flex items-start gap-3"
                  >
                    <FileText className="h-5 w-5 text-brand shrink-0" />
                    <span className="text-foreground/80">{suggestion}</span>
                  </button>
                ))}
              </div>
            </div>
          </div>
        ) : (
          messages.map(m => {
            const textParts = m.parts?.filter((p): p is { type: 'text', text: string } => p.type === 'text') || []
            const textContent = textParts.map(p => p.text).join('\n')
            const hasTools = m.parts?.some(p => p.type.startsWith('tool-') || p.type === 'dynamic-tool') || false;

            return (
            <div key={m.id} className={`flex gap-4 ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
              {m.role !== 'user' && (
                <div className="h-8 w-8 rounded-full bg-brand/10 flex items-center justify-center shrink-0">
                  <Bot className="h-5 w-5 text-brand" />
                </div>
              )}
              
              <div className={`relative group max-w-[85%] rounded-2xl px-5 py-4 ${
                m.role === 'user' 
                  ? 'bg-brand text-white shadow-md' 
                  : 'bg-muted/50 border border-border text-foreground'
              }`}>
                {m.role !== 'user' && hasTools ? (
                  <div className="text-xs text-muted-foreground italic mb-2 animate-pulse">
                    Analizando datos de Ágora...
                  </div>
                ) : null}

                <div className="prose prose-sm dark:prose-invert max-w-none prose-p:leading-relaxed prose-pre:bg-background/50 prose-pre:border prose-pre:border-border prose-th:text-brand prose-a:text-brand">
                  <ReactMarkdown remarkPlugins={[remarkGfm]}>
                    {textContent}
                  </ReactMarkdown>
                </div>

                {m.role !== 'user' && textContent.length > 50 && !isLoading && (
                  <button
                    onClick={() => handleDownload(textContent)}
                    className="absolute -bottom-4 right-2 opacity-0 group-hover:opacity-100 transition-opacity bg-background border border-border rounded-full p-2 shadow-sm text-muted-foreground hover:text-brand"
                    title="Descargar Reporte"
                  >
                    <Download className="h-4 w-4" />
                  </button>
                )}
              </div>

              {m.role === 'user' && (
                <div className="h-8 w-8 rounded-full bg-foreground/10 flex items-center justify-center shrink-0">
                  <User className="h-5 w-5 text-foreground/70" />
                </div>
              )}
            </div>
          )})
        )}

        {isLoading && messages.length > 0 && messages[messages.length - 1].role === 'user' && (
          <div className="flex gap-4 justify-start">
            <div className="h-8 w-8 rounded-full bg-brand/10 flex items-center justify-center shrink-0">
              <Bot className="h-5 w-5 text-brand" />
            </div>
            <div className="bg-muted/50 border border-border rounded-2xl px-5 py-4 flex items-center gap-2">
              <span className="w-2 h-2 bg-brand rounded-full animate-bounce" />
              <span className="w-2 h-2 bg-brand rounded-full animate-bounce" style={{ animationDelay: '0.2s' }} />
              <span className="w-2 h-2 bg-brand rounded-full animate-bounce" style={{ animationDelay: '0.4s' }} />
            </div>
          </div>
        )}
        
        {error && (
          <div className="flex gap-4 justify-start">
            <div className="bg-red-500/10 border border-red-500/20 text-red-600 rounded-2xl px-5 py-4 text-sm flex items-start gap-2">
              <AlertCircle className="h-5 w-5 shrink-0" />
              <span>{error.message === 'Has alcanzado el límite de 5 consultas mensuales.' ? error.message : 'Ocurrió un error al procesar tu solicitud. Intenta de nuevo.'}</span>
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Caja de Input */}
      <div className="mt-4 relative">
        <form onSubmit={handleSubmit} className="relative flex items-center">
          <input
            className="w-full rounded-full border-0 bg-surface ring-1 ring-inset ring-border py-4 pl-6 pr-14 text-foreground shadow-sm placeholder:text-muted-foreground focus:ring-2 focus:ring-inset focus:ring-brand sm:text-sm sm:leading-6"
            value={input}
            onChange={handleInputChange}
            placeholder="Escribe tu consulta aquí..."
            disabled={isLoading}
          />
          <button
            type="submit"
            disabled={isLoading || !input.trim()}
            className="absolute right-2 rounded-full p-2 bg-brand text-white hover:bg-brand-hover disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            <Send className="h-5 w-5" />
          </button>
        </form>
      </div>

    </div>
  )
}
