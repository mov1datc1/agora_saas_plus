'use client'

import { useState } from 'react'
import { Database, Loader2, CheckCircle2, AlertCircle } from 'lucide-react'
import { runSyncChunk } from './sync-actions'
import ConfirmModal from '@/components/ui/ConfirmModal'

export default function MassiveSyncClient({ drupalUrl }: { drupalUrl: string }) {
  const [isSyncing, setIsSyncing] = useState(false)
  const [progress, setProgress] = useState(0)
  const [statusText, setStatusText] = useState('')
  const [isFinished, setIsFinished] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [isConfirmOpen, setIsConfirmOpen] = useState(false)

  const handleConfirmSync = () => {
    setIsConfirmOpen(false)
    startMassiveSync()
  }

  const startMassiveSync = async () => {
    setIsSyncing(true)
    setIsFinished(false)
    setError(null)
    setProgress(0)
    setStatusText('Iniciando sincronización histórica...')

    let currentOffset = 0
    let totalProcessed = 0
    let keepSyncing = true

    while (keepSyncing) {
      try {
        setStatusText(`Descargando bloque a partir de la posición ${currentOffset}...`)
        const result = await runSyncChunk(currentOffset)

        if (!result.success) {
          throw new Error(result.error || 'Error desconocido')
        }

        const count = result.processedCount || 0
        totalProcessed += count
        setProgress(totalProcessed)

        // Si procesó menos de 150, significa que llegamos al final (Drupal ya no tiene más o mandó el último bloque)
        if (count < 150) {
          keepSyncing = false
          setStatusText(`¡Sincronización completada! Se descargaron ${totalProcessed} transacciones en total.`)
          setIsFinished(true)
        } else {
          currentOffset += 150
        }
      } catch (err: any) {
        keepSyncing = false
        setError(`Falló la sincronización en la posición ${currentOffset}: ${err.message}`)
      }
    }
    
    setIsSyncing(false)
  }

  return (
    <div className="mt-6 border-t border-border pt-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h4 className="text-sm font-medium text-foreground flex items-center gap-2">
            <Database className="w-4 h-4 text-brand" />
            Sincronización Histórica Masiva
          </h4>
          <p className="mt-1 text-sm text-foreground/60 max-w-md">
            Descarga todo el historial de LexLatin iterativamente. Actualmente apuntando a: <code className="text-xs bg-muted px-1 py-0.5 rounded text-brand break-all">{drupalUrl}</code>
          </p>
          
          {isSyncing && (
            <div className="mt-4 p-4 rounded-xl bg-muted/50 border border-border">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2 text-sm text-brand font-medium">
                  <Loader2 className="w-4 h-4 animate-spin" />
                  {statusText}
                </div>
                <span className="text-sm font-semibold text-foreground/80">{progress} operaciones</span>
              </div>
              
              <div className="w-full bg-border rounded-full h-2.5 mb-2 overflow-hidden">
                <div 
                  className="bg-brand h-2.5 rounded-full transition-all duration-500 ease-out relative overflow-hidden" 
                  style={{ width: `${Math.min(100, Math.max(5, (progress / 5000) * 100))}%` }}
                >
                  <div className="absolute top-0 left-0 bottom-0 right-0 bg-white/20 animate-pulse"></div>
                </div>
              </div>
              
              <p className="text-xs text-amber-600 dark:text-amber-400 font-semibold flex items-center gap-1">
                <AlertCircle className="w-3 h-3" />
                ¡ATENCIÓN! No cierres ni recargues esta página hasta que el proceso alcance el 100%.
              </p>
            </div>
          )}
          
          {!isSyncing && isFinished && !error && (
            <div className="mt-3 flex items-center gap-2 text-sm text-emerald-600 dark:text-emerald-400 font-medium bg-emerald-50 dark:bg-emerald-900/20 px-3 py-2 rounded-md ring-1 ring-emerald-500/20">
              <CheckCircle2 className="w-4 h-4" />
              {statusText}
            </div>
          )}

          {!isSyncing && error && (
            <div className="mt-3 flex items-center gap-2 text-sm text-red-600 dark:text-red-400 font-medium bg-red-50 dark:bg-red-900/20 px-3 py-2 rounded-md ring-1 ring-red-500/20">
              <AlertCircle className="w-4 h-4 shrink-0" />
              {error}
            </div>
          )}
        </div>

        <button
          type="button"
          onClick={() => setIsConfirmOpen(true)}
          disabled={isSyncing}
          className="flex items-center gap-2 rounded-md bg-foreground px-4 py-2 text-sm font-semibold text-background shadow-sm hover:bg-foreground/80 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-foreground disabled:opacity-50 transition-colors"
        >
          {isSyncing ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              Sincronizando ({progress})...
            </>
          ) : (
            'Descargar Historial'
          )}
        </button>
      </div>

      <ConfirmModal
        isOpen={isConfirmOpen}
        onClose={() => setIsConfirmOpen(false)}
        onConfirm={handleConfirmSync}
        title="Iniciar Descarga Masiva"
        message="Esta acción iniciará una descarga iterativa de todo el historial de LexLatin (cientos de transacciones). Puede tardar varios minutos en completarse y consumirá recursos del sistema. ¿Estás seguro de que deseas continuar?"
        confirmText="Sí, descargar ahora"
        cancelText="Cancelar"
      />
    </div>
  )
}
