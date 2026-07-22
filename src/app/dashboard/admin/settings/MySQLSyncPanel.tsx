'use client'

import { useState, useRef } from 'react'
import { Database, Loader2, AlertTriangle, CheckCircle2, Copy, Server, Play, Square, Globe } from 'lucide-react'

export default function MySQLSyncPanel() {
  const [serverIp, setServerIp] = useState<string | null>(null)
  const [isDetectingIp, setIsDetectingIp] = useState(false)
  const [ipCopied, setIpCopied] = useState(false)

  const [isSyncing, setIsSyncing] = useState(false)
  const [syncProgress, setSyncProgress] = useState({ processed: 0, skipped: 0, total: 0, offset: 0, chunks: 0 })
  const [syncLog, setSyncLog] = useState<string[]>([])
  const [syncError, setSyncError] = useState<string | null>(null)
  const keepSyncingRef = useRef(false)

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
    setSyncLog(prev => [...prev.slice(-50), `[${new Date().toLocaleTimeString()}] ${msg}`])
  }

  // ── MySQL Sync Loop ──
  const startSync = async () => {
    if (!confirm('¿Iniciar sincronización MySQL directa? Esto actualizará TODA la data histórica desde Drupal MySQL.')) return
    
    setIsSyncing(true)
    keepSyncingRef.current = true
    setSyncProgress({ processed: 0, skipped: 0, total: 0, offset: 0, chunks: 0 })
    setSyncLog([])
    setSyncError(null)
    addLog('🚀 Iniciando sincronización MySQL directa...')

    let offset = 0
    let totalProcessed = 0
    let totalSkipped = 0
    let chunks = 0

    while (keepSyncingRef.current) {
      try {
        const res = await fetch('/api/admin/mysql-sync', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ offset, chunkSize: 200 })
        })
        const data = await res.json()

        if (!data.success) {
          if (data.needsWhitelist) {
            setSyncError(`⚠️ La IP del servidor no está en el whitelist de Cloudways. Agrega la IP ${serverIp || '(detecta la IP primero)'} al whitelist y vuelve a intentar.`)
          } else {
            setSyncError(data.error)
          }
          addLog(`❌ Error: ${data.error}`)
          break
        }

        totalProcessed += data.processed
        totalSkipped += data.skipped
        chunks++
        offset = data.offset

        setSyncProgress({
          processed: totalProcessed,
          skipped: totalSkipped,
          total: data.total,
          offset: data.offset,
          chunks,
        })

        addLog(`✅ Chunk #${chunks}: ${data.processed} procesados, ${data.skipped} filtrados (${data.durationMs}ms) — Offset: ${offset}/${data.total}`)

        if (!data.hasMore) {
          addLog(`🎉 Sincronización completada: ${totalProcessed} transacciones, ${totalSkipped} filtradas en ${chunks} chunks`)
          break
        }
      } catch (e: any) {
        setSyncError(e.message)
        addLog(`❌ Error fatal: ${e.message}`)
        break
      }
    }

    keepSyncingRef.current = false
    setIsSyncing(false)
  }

  const stopSync = () => {
    keepSyncingRef.current = false
    addLog('⏹️ Sincronización detenida manualmente')
  }

  const progress = syncProgress.total > 0 ? Math.round((syncProgress.offset / syncProgress.total) * 100) : 0

  return (
    <div className="rounded-2xl border border-border/60 bg-card/50 backdrop-blur-sm overflow-hidden">
      {/* Header */}
      <div className="px-5 py-4 border-b border-border/40 bg-gradient-to-r from-orange-500/10 to-amber-500/10">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-xl bg-orange-500/20">
            <Database className="w-5 h-5 text-orange-400" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-foreground">Sincronización MySQL Directa</h3>
            <p className="text-xs text-muted-foreground mt-0.5">Conexión directa a Drupal MySQL para sync histórica total (~15-20 min)</p>
          </div>
        </div>
      </div>

      <div className="p-5 space-y-4">
        {/* Step 1: IP Detection */}
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
          {serverIp && (
            <p className="text-xs text-amber-400 flex items-center gap-1.5">
              <AlertTriangle className="w-3 h-3" />
              Agrega esta IP al whitelist de Cloudways antes de sincronizar. La IP puede cambiar entre ejecuciones.
            </p>
          )}
        </div>

        {/* Step 2: Run Sync */}
        <div className="space-y-2 pt-2 border-t border-border/30">
          <div className="flex items-center gap-2 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
            <Database className="w-3.5 h-3.5" />
            Paso 2: Ejecutar Sincronización
          </div>
          <div className="flex items-center gap-2">
            {!isSyncing ? (
              <button
                onClick={startSync}
                disabled={!serverIp}
                className="inline-flex items-center gap-1.5 rounded-lg bg-orange-600 px-4 py-2 text-xs font-semibold text-white hover:bg-orange-700 disabled:opacity-40 transition-colors"
              >
                <Play className="w-3.5 h-3.5" />
                Iniciar Sync MySQL
              </button>
            ) : (
              <button
                onClick={stopSync}
                className="inline-flex items-center gap-1.5 rounded-lg bg-red-600 px-4 py-2 text-xs font-semibold text-white hover:bg-red-700 transition-colors"
              >
                <Square className="w-3.5 h-3.5" />
                Detener
              </button>
            )}
          </div>
        </div>

        {/* Progress */}
        {(isSyncing || syncProgress.processed > 0) && (
          <div className="space-y-2 pt-2">
            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <span>{syncProgress.processed.toLocaleString()} procesados • {syncProgress.skipped.toLocaleString()} filtrados</span>
              <span>{progress}% • Chunk #{syncProgress.chunks}</span>
            </div>
            <div className="w-full h-2 rounded-full bg-foreground/10 overflow-hidden">
              <div
                className="h-full rounded-full bg-gradient-to-r from-orange-500 to-amber-400 transition-all duration-500"
                style={{ width: `${progress}%` }}
              />
            </div>
            <div className="text-xs text-muted-foreground">
              {syncProgress.offset.toLocaleString()} / {syncProgress.total.toLocaleString()} posts
            </div>
          </div>
        )}

        {/* Error */}
        {syncError && (
          <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/20 text-xs text-red-400">
            {syncError}
          </div>
        )}

        {/* Log */}
        {syncLog.length > 0 && (
          <div className="mt-3 p-3 rounded-lg bg-black/30 border border-border/20 max-h-48 overflow-y-auto">
            <div className="space-y-0.5 font-mono text-[10px] text-muted-foreground">
              {syncLog.map((line, i) => (
                <div key={i} className={line.includes('❌') ? 'text-red-400' : line.includes('✅') || line.includes('🎉') ? 'text-green-400' : ''}>{line}</div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
