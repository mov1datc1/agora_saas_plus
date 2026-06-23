'use client'

import { useState } from 'react'
import { RefreshCw, CheckCircle2, AlertCircle, Loader2 } from 'lucide-react'
import { clearSystemCache } from './sync-actions'

export default function ClearCacheClient() {
  const [isClearing, setIsClearing] = useState(false)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')

  const handleClear = async () => {
    setIsClearing(true)
    setMessage('')
    setError('')
    
    try {
      const result = await clearSystemCache()
      if (result.success) {
        setMessage(result.message || 'Caché liberada.')
      } else {
        setError(result.error || 'Error al liberar caché.')
      }
    } catch (err: any) {
      setError(err.message)
    } finally {
      setIsClearing(false)
      // Ocultar mensaje después de 5 segundos
      setTimeout(() => {
        setMessage('')
        setError('')
      }, 5000)
    }
  }

  return (
    <div className="flex items-center gap-4">
      <button
        onClick={handleClear}
        disabled={isClearing}
        className="flex items-center gap-2 rounded-md bg-amber-500 hover:bg-amber-600 px-4 py-2 text-sm font-semibold text-white shadow-sm disabled:opacity-50 transition-colors"
      >
        {isClearing ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
        {isClearing ? 'Liberando...' : 'Liberar Caché del Sistema'}
      </button>

      {message && (
        <span className="flex items-center gap-1 text-sm font-medium text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-900/20 px-3 py-1.5 rounded-md ring-1 ring-emerald-500/20">
          <CheckCircle2 className="h-4 w-4" />
          {message}
        </span>
      )}

      {error && (
        <span className="flex items-center gap-1 text-sm font-medium text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/20 px-3 py-1.5 rounded-md ring-1 ring-red-500/20">
          <AlertCircle className="h-4 w-4 shrink-0" />
          {error}
        </span>
      )}
    </div>
  )
}
