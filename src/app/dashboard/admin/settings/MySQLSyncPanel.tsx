'use client'

import { useState, useRef, useEffect, useCallback } from 'react'
import { Database, Loader2, AlertTriangle, CheckCircle2, Copy, Server, Play, Square, Globe, PartyPopper } from 'lucide-react'

export default function MySQLSyncPanel() {
  const [serverIp, setServerIp] = useState<string | null>(null)
  const [isDetectingIp, setIsDetectingIp] = useState(false)
  const [ipCopied, setIpCopied] = useState(false)

  const [isSyncing, setIsSyncing] = useState(false)
  const [isConnecting, setIsConnecting] = useState(false)
  const [isComplete, setIsComplete] = useState(false)
  const [syncProgress, setSyncProgress] = useState({ processed: 0, skipped: 0, deleted: 0, total: 0, offset: 0, chunks: 0 })
  const [syncLog, setSyncLog] = useState<string[]>([])
  const [syncError, setSyncError] = useState<string | null>(null)
  const [elapsedTime, setElapsedTime] = useState(0)
  const keepSyncingRef = useRef(false)
  const startTimeRef = useRef(0)
  const keepAliveRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const logRef = useRef<HTMLDivElement>(null)
  const panelRef = useRef<HTMLDivElement>(null)

  // ── Keep-alive: prevents browser from throttling this tab ──
  const startKeepAlive = useCallback(() => {
    keepAliveRef.current = setInterval(() => {
      fetch('/api/admin/server-ip', { method: 'HEAD' }).catch(() => {})
    }, 25000)
    startTimeRef.current = Date.now()
    timerRef.current = setInterval(() => {
      setElapsedTime(Math.floor((Date.now() - startTimeRef.current) / 1000))
    }, 1000)
  }, [])

  const stopKeepAlive = useCallback(() => {
    if (keepAliveRef.current) { clearInterval(keepAliveRef.current); keepAliveRef.current = null }
    if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null }
  }, [])

  useEffect(() => () => stopKeepAlive(), [stopKeepAlive])

  // Auto-scroll log to bottom
  useEffect(() => {
    if (logRef.current) {
      logRef.current.scrollTop = logRef.current.scrollHeight
    }
  }, [syncLog])

  // ── Browser notification when done ──
  const notifyCompletion = useCallback((processed: number, skipped: number, success: boolean) => {
    document.title = success 
      ? `✅ Sync completada — ${processed} transacciones` 
      : `❌ Sync MySQL falló`
    if ('Notification' in window && Notification.permission === 'granted') {
      new Notification('Ágora Plus — Sync MySQL', {
        body: success
          ? `✅ Completada: ${processed.toLocaleString()} procesados, ${skipped.toLocaleString()} filtrados`
          : `❌ Error en la sincronización`,
        icon: '/favicon.ico'
      })
    }
  }, [])

  useEffect(() => {
    if ('Notification' in window && Notification.permission === 'default') {
      Notification.requestPermission()
    }
  }, [])

  // ── Detect Server IP ──
  const detectIp = async () => {
    setIsDetectingIp(true)
    setSyncError(null)
    try {
      const res = await fetch('/api/admin/server-ip')
      const data = await res.json()
      if (data.success) {
        setServerIp(data.ip)
        addLog(`🌐 IP del servidor detectada: ${data.ip}`)
      } else {
        setSyncError(data.error)
      }
    } catch (e: any) {
      setSyncError(`Error detectando IP: ${e.message}`)
    }
    setIsDetectingIp(false)
  }

  const copyIp = () => {
    if (serverIp) {
      navigator.clipboard.writeText(serverIp)
      setIpCopied(true)
      setTimeout(() => setIpCopied(false), 2000)
    }
  }

  const addLog = (msg: string) => {
    setSyncLog(prev => [...prev.slice(-100), `[${new Date().toLocaleTimeString()}] ${msg}`])
  }

  const formatTime = (seconds: number) => {
    const m = Math.floor(seconds / 60)
    const s = seconds % 60
    return `${m}:${s.toString().padStart(2, '0')}`
  }

  // ── MySQL Sync Loop ──
  const startSync = async () => {
    if (!confirm('¿Iniciar sincronización MySQL directa?\n\nEsto importará data válida y eliminará registros basura.\nPuedes cambiar de pestaña — te notificará cuando termine.')) return
    
    setIsSyncing(true)
    setIsConnecting(true)
    setIsComplete(false)
    keepSyncingRef.current = true
    setSyncProgress({ processed: 0, skipped: 0, deleted: 0, total: 0, offset: 0, chunks: 0 })
    setSyncLog([])
    setSyncError(null)
    setElapsedTime(0)
    startKeepAlive()
    
    addLog('🚀 Iniciando sincronización MySQL directa...')
    addLog('🔌 Conectando a MySQL Drupal (puede tomar 10-30 seg)...')

    // Scroll panel into view
    setTimeout(() => {
      panelRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' })
    }, 100)

    let offset = 0
    let totalProcessed = 0
    let totalSkipped = 0
    let totalDeleted = 0
    let chunks = 0

    while (keepSyncingRef.current) {
      try {
        addLog(chunks === 0 
          ? '⏳ Leyendo datos de MySQL y procesando primer chunk...' 
          : `⏳ Procesando chunk #${chunks + 1}...`)

        const res = await fetch('/api/admin/mysql-sync', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ offset, chunkSize: 50 })
        })

        setIsConnecting(false) // First response received

        if (!res.ok) {
          const errorText = await res.text()
          setSyncError(`Error HTTP ${res.status}: ${errorText.substring(0, 200)}`)
          addLog(`❌ Error HTTP ${res.status}`)
          notifyCompletion(totalProcessed, totalSkipped, false)
          break
        }

        const data = await res.json()

        if (!data.success) {
          if (data.needsWhitelist) {
            setSyncError(`⚠️ La IP del servidor no está en el whitelist de Cloudways. Agrega la IP ${serverIp || '(detecta la IP primero)'} al whitelist y vuelve a intentar.`)
          } else {
            setSyncError(data.error)
          }
          addLog(`❌ Error: ${data.error}`)
          notifyCompletion(totalProcessed, totalSkipped, false)
          break
        }

        totalProcessed += data.processed
        totalSkipped += data.skipped
        totalDeleted += (data.deleted || 0)
        chunks++
        offset = data.offset

        setSyncProgress({
          processed: totalProcessed,
          skipped: totalSkipped,
          deleted: totalDeleted,
          total: data.total,
          offset: data.offset,
          chunks,
        })

        addLog(`✅ Chunk #${chunks}: ${data.processed} upserts, ${data.deleted || 0} eliminados, ${data.skipped} filtrados (${data.durationMs}ms) — ${offset}/${data.total}`)

        if (!data.hasMore) {
          addLog(`🎉 ¡Sincronización completada exitosamente!`)
          addLog(`📊 Total: ${totalProcessed.toLocaleString()} transacciones, ${totalDeleted.toLocaleString()} basura eliminada, ${totalSkipped.toLocaleString()} filtradas`)
          setIsComplete(true)
          notifyCompletion(totalProcessed, totalSkipped, true)
          break
        }
      } catch (e: any) {
        setIsConnecting(false)
        const msg = e.message || 'Error desconocido'
        setSyncError(msg.includes('fetch') ? `Error de red: ¿El servidor rechazó la conexión MySQL? Verifica el whitelist de Cloudways.` : msg)
        addLog(`❌ Error fatal: ${msg}`)
        notifyCompletion(totalProcessed, totalSkipped, false)
        break
      }
    }

    stopKeepAlive()
    keepSyncingRef.current = false
    setIsSyncing(false)
    setIsConnecting(false)
  }

  const stopSync = () => {
    keepSyncingRef.current = false
    stopKeepAlive()
    addLog('⏹️ Sincronización detenida manualmente')
  }

  const progress = syncProgress.total > 0 ? Math.round((syncProgress.offset / syncProgress.total) * 100) : 0

  return (
    <div ref={panelRef} className="rounded-2xl border border-border/60 bg-card/50 backdrop-blur-sm overflow-hidden">
      {/* Header */}
      <div className={`px-5 py-4 border-b border-border/40 ${isComplete ? 'bg-gradient-to-r from-green-500/15 to-emerald-500/15' : isSyncing ? 'bg-gradient-to-r from-orange-500/15 to-amber-500/15' : 'bg-gradient-to-r from-orange-500/10 to-amber-500/10'}`}>
        <div className="flex items-center gap-3">
          <div className={`p-2 rounded-xl ${isComplete ? 'bg-green-500/20' : isSyncing ? 'bg-orange-500/30 animate-pulse' : 'bg-orange-500/20'}`}>
            {isComplete ? <CheckCircle2 className="w-5 h-5 text-green-400" /> : isSyncing ? <Loader2 className="w-5 h-5 text-orange-400 animate-spin" /> : <Database className="w-5 h-5 text-orange-400" />}
          </div>
          <div>
            <h3 className="text-sm font-bold text-foreground">
              {isComplete ? '✅ Sincronización Completada' : isSyncing ? (isConnecting ? '🔌 Conectando a MySQL...' : '🔄 Sincronizando...') : 'Sincronización MySQL Directa'}
            </h3>
            <p className="text-xs text-muted-foreground mt-0.5">
              {isComplete 
                ? `${syncProgress.processed.toLocaleString()} transacciones • ${syncProgress.deleted.toLocaleString()} eliminados • ${formatTime(elapsedTime)}`
                : isSyncing
                ? (isConnecting ? 'Conectando al servidor MySQL de Drupal, esto puede tomar 10-30 segundos...' : `Chunk #${syncProgress.chunks} • ${syncProgress.processed.toLocaleString()} procesados`)
                : 'Conexión directa a Drupal MySQL para sync histórica total'
              }
            </p>
          </div>
          {isSyncing && (
            <div className="ml-auto flex items-center gap-2 text-xs text-orange-400 font-mono font-bold">
              <Loader2 className="w-4 h-4 animate-spin" />
              {formatTime(elapsedTime)}
            </div>
          )}
        </div>
      </div>

      <div className="p-5 space-y-4">
        {/* Active Sync Banner */}
        {isSyncing && (
          <div className={`p-4 rounded-xl border flex items-center gap-3 ${isConnecting ? 'bg-blue-500/10 border-blue-500/20' : 'bg-orange-500/10 border-orange-500/20'}`}>
            <Loader2 className={`w-5 h-5 animate-spin flex-shrink-0 ${isConnecting ? 'text-blue-400' : 'text-orange-400'}`} />
            <div>
              <p className={`text-sm font-semibold ${isConnecting ? 'text-blue-400' : 'text-orange-400'}`}>
                {isConnecting ? 'Conectando a MySQL...' : `Procesando chunk #${syncProgress.chunks + 1}`}
              </p>
              <p className="text-xs text-muted-foreground mt-0.5">
                {isConnecting 
                  ? 'Primera conexión toma 10-30 seg. Los siguientes chunks son más rápidos.'
                  : `${syncProgress.processed.toLocaleString()} ✅ • ${syncProgress.deleted.toLocaleString()} 🗑️ • ${syncProgress.skipped.toLocaleString()} ⏭️`
                }
              </p>
            </div>
          </div>
        )}

        {/* Completion Banner */}
        {isComplete && (
          <div className="p-4 rounded-xl bg-green-500/10 border border-green-500/20 flex items-start gap-3">
            <PartyPopper className="w-5 h-5 text-green-400 flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-semibold text-green-400">¡Sincronización exitosa!</p>
              <p className="text-xs text-green-400/80 mt-1 leading-relaxed">
                ✅ {syncProgress.processed.toLocaleString()} transacciones válidas<br />
                🗑️ {syncProgress.deleted.toLocaleString()} registros basura eliminados<br />
                ⏭️ {syncProgress.skipped.toLocaleString()} filtrados • {syncProgress.chunks} chunks • {formatTime(elapsedTime)}
              </p>
            </div>
          </div>
        )}

        {/* Step 1: IP Detection */}
        {!isSyncing && (
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              <Globe className="w-3.5 h-3.5" />
              Paso 1: Detectar IP del Servidor
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={detectIp}
                disabled={isDetectingIp}
                className="inline-flex items-center gap-1.5 rounded-lg bg-blue-600 px-3 py-2 text-xs font-semibold text-white hover:bg-blue-700 disabled:opacity-50 transition-colors"
              >
                {isDetectingIp ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Server className="w-3.5 h-3.5" />}
                {isDetectingIp ? 'Detectando...' : 'Detectar IP'}
              </button>

              {serverIp && (
                <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-foreground/5 border border-border/40">
                  <code className="text-sm font-mono font-bold text-orange-400">{serverIp}</code>
                  <button
                    onClick={copyIp}
                    className="p-1 rounded hover:bg-foreground/10 transition-colors"
                    title="Copiar IP"
                  >
                    {ipCopied ? <CheckCircle2 className="w-3.5 h-3.5 text-green-400" /> : <Copy className="w-3.5 h-3.5 text-muted-foreground" />}
                  </button>
                </div>
              )}
            </div>
            {serverIp && !isComplete && (
              <p className="text-xs text-amber-400 flex items-center gap-1.5">
                <AlertTriangle className="w-3 h-3 flex-shrink-0" />
                Agrega esta IP al whitelist de Cloudways antes de sincronizar.
              </p>
            )}
          </div>
        )}

        {/* Step 2: Run Sync */}
        {!isSyncing && (
          <div className="space-y-2 pt-2 border-t border-border/30">
            <div className="flex items-center gap-2 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              <Database className="w-3.5 h-3.5" />
              Paso 2: Ejecutar Sincronización
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={startSync}
                disabled={!serverIp}
                className="inline-flex items-center gap-1.5 rounded-lg bg-orange-600 px-4 py-2 text-xs font-semibold text-white hover:bg-orange-700 disabled:opacity-40 transition-colors"
              >
                <Play className="w-3.5 h-3.5" />
                {isComplete ? 'Ejecutar de nuevo' : 'Iniciar Sync MySQL'}
              </button>
            </div>
          </div>
        )}

        {/* Stop Button - visible during sync */}
        {isSyncing && (
          <div className="flex items-center gap-3">
            <button
              onClick={stopSync}
              className="inline-flex items-center gap-1.5 rounded-lg bg-red-600 px-4 py-2 text-xs font-semibold text-white hover:bg-red-700 transition-colors"
            >
              <Square className="w-3.5 h-3.5" />
              Detener Sync
            </button>
            <span className="text-[10px] text-muted-foreground">Puedes cambiar de pestaña — seguirá en segundo plano</span>
          </div>
        )}

        {/* Progress */}
        {(isSyncing || syncProgress.processed > 0) && syncProgress.total > 0 && (
          <div className="space-y-2 pt-2">
            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <span>{syncProgress.processed.toLocaleString()} ✅ • {syncProgress.deleted.toLocaleString()} 🗑️ • {syncProgress.skipped.toLocaleString()} ⏭️</span>
              <span>{progress}% • Chunk #{syncProgress.chunks}</span>
            </div>
            <div className="w-full h-2.5 rounded-full bg-foreground/10 overflow-hidden">
              <div
                className={`h-full rounded-full transition-all duration-500 ${isComplete ? 'bg-gradient-to-r from-green-500 to-emerald-400' : 'bg-gradient-to-r from-orange-500 to-amber-400'}`}
                style={{ width: `${progress}%` }}
              />
            </div>
            <div className="text-xs text-muted-foreground">
              {syncProgress.offset.toLocaleString()} / {syncProgress.total.toLocaleString()} posts revisados
            </div>
          </div>
        )}

        {/* Error */}
        {syncError && (
          <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/20 text-xs text-red-400">
            <strong>Error:</strong> {syncError}
          </div>
        )}

        {/* Log */}
        {syncLog.length > 0 && (
          <div ref={logRef} className="mt-3 p-3 rounded-lg bg-black/30 border border-border/20 max-h-52 overflow-y-auto">
            <div className="space-y-0.5 font-mono text-[10px] text-muted-foreground">
              {syncLog.map((line, i) => (
                <div key={i} className={
                  line.includes('❌') ? 'text-red-400' : 
                  line.includes('🎉') ? 'text-green-400 font-bold' :
                  line.includes('✅') ? 'text-green-400' : 
                  line.includes('⏳') ? 'text-yellow-400' :
                  line.includes('🔌') ? 'text-blue-400' :
                  line.includes('ℹ️') ? 'text-blue-400' : ''
                }>{line}</div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
