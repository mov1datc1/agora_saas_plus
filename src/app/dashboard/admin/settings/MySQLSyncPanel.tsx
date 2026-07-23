'use client'

import { useState, useRef, useEffect, useCallback } from 'react'
import { Database, Loader2, CheckCircle2, Play, Square, PartyPopper } from 'lucide-react'

export default function MySQLSyncPanel() {
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
  useEffect(() => { if (logRef.current) logRef.current.scrollTop = logRef.current.scrollHeight }, [syncLog])

  const notifyCompletion = useCallback((processed: number, deleted: number, success: boolean) => {
    document.title = success
      ? `✅ Sync completada — ${processed} transacciones`
      : `❌ Sync falló`
    if ('Notification' in window && Notification.permission === 'granted') {
      new Notification('Ágora Plus — Sync', {
        body: success
          ? `✅ ${processed.toLocaleString()} procesados, 🗑️ ${deleted.toLocaleString()} eliminados`
          : `❌ Error en la sincronización`,
        icon: '/favicon.ico'
      })
    }
  }, [])

  useEffect(() => {
    if ('Notification' in window && Notification.permission === 'default') Notification.requestPermission()
  }, [])

  const addLog = (msg: string) => {
    setSyncLog(prev => [...prev.slice(-100), `[${new Date().toLocaleTimeString()}] ${msg}`])
  }

  const formatTime = (seconds: number) => {
    const m = Math.floor(seconds / 60)
    const s = seconds % 60
    return `${m}:${s.toString().padStart(2, '0')}`
  }

  // ── Sync Loop ──
  const startSync = async () => {
    if (!confirm('¿Iniciar sincronización?\n\nImporta transacciones válidas y elimina registros basura.\nPuedes cambiar de pestaña — te notificará al terminar.')) return

    setIsSyncing(true)
    setIsConnecting(true)
    setIsComplete(false)
    keepSyncingRef.current = true
    setSyncProgress({ processed: 0, skipped: 0, deleted: 0, total: 0, offset: 0, chunks: 0 })
    setSyncLog([])
    setSyncError(null)
    setElapsedTime(0)
    startKeepAlive()
    addLog('🚀 Iniciando sincronización...')
    addLog('🔌 Conectando al endpoint PHP en Drupal...')

    setTimeout(() => panelRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' }), 100)

    let offset = 0, totalProcessed = 0, totalSkipped = 0, totalDeleted = 0, chunks = 0

    while (keepSyncingRef.current) {
      let retries = 0
      const MAX_RETRIES = 3
      let success = false

      while (retries <= MAX_RETRIES && !success) {
        try {
          if (retries > 0) {
            const waitSec = retries * 10
            addLog(`🔄 Reintento #${retries} en ${waitSec}s (offset: ${offset})...`)
            await new Promise(r => setTimeout(r, waitSec * 1000))
          } else {
            addLog(chunks === 0 ? '⏳ Leyendo primer chunk...' : `⏳ Chunk #${chunks + 1}...`)
          }

          const res = await fetch('/api/admin/mysql-sync', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ offset, chunkSize: 50 })
          })

          setIsConnecting(false)

          if (!res.ok) {
            const errorText = await res.text()
            // Retry on 5xx errors (Cloudflare 524, server timeouts)
            if (res.status >= 500 && retries < MAX_RETRIES) {
              addLog(`⚠️ HTTP ${res.status} — reintentando...`)
              retries++
              continue
            }
            let parsed: any = {}
            try { parsed = JSON.parse(errorText) } catch {}
            const errorMsg = parsed.error || `HTTP ${res.status}: ${errorText.substring(0, 200)}`
            setSyncError(errorMsg)
            addLog(`❌ ${errorMsg}`)
            notifyCompletion(totalProcessed, totalDeleted, false)
            keepSyncingRef.current = false
            break
          }

          const data = await res.json()

          if (!data.success) {
            if (retries < MAX_RETRIES) {
              addLog(`⚠️ Error del servidor — reintentando...`)
              retries++
              continue
            }
            setSyncError(data.error)
            addLog(`❌ ${data.error}`)
            notifyCompletion(totalProcessed, totalDeleted, false)
            keepSyncingRef.current = false
            break
          }

          totalProcessed += data.processed
          totalSkipped += data.skipped
          totalDeleted += (data.deleted || 0)
          chunks++
          offset = data.offset

          setSyncProgress({
            processed: totalProcessed, skipped: totalSkipped, deleted: totalDeleted,
            total: data.total, offset: data.offset, chunks,
          })

          const phpTime = data.phpDurationMs ? ` (PHP: ${data.phpDurationMs}ms)` : ''
          addLog(`✅ #${chunks}: ${data.processed} upserts, ${data.deleted || 0} 🗑️, ${data.skipped} ⏭️ (${data.durationMs}ms${phpTime}) — ${offset}/${data.total}`)

          if (!data.hasMore) {
            addLog(`🎉 ¡Sincronización completada!`)
            addLog(`📊 ${totalProcessed.toLocaleString()} válidas • ${totalDeleted.toLocaleString()} eliminadas • ${totalSkipped.toLocaleString()} filtradas • ${chunks} chunks`)
            setIsComplete(true)
            notifyCompletion(totalProcessed, totalDeleted, true)
            keepSyncingRef.current = false
          }
          success = true

          // Small pause between chunks to reduce server load
          if (data.hasMore) await new Promise(r => setTimeout(r, 1500))

        } catch (e: any) {
          setIsConnecting(false)
          if (retries < MAX_RETRIES) {
            addLog(`⚠️ Error de red — reintentando... (${e.message})`)
            retries++
            continue
          }
          const msg = e.message || 'Error desconocido'
          setSyncError(msg)
          addLog(`❌ Error tras ${MAX_RETRIES} reintentos: ${msg}`)
          notifyCompletion(totalProcessed, totalDeleted, false)
          keepSyncingRef.current = false
          break
        }
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
    addLog('⏹️ Detenida manualmente')
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
              {isComplete ? '✅ Sincronización Completada' : isSyncing ? (isConnecting ? '🔌 Conectando...' : '🔄 Sincronizando...') : 'Sincronización Drupal → Ágora'}
            </h3>
            <p className="text-xs text-muted-foreground mt-0.5">
              {isComplete
                ? `${syncProgress.processed.toLocaleString()} válidas • ${syncProgress.deleted.toLocaleString()} eliminadas • ${formatTime(elapsedTime)}`
                : isSyncing
                ? (isConnecting ? 'Conectando al servidor Drupal...' : `Chunk #${syncProgress.chunks} • ${syncProgress.processed.toLocaleString()} procesados`)
                : 'Lee MySQL via proxy PHP en Drupal • Importa + limpia basura'
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
                {isConnecting ? 'Conectando al endpoint PHP...' : `Procesando chunk #${syncProgress.chunks + 1}`}
              </p>
              <p className="text-xs text-muted-foreground mt-0.5">
                {isConnecting
                  ? 'Primera conexión puede tomar unos segundos.'
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

        {/* Action Buttons */}
        {!isSyncing && (
          <div className="space-y-2">
            <button
              onClick={startSync}
              className="inline-flex items-center gap-1.5 rounded-lg bg-orange-600 px-4 py-2.5 text-xs font-semibold text-white hover:bg-orange-700 transition-colors"
            >
              <Play className="w-4 h-4" />
              {isComplete ? 'Ejecutar de nuevo' : 'Iniciar Sincronización'}
            </button>
            <p className="text-[10px] text-muted-foreground">
              Requiere que el archivo <code className="text-orange-400">agora-bulk-export.php</code> esté instalado en el servidor Drupal.
            </p>
          </div>
        )}

        {isSyncing && (
          <div className="flex items-center gap-3">
            <button onClick={stopSync} className="inline-flex items-center gap-1.5 rounded-lg bg-red-600 px-4 py-2 text-xs font-semibold text-white hover:bg-red-700 transition-colors">
              <Square className="w-3.5 h-3.5" /> Detener
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
              <div className={`h-full rounded-full transition-all duration-500 ${isComplete ? 'bg-gradient-to-r from-green-500 to-emerald-400' : 'bg-gradient-to-r from-orange-500 to-amber-400'}`} style={{ width: `${progress}%` }} />
            </div>
            <div className="text-xs text-muted-foreground">{syncProgress.offset.toLocaleString()} / {syncProgress.total.toLocaleString()} posts revisados</div>
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
                  line.includes('🔌') ? 'text-blue-400' : ''
                }>{line}</div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
