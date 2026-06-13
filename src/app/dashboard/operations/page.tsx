import prisma from '@/lib/prisma'
import OperationsClient, { UITransaction } from './OperationsClient'

// Configurar para que la página sea dinámica y siempre traiga la data más fresca
export const dynamic = 'force-dynamic'

export default async function OperationsPage() {
  // Fetch real transactions from Prisma
  const dbTransactions = await prisma.transaction.findMany({
    include: {
      industry: true,
    },
    orderBy: {
      dateAnnounced: 'desc',
    },
    take: 100 // Mostrar las últimas 100 por ahora
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
    country: 'Latinoamérica', // Dato genérico por ahora, se puede expandir el ETL
    firm: 'Ver detalle', 
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

      <OperationsClient transactions={mappedTransactions} />
    </div>
  )
}
