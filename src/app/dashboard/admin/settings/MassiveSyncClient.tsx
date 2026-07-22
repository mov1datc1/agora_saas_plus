'use client'

import { useState, useEffect, useRef } from 'react'
import { Database, Loader2, CheckCircle2, AlertCircle, Play, Pause, Square, History, Terminal, Download, AlertTriangle, Trash2 } from 'lucide-react'
import { runSyncChunk, wipeAllData } from './sync-actions'
import { runRepairExcerptsChunk } from './repair-actions'
import ConfirmModal from '@/components/ui/ConfirmModal'

export default function MassiveSyncClient({ drupalUrl }: { drupalUrl: string }) {
  // Job State
  const [activeJob, setActiveJob] = useState<any>(null)
  const [jobHistory, setJobHistory] = useState<any[]>([])
  
  // Local UI State
  const [isConfirmOpen, setIsConfirmOpen] = useState(false)
  const [isWipeConfirmOpen, setIsWipeConfirmOpen] = useState(false)
  const [isWiping, setIsWiping] = useState(false)
  const [isRepairing, setIsRepairing] = useState(false)
  const [repairProgress, setRepairProgress] = useState({ offset: 0, updated: 0, total: 24556 })
  const [isLoadingJobs, setIsLoadingJobs] = useState(true)
  
  // This ref acts as our "worker thread" memory so we can cancel loops
  const keepSyncingRef = useRef(false)
  
  // Multi-area conflict tracking (for Data Entry team review)
  const [conflicts, setConflicts] = useState<Array<{ id: string; title: string; link: string; practiceAreas: string; assignedType: string; alternativeTypes: string[] }>>([])
  const conflictsRef = useRef<typeof conflicts>([])

  const fetchJobs = async () => {
    try {
      const res = await fetch('/api/sync-jobs')
      const data = await res.json()
      if (data.success) {
        setJobHistory(data.data)
        const running = data.data.find((j: any) => j.status === 'RUNNING' || j.status === 'PAUSED')
        setActiveJob(running || null)
        
        if (running?.status === 'RUNNING' && !keepSyncingRef.current) {
          // Si al cargar vemos que hay uno corriendo y nuestro ref está en false,
          // significa que la pestaña se había cerrado y la acabamos de abrir.
          // Retomamos el proceso automáticamente.
          keepSyncingRef.current = true
          startWorkerLoop(running)
        }
      }
    } catch (error) {
      console.error(error)
    } finally {
      setIsLoadingJobs(false)
    }
  }

  useEffect(() => {
    fetchJobs()
  }, [])

  const handleConfirmStart = async () => {
    setIsConfirmOpen(false)
    try {
      const res = await fetch('/api/sync-jobs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ targetUrl: drupalUrl })
      })
      const data = await res.json()
      if (data.success) {
        setActiveJob(data.data)
        keepSyncingRef.current = true
        startWorkerLoop(data.data)
        fetchJobs()
      }
    } catch (e) {
      console.error(e)
    }
  }

  const handlePause = async () => {
    keepSyncingRef.current = false
    if (activeJob) {
      await patchJob(activeJob.id, { status: 'PAUSED', log: 'Trabajo pausado manualmente.' })
      fetchJobs()
    }
  }

  const handleResume = async () => {
    if (activeJob) {
      const res = await patchJob(activeJob.id, { status: 'RUNNING', log: 'Trabajo reanudado manualmente.' })
      if (res?.success) {
        setActiveJob(res.data)
        keepSyncingRef.current = true
        startWorkerLoop(res.data)
      }
    }
  }

  const handleCancel = async () => {
    keepSyncingRef.current = false
    if (activeJob) {
      await patchJob(activeJob.id, { status: 'CANCELLED', log: 'Trabajo cancelado por el administrador.' })
      setActiveJob(null)
      fetchJobs()
    }
  }

  const patchJob = async (id: string, payload: any) => {
    try {
      const res = await fetch('/api/sync-jobs', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, ...payload })
      })
      return await res.json()
    } catch (e) {
      console.error(e)
    }
  }

  const startWorkerLoop = async (job: any) => {
    let currentOffset = job.currentOffset
    let totalProcessed = job.totalProcessed
    let skippedBlocks = job.skippedBlocks
    const skippedOffsets: number[] = [] // Track which offsets failed for retry pass

    // ── PASS 1: Main sequential sync ──
    while (keepSyncingRef.current) {
      let retries = 0
      let success = false
      
      while (retries < 3 && !success && keepSyncingRef.current) {
        try {
          const logMsg = retries > 0 
            ? `Reintentando offset ${currentOffset}... (Intento ${retries + 1}/3)` 
            : `Descargando bloque en offset ${currentOffset}...`
          
          setActiveJob((prev: any) => ({
            ...prev,
            currentOffset,
            totalProcessed,
            skippedBlocks,
            logs: JSON.stringify([...(prev?.logs ? JSON.parse(prev.logs) : []), { time: new Date().toISOString(), message: logMsg }])
          }))
          
          const result = await runSyncChunk(currentOffset)

          if (!result.success) {
            throw new Error(result.error || 'Error desconocido')
          }

          const count = result.processedCount || 0
          totalProcessed += count

          // Accumulate multi-area conflicts from this chunk
          if (result.multiAreaConflicts && result.multiAreaConflicts.length > 0) {
            conflictsRef.current = [...conflictsRef.current, ...result.multiAreaConflicts]
            setConflicts([...conflictsRef.current])
          }

          // Use finalOffset from API response (accounts for actual batches processed)
          const newOffset = result.finalOffset ?? (currentOffset + 5)
          if (newOffset <= currentOffset || count === 0) {
            // End of data reached
            keepSyncingRef.current = false
          } else {
            currentOffset = newOffset
            await patchJob(job.id, { currentOffset, totalProcessed, skippedBlocks })
          }
          
          success = true
          
          if (keepSyncingRef.current) {
            await new Promise(resolve => setTimeout(resolve, 500))
          }
          
        } catch (err: any) {
          retries++
          console.error(`Error en offset ${currentOffset}, intento ${retries}:`, err)
          if (retries >= 3) {
            skippedBlocks++
            skippedOffsets.push(currentOffset) // Remember this offset for Pass 2
            currentOffset += 5
            await patchJob(job.id, { 
              currentOffset, 
              skippedBlocks, 
              log: `Bloque corrupto en offset ${currentOffset-5}. Saltando para no perder avance...` 
            })
            await new Promise(resolve => setTimeout(resolve, 2000))
            break
          } else {
            const waitTime = retries * 3000
            await patchJob(job.id, { log: `Servidor saturado. Esperando ${waitTime/1000}s...` })
            await new Promise(resolve => setTimeout(resolve, waitTime))
          }
        }
      }
    }

    // ── PASS 2: Recovery pass for skipped blocks ──
    if (skippedOffsets.length > 0) {
      keepSyncingRef.current = true // Re-enable the loop for pass 2
      
      setActiveJob((prev: any) => ({
        ...prev,
        logs: JSON.stringify([...(prev?.logs ? JSON.parse(prev.logs) : []), { 
          time: new Date().toISOString(), 
          message: `🔄 Iniciando Pase de Recuperación: ${skippedOffsets.length} bloques por reintentar...` 
        }])
      }))
      await patchJob(job.id, { log: `🔄 Pase de Recuperación: reintentando ${skippedOffsets.length} bloques saltados...` })

      // Wait 10s before starting recovery to let Drupal server cool down
      await new Promise(resolve => setTimeout(resolve, 10000))

      let recovered = 0
      let stillFailed = 0

      for (const failedOffset of skippedOffsets) {
        if (!keepSyncingRef.current) break // Allow cancel during recovery

        let retries = 0
        let success = false

        while (retries < 3 && !success) {
          try {
            const logMsg = retries > 0 
              ? `🔄 Recuperación: reintentando offset ${failedOffset} (${retries + 1}/3)...`
              : `🔄 Recuperación: descargando offset ${failedOffset}...`

            setActiveJob((prev: any) => ({
              ...prev,
              logs: JSON.stringify([...(prev?.logs ? JSON.parse(prev.logs) : []), { time: new Date().toISOString(), message: logMsg }])
            }))

            const result = await runSyncChunk(failedOffset)

            if (!result.success) {
              throw new Error(result.error || 'Error desconocido')
            }

            const count = result.processedCount || 0
            totalProcessed += count
            skippedBlocks-- // Recovered one!
            recovered++
            success = true

            setActiveJob((prev: any) => ({
              ...prev,
              totalProcessed,
              skippedBlocks,
              logs: JSON.stringify([...(prev?.logs ? JSON.parse(prev.logs) : []), { 
                time: new Date().toISOString(), 
                message: `✅ Offset ${failedOffset} recuperado (${count} transacciones)` 
              }])
            }))

            // Longer wait between recovery blocks to not overwhelm Drupal
            await new Promise(resolve => setTimeout(resolve, 3000))

          } catch (err: any) {
            retries++
            if (retries >= 3) {
              stillFailed++
              setActiveJob((prev: any) => ({
                ...prev,
                logs: JSON.stringify([...(prev?.logs ? JSON.parse(prev.logs) : []), { 
                  time: new Date().toISOString(), 
                  message: `❌ Offset ${failedOffset} falló definitivamente tras 6 intentos totales` 
                }])
              }))
              break
            }
            // Wait 5s between recovery retries (more generous than pass 1)
            await new Promise(resolve => setTimeout(resolve, 5000))
          }
        }
      }

      await patchJob(job.id, { 
        totalProcessed, 
        skippedBlocks,
        log: `🔄 Pase de Recuperación finalizado: ${recovered} recuperados, ${stillFailed} irrecuperables.` 
      })
    }

    // ── FINAL: Mark as completed ──
    keepSyncingRef.current = false
    await patchJob(job.id, { 
      status: 'COMPLETED', 
      currentOffset, 
      totalProcessed, 
      skippedBlocks, 
      log: `¡Completado! Total descargadas: ${totalProcessed}. Bloques irrecuperables: ${skippedBlocks}. Conflictos multi-área: ${conflictsRef.current.length}.` 
    })
    fetchJobs()
  }

  const renderTerminal = (logsStr: string) => {
    let logs = []
    try {
      logs = JSON.parse(logsStr || '[]')
    } catch(e) {}

    return (
      <div className="bg-black text-green-400 font-mono text-xs p-4 rounded-xl mt-4 h-48 overflow-y-auto shadow-inner flex flex-col-reverse">
        {logs.slice().reverse().map((l: any, i: number) => (
          <div key={i} className="mb-1 opacity-90 hover:opacity-100">
            <span className="text-gray-500">[{new Date(l.time).toLocaleTimeString()}]</span> {l.message}
          </div>
        ))}
        {logs.length === 0 && <span className="text-gray-500 italic">Esperando eventos...</span>}
      </div>
    )
  }

  if (isLoadingJobs) {
    return <div className="p-8 flex justify-center"><Loader2 className="w-6 h-6 animate-spin text-brand" /></div>
  }

  return (
    <div className="mt-6 border-t border-border pt-6">
      <div className="flex flex-col gap-6">
        <div>
          <h4 className="text-base font-bold text-foreground flex items-center gap-2 mb-2">
            <Database className="w-5 h-5 text-brand" />
            Panel de Trabajos en Segundo Plano (SyncJobs)
          </h4>
          <p className="text-sm text-foreground/60 max-w-2xl leading-relaxed">
            Gestor robusto para sincronización de +20,000 transacciones. El estado se guarda en la base de datos permitiendo pausar, reanudar y recuperar trabajos ante cierres de sesión. Apuntando a: <code className="text-xs bg-muted px-1 py-0.5 rounded text-brand break-all">{drupalUrl}</code>
          </p>
        </div>

        {/* Panel Activo */}
        {activeJob ? (
          <div className="bg-surface border border-brand/30 rounded-2xl p-6 shadow-sm ring-1 ring-brand/10">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-brand/10 rounded-full animate-pulse">
                  <Database className="w-5 h-5 text-brand" />
                </div>
                <div>
                  <h5 className="font-semibold text-foreground flex items-center gap-2">
                    Trabajo Activo 
                    <span className={`text-xs px-2 py-0.5 rounded-full font-bold ${activeJob.status === 'RUNNING' ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400' : 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400'}`}>
                      {activeJob.status}
                    </span>
                  </h5>
                  <p className="text-xs text-muted-foreground">Iniciado: {new Date(activeJob.startedAt).toLocaleString()}</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                {activeJob.status === 'RUNNING' ? (
                  <button type="button" onClick={handlePause} className="flex items-center gap-1.5 px-3 py-1.5 bg-amber-100 text-amber-700 hover:bg-amber-200 rounded-lg text-sm font-semibold transition-colors">
                    <Pause className="w-4 h-4" /> Pausar
                  </button>
                ) : (
                  <button type="button" onClick={handleResume} className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-100 text-emerald-700 hover:bg-emerald-200 rounded-lg text-sm font-semibold transition-colors">
                    <Play className="w-4 h-4" /> Reanudar
                  </button>
                )}
                <button type="button" onClick={handleCancel} className="flex items-center gap-1.5 px-3 py-1.5 bg-red-100 text-red-700 hover:bg-red-200 rounded-lg text-sm font-semibold transition-colors">
                  <Square className="w-4 h-4" /> Cancelar
                </button>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-4 mb-4">
              <div className="bg-muted/50 p-3 rounded-lg border border-border">
                <p className="text-xs text-muted-foreground font-medium mb-1">Offset (Posición)</p>
                <p className="text-lg font-bold text-foreground">{activeJob.currentOffset}</p>
              </div>
              <div className="bg-muted/50 p-3 rounded-lg border border-border">
                <p className="text-xs text-muted-foreground font-medium mb-1">Procesadas</p>
                <p className="text-lg font-bold text-brand">{activeJob.totalProcessed}</p>
              </div>
              <div className="bg-muted/50 p-3 rounded-lg border border-border">
                <p className="text-xs text-muted-foreground font-medium mb-1">Conflictos Multi-Área</p>
                <p className={`text-lg font-bold ${conflicts.length > 0 ? 'text-amber-500' : 'text-foreground'}`}>{conflicts.length}</p>
              </div>
            </div>

            {/* Conflict Download Button */}
            {conflicts.length > 0 && (
              <div className="flex items-center gap-3 p-3 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-xl">
                <AlertTriangle className="w-5 h-5 text-amber-500 shrink-0" />
                <div className="flex-1">
                  <p className="text-sm font-semibold text-amber-700 dark:text-amber-400">{conflicts.length} transacciones con múltiples áreas de práctica</p>
                  <p className="text-xs text-amber-600 dark:text-amber-500">Descarga el reporte para que Data Entry revise y confirme el tipo correcto.</p>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    const csvHeader = 'Título,URL,Tipo Asignado,Tipos Alternativos,Áreas de Práctica\n'
                    const csvRows = conflicts.map(c => {
                      const title = `"${c.title.replace(/"/g, '""')}"`
                      return `${title},${c.link},${c.assignedType},"${c.alternativeTypes.join('; ')}","${c.practiceAreas}"`
                    }).join('\n')
                    const blob = new Blob([csvHeader + csvRows], { type: 'text/csv;charset=utf-8;' })
                    const url = URL.createObjectURL(blob)
                    const a = document.createElement('a')
                    a.href = url
                    a.download = `conflictos_multi_area_${new Date().toISOString().split('T')[0]}.csv`
                    a.click()
                    URL.revokeObjectURL(url)
                  }}
                  className="flex items-center gap-1.5 px-3 py-2 bg-amber-500 text-white hover:bg-amber-600 rounded-lg text-sm font-semibold transition-colors shrink-0"
                >
                  <Download className="w-4 h-4" /> CSV
                </button>
              </div>
            )}

            {/* Progress Bar Visual (Based on 25k max expected) */}
            <div className="w-full bg-border rounded-full h-2 mb-2 overflow-hidden shadow-inner">
              <div 
                className={`h-2 rounded-full transition-all duration-500 ${activeJob.status === 'RUNNING' ? 'bg-brand' : 'bg-muted-foreground'}`}
                style={{ width: `${Math.min(100, Math.max(2, (activeJob.currentOffset / 25000) * 100))}%` }}
              ></div>
            </div>

            {renderTerminal(activeJob.logs)}
          </div>
        ) : (
          <div className="bg-surface border border-border rounded-2xl p-6 shadow-sm">
            <div className="mb-4">
              <h5 className="font-semibold text-foreground mb-1">Herramientas de Sincronización</h5>
              <p className="text-sm text-muted-foreground">Gestiona la sincronización de datos desde Drupal.</p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <a
                href="/api/sync-drupal/conflicts?format=csv"
                target="_blank"
                className="inline-flex items-center gap-1.5 rounded-lg bg-amber-500 px-3 py-2 text-xs font-semibold text-white hover:bg-amber-600 transition-colors"
              >
                <Download className="w-3.5 h-3.5" /> Conflictos
              </a>
              <button
                type="button"
                onClick={() => setIsWipeConfirmOpen(true)}
                disabled={isWiping}
                className="inline-flex items-center gap-1.5 rounded-lg bg-red-600 px-3 py-2 text-xs font-semibold text-white hover:bg-red-700 disabled:opacity-50 transition-colors"
              >
                {isWiping ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />} {isWiping ? 'Borrando...' : 'Wipe Data'}
              </button>
              <button
                type="button"
                onClick={async () => {
                  setIsRepairing(true)
                  setRepairProgress({ offset: 0, updated: 0, total: 24556 })
                  let offset = 0
                  let totalUpdated = 0
                  while (true) {
                    try {
                      const result = await runRepairExcerptsChunk(offset)
                      if (!result.success) break
                      totalUpdated += result.updatedCount || 0
                      offset = result.finalOffset || (offset + 200)
                      setRepairProgress({ offset, updated: totalUpdated, total: 24556 })
                      if ((result.updatedCount || 0) + (result.skippedCount || 0) < 200) break
                    } catch {
                      break
                    }
                  }
                  setIsRepairing(false)
                  alert(`✅ Reparación completada: ${totalUpdated} excerpts actualizados.`)
                }}
                disabled={isRepairing}
                className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-600 px-3 py-2 text-xs font-semibold text-white hover:bg-emerald-700 disabled:opacity-50 transition-colors"
              >
                {isRepairing ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <CheckCircle2 className="w-3.5 h-3.5" />}
                {isRepairing ? `Reparando... (${repairProgress.updated})` : 'Reparar Excerpts'}
              </button>
              <button
                type="button"
                onClick={() => { conflictsRef.current = []; setConflicts([]); setIsConfirmOpen(true) }}
                className="inline-flex items-center gap-1.5 rounded-lg bg-foreground px-3 py-2 text-xs font-semibold text-background hover:bg-foreground/80 transition-colors"
              >
                <Play className="w-3.5 h-3.5" /> Iniciar SyncJob
              </button>
            </div>
          </div>
        )}

        {/* Historial de Jobs */}
        {jobHistory.length > 0 && (
          <div className="mt-4">
            <h5 className="text-sm font-bold text-foreground flex items-center gap-2 mb-4">
              <History className="w-4 h-4 text-muted-foreground" /> Historial de Ejecuciones
            </h5>
            <div className="bg-surface border border-border rounded-xl overflow-hidden shadow-sm">
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-border text-sm">
                  <thead className="bg-muted/50">
                    <tr>
                      <th className="px-4 py-3 text-left font-semibold text-muted-foreground">Fecha</th>
                      <th className="px-4 py-3 text-left font-semibold text-muted-foreground">Estado</th>
                      <th className="px-4 py-3 text-right font-semibold text-muted-foreground">Procesadas</th>
                      <th className="px-4 py-3 text-right font-semibold text-muted-foreground">Saltados</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {jobHistory.map((job) => (
                      <tr key={job.id} className="hover:bg-muted/30">
                        <td className="px-4 py-3 text-foreground whitespace-nowrap">{new Date(job.startedAt).toLocaleString()}</td>
                        <td className="px-4 py-3">
                          <span className={`text-xs font-semibold ${job.status === 'COMPLETED' ? 'text-emerald-500' : job.status === 'FAILED' ? 'text-red-500' : job.status === 'CANCELLED' ? 'text-gray-500' : 'text-brand'}`}>
                            {job.status}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-right font-medium">{job.totalProcessed}</td>
                        <td className="px-4 py-3 text-right text-muted-foreground">{job.skippedBlocks}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}
      </div>

      <ConfirmModal
        isOpen={isConfirmOpen}
        onClose={() => setIsConfirmOpen(false)}
        onConfirm={handleConfirmStart}
        title="Crear Nuevo SyncJob"
        message="Esta acción creará un nuevo Trabajo en Segundo Plano en la base de datos para extraer progresivamente miles de transacciones de LexLatin. Podrás monitorear su progreso, pausarlo y reanudarlo en cualquier momento."
        confirmText="Iniciar Ahora"
        cancelText="Cancelar"
      />

      <ConfirmModal
        isOpen={isWipeConfirmOpen}
        onClose={() => setIsWipeConfirmOpen(false)}
        onConfirm={async () => {
          setIsWipeConfirmOpen(false)
          setIsWiping(true)
          try {
            const result = await wipeAllData()
            if (result.success) {
              alert('✅ ' + result.message)
              fetchJobs()
            } else {
              alert('❌ Error: ' + result.error)
            }
          } catch (e: any) {
            alert('❌ Error: ' + e.message)
          } finally {
            setIsWiping(false)
          }
        }}
        title="⚠️ Borrar TODA la Data"
        message="Esta acción eliminará TODAS las transacciones, firmas, abogados, empresas e industrias de la base de datos. Esta acción es IRREVERSIBLE. Solo hazlo si planeas re-sincronizar inmediatamente después."
        confirmText="Sí, Borrar Todo"
        cancelText="Cancelar"
      />
    </div>
  )
}
