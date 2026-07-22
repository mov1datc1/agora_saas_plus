'use client'

import { useState, useEffect, useMemo } from 'react'
import { Clock, CheckCircle2, XCircle, Loader2, AlertTriangle, Filter, ChevronLeft, ChevronRight, Activity } from 'lucide-react'

type CronLogEntry = {
  id: string
  jobName: string
  status: string
  trigger: string
  startedAt: string
  completedAt: string | null
  durationMs: number | null
  recordsProcessed: number
  recordsSkipped: number
  errorMessage: string | null
  details: string | null
}

export default function CronLogsPanel() {
  const [logs, setLogs] = useState<CronLogEntry[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [page, setPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [totalCount, setTotalCount] = useState(0)
  const [stats, setStats] = useState<Record<string, number>>({})

  // Filters
  const [dateStart, setDateStart] = useState('')
  const [dateEnd, setDateEnd] = useState('')
  const [filterJob, setFilterJob] = useState('')
  const [filterStatus, setFilterStatus] = useState('')

  // Expanded row
  const [expandedId, setExpandedId] = useState<string | null>(null)

  const fetchLogs = async () => {
    setIsLoading(true)
    try {
      const params = new URLSearchParams()
      params.set('page', String(page))
      params.set('limit', '15')
      if (dateStart) params.set('dateStart', dateStart)
      if (dateEnd) params.set('dateEnd', dateEnd)
      if (filterJob) params.set('jobName', filterJob)
      if (filterStatus) params.set('status', filterStatus)

      const res = await fetch(`/api/cron-logs?${params.toString()}`)
      const data = await res.json()
      if (data.success) {
        setLogs(data.data)
        setTotalPages(data.metadata.totalPages)
        setTotalCount(data.metadata.totalCount)
        setStats(data.stats || {})
      }
    } catch (err) {
      console.error('Failed to fetch cron logs:', err)
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    fetchLogs()
  }, [page, dateStart, dateEnd, filterJob, filterStatus])

  // Reset page when filters change
  useEffect(() => {
    setPage(1)
  }, [dateStart, dateEnd, filterJob, filterStatus])

  const statusIcon = (status: string) => {
    switch (status) {
      case 'SUCCESS': return <CheckCircle2 className="w-4 h-4 text-emerald-500" />
      case 'FAILED': return <XCircle className="w-4 h-4 text-red-500" />
      case 'RUNNING': return <Loader2 className="w-4 h-4 text-blue-500 animate-spin" />
      default: return <AlertTriangle className="w-4 h-4 text-amber-500" />
    }
  }

  const statusBadge = (status: string) => {
    const styles: Record<string, string> = {
      SUCCESS: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400',
      FAILED: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
      RUNNING: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
    }
    return styles[status] || 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400'
  }

  const triggerBadge = (trigger: string) => {
    const styles: Record<string, string> = {
      cron: 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400',
      manual: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',
      system: 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400',
    }
    return styles[trigger] || styles.system
  }

  const formatDuration = (ms: number | null) => {
    if (ms === null) return '—'
    if (ms < 1000) return `${ms}ms`
    if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`
    return `${Math.floor(ms / 60000)}m ${Math.floor((ms % 60000) / 1000)}s`
  }

  const jobLabels: Record<string, string> = {
    'sync-drupal': '🔄 Sync Drupal',
    'check-subscriptions': '💳 Suscripciones',
    'repair-excerpts': '🔧 Reparar Excerpts',
  }

  return (
    <div className="mt-6 border-t border-border pt-6">
      <div className="flex flex-col gap-4">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h4 className="text-base font-bold text-foreground flex items-center gap-2">
              <Activity className="w-5 h-5 text-brand" />
              Auditoría de CronJobs
            </h4>
            <p className="text-sm text-muted-foreground mt-0.5">
              Historial de ejecuciones automáticas y manuales del sistema.
            </p>
          </div>
          {/* Stats Summary */}
          <div className="flex items-center gap-3">
            {stats.SUCCESS !== undefined && (
              <div className="flex items-center gap-1 text-xs font-medium text-emerald-600 dark:text-emerald-400">
                <CheckCircle2 className="w-3.5 h-3.5" /> {stats.SUCCESS || 0}
              </div>
            )}
            {stats.FAILED !== undefined && (
              <div className="flex items-center gap-1 text-xs font-medium text-red-500">
                <XCircle className="w-3.5 h-3.5" /> {stats.FAILED || 0}
              </div>
            )}
            <span className="text-xs text-muted-foreground">{totalCount} total</span>
          </div>
        </div>

        {/* Filters */}
        <div className="flex flex-wrap items-end gap-3 bg-muted/30 rounded-xl p-3 border border-border">
          <div className="flex items-center gap-1.5 text-xs font-semibold text-muted-foreground">
            <Filter className="w-3.5 h-3.5" /> Filtros:
          </div>
          <div className="flex flex-col">
            <label className="text-[10px] font-medium text-muted-foreground mb-0.5">Desde</label>
            <input
              type="date"
              value={dateStart}
              onChange={e => setDateStart(e.target.value)}
              className="rounded-md border border-border bg-background text-xs px-2 py-1.5 outline-none focus:border-brand transition-colors w-36"
            />
          </div>
          <div className="flex flex-col">
            <label className="text-[10px] font-medium text-muted-foreground mb-0.5">Hasta</label>
            <input
              type="date"
              value={dateEnd}
              onChange={e => setDateEnd(e.target.value)}
              className="rounded-md border border-border bg-background text-xs px-2 py-1.5 outline-none focus:border-brand transition-colors w-36"
            />
          </div>
          <div className="flex flex-col">
            <label className="text-[10px] font-medium text-muted-foreground mb-0.5">Trabajo</label>
            <select
              value={filterJob}
              onChange={e => setFilterJob(e.target.value)}
              className="rounded-md border border-border bg-background text-xs px-2 py-1.5 outline-none focus:border-brand transition-colors"
            >
              <option value="">Todos</option>
              <option value="sync-drupal">Sync Drupal</option>
              <option value="check-subscriptions">Suscripciones</option>
              <option value="repair-excerpts">Reparar Excerpts</option>
            </select>
          </div>
          <div className="flex flex-col">
            <label className="text-[10px] font-medium text-muted-foreground mb-0.5">Estado</label>
            <select
              value={filterStatus}
              onChange={e => setFilterStatus(e.target.value)}
              className="rounded-md border border-border bg-background text-xs px-2 py-1.5 outline-none focus:border-brand transition-colors"
            >
              <option value="">Todos</option>
              <option value="SUCCESS">✅ Exitoso</option>
              <option value="FAILED">❌ Fallido</option>
              <option value="RUNNING">🔄 En ejecución</option>
            </select>
          </div>
          {(dateStart || dateEnd || filterJob || filterStatus) && (
            <button
              onClick={() => { setDateStart(''); setDateEnd(''); setFilterJob(''); setFilterStatus('') }}
              className="text-xs font-medium text-brand hover:text-brand/80 transition-colors px-2 py-1.5"
            >
              Limpiar
            </button>
          )}
        </div>

        {/* Table */}
        <div className="bg-surface border border-border rounded-xl overflow-hidden shadow-sm">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-border text-xs">
              <thead className="bg-muted/50">
                <tr>
                  <th className="px-4 py-3 text-left font-semibold text-muted-foreground">Fecha y Hora</th>
                  <th className="px-4 py-3 text-left font-semibold text-muted-foreground">Trabajo</th>
                  <th className="px-4 py-3 text-left font-semibold text-muted-foreground">Estado</th>
                  <th className="px-4 py-3 text-left font-semibold text-muted-foreground">Origen</th>
                  <th className="px-4 py-3 text-right font-semibold text-muted-foreground">Duración</th>
                  <th className="px-4 py-3 text-right font-semibold text-muted-foreground">Procesados</th>
                  <th className="px-4 py-3 text-right font-semibold text-muted-foreground">Omitidos</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {isLoading ? (
                  <tr>
                    <td colSpan={7} className="px-4 py-8 text-center text-muted-foreground">
                      <Loader2 className="w-5 h-5 animate-spin mx-auto mb-2 text-brand" />
                      <span className="text-xs">Cargando logs...</span>
                    </td>
                  </tr>
                ) : logs.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="px-4 py-8 text-center text-muted-foreground">
                      <Clock className="w-5 h-5 mx-auto mb-2 opacity-40" />
                      <span className="text-xs">No hay registros de auditoría{(dateStart || dateEnd) ? ' para este rango de fechas' : ' aún'}.</span>
                    </td>
                  </tr>
                ) : (
                  logs.map(log => (
                    <>
                      <tr
                        key={log.id}
                        className="hover:bg-muted/30 cursor-pointer transition-colors"
                        onClick={() => setExpandedId(expandedId === log.id ? null : log.id)}
                      >
                        <td className="px-4 py-3 text-foreground whitespace-nowrap">
                          <div className="flex items-center gap-1.5">
                            {statusIcon(log.status)}
                            <span>{new Date(log.startedAt).toLocaleString('es', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit', second: '2-digit' })}</span>
                          </div>
                        </td>
                        <td className="px-4 py-3 text-foreground font-medium">
                          {jobLabels[log.jobName] || log.jobName}
                        </td>
                        <td className="px-4 py-3">
                          <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold ${statusBadge(log.status)}`}>
                            {log.status}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold ${triggerBadge(log.trigger)}`}>
                            {log.trigger === 'cron' ? '⏰ Automático' : log.trigger === 'manual' ? '👤 Manual' : '⚙️ Sistema'}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-right text-foreground/80 font-mono">
                          {formatDuration(log.durationMs)}
                        </td>
                        <td className="px-4 py-3 text-right font-medium text-foreground">
                          {log.recordsProcessed}
                        </td>
                        <td className="px-4 py-3 text-right text-muted-foreground">
                          {log.recordsSkipped}
                        </td>
                      </tr>
                      {/* Expanded Details */}
                      {expandedId === log.id && (
                        <tr key={`${log.id}-detail`}>
                          <td colSpan={7} className="px-4 py-3 bg-muted/20">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
                              <div>
                                <span className="font-semibold text-muted-foreground">ID: </span>
                                <span className="font-mono text-foreground/70">{log.id}</span>
                              </div>
                              <div>
                                <span className="font-semibold text-muted-foreground">Completado: </span>
                                <span className="text-foreground/70">
                                  {log.completedAt ? new Date(log.completedAt).toLocaleString('es') : 'En curso...'}
                                </span>
                              </div>
                              {log.errorMessage && (
                                <div className="md:col-span-2">
                                  <span className="font-semibold text-red-500">Error: </span>
                                  <span className="text-red-500/80 font-mono">{log.errorMessage}</span>
                                </div>
                              )}
                              {log.details && (
                                <div className="md:col-span-2">
                                  <span className="font-semibold text-muted-foreground">Detalles: </span>
                                  <code className="text-[10px] text-foreground/60 bg-muted px-1.5 py-0.5 rounded">
                                    {log.details}
                                  </code>
                                </div>
                              )}
                            </div>
                          </td>
                        </tr>
                      )}
                    </>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between border-t border-border px-4 py-3 bg-muted/20">
              <span className="text-xs text-muted-foreground">
                Página {page} de {totalPages} ({totalCount} registros)
              </span>
              <div className="flex items-center gap-1">
                <button
                  onClick={() => setPage(p => Math.max(1, p - 1))}
                  disabled={page === 1}
                  className="p-1.5 rounded-md hover:bg-muted disabled:opacity-40 transition-colors"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
                <button
                  onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                  disabled={page >= totalPages}
                  className="p-1.5 rounded-md hover:bg-muted disabled:opacity-40 transition-colors"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
