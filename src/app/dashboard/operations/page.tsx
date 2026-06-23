import { Suspense } from 'react'
import OperationsClient from './OperationsClient'

export default function OperationsPage() {
  return (
    <div className="flex flex-col h-full space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-700">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-3xl font-bold tracking-tight text-foreground">Operaciones</h2>
          <p className="mt-2 text-sm text-muted-foreground">Explora y filtra el histórico de transacciones cargadas desde LexLatin.</p>
        </div>
      </div>

      <Suspense fallback={<div className="h-[600px] flex items-center justify-center text-muted-foreground">Cargando operaciones...</div>}>
        <OperationsClient />
      </Suspense>
    </div>
  )
}
