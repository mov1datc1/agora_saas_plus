import { Suspense } from 'react'
import prisma from '@/lib/prisma'
import OperationsClient, { UITransaction } from './OperationsClient'

// Configurar ISR
export const revalidate = 43200 // 12 hours cache

export default async function OperationsPage() {
  // Fetch real transactions from Prisma
  const dbTransactions = await prisma.transaction.findMany({
    include: {
      industry: true,
      advisors: { include: { firm: true } }
    },
    orderBy: {
      dateAnnounced: 'desc',
    },
    take: 2500 // Allow loading full history
  })

  // Mapear los datos de la base de datos al formato de la UI
  const mappedTransactions: UITransaction[] = dbTransactions.map(tx => ({
    id: tx.id,
    date: tx.dateClosed?.toLocaleDateString('es-ES') || tx.dateAnnounced?.toLocaleDateString('es-ES') || 'Sin fecha',
    title: tx.title,
    type: tx.type || 'M&A',
    amount: tx.valueString || 'Por definir',
    status: tx.status || 'Completada',
    industry: tx.industry?.name || 'Varios',
    country: tx.country || 'Latinoamérica',
    firm: tx.advisors?.map(a => a.firm.name).join(', ') || 'Sin firmas listadas', 
    lawyer: 'Varios',
    link: tx.link || '#'
  }))

  return (
    <div className="flex flex-col h-full space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-700">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-3xl font-bold tracking-tight text-foreground">Operaciones</h2>
          <p className="mt-2 text-sm text-muted-foreground">Explora y filtra el histórico de transacciones cargadas desde LexLatin.</p>
        </div>
      </div>

      <Suspense fallback={<div className="h-[600px] flex items-center justify-center text-muted-foreground">Cargando operaciones...</div>}>
        <OperationsClient transactions={mappedTransactions} />
      </Suspense>
    </div>
  )
}
