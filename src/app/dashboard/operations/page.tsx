import { Suspense } from 'react'
import prisma from '@/lib/prisma'
import OperationsClient, { UITransaction } from './OperationsClient'

// Configurar ISR
export const revalidate = 43200 // 12 hours cache

export default async function OperationsPage() {
  try {
    // Fetch real transactions from Prisma
    const dbTransactions = await prisma.transaction.findMany({
      select: {
        id: true,
        title: true,
        type: true,
        valueString: true,
        status: true,
        country: true,
        dateAnnounced: true,
        dateClosed: true,
        link: true,
        industry: {
          select: { name: true }
        },
        advisors: {
          select: {
            firm: {
              select: { name: true }
            }
          }
        }
      },
      orderBy: {
        dateAnnounced: 'desc',
      },
      take: 500 // Reduced from 2500 to prevent Vercel Serverless Memory/Timeout limits during massive syncs
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
      firm: tx.advisors?.map(a => a.firm?.name).filter(Boolean).join(', ') || 'Sin firmas listadas', 
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
  } catch (error: any) {
    return (
      <div className="flex flex-col items-center justify-center h-full p-8 bg-white rounded-2xl shadow-sm border border-red-200">
        <h2 className="text-2xl font-bold text-red-600 mb-4">Error cargando Operaciones</h2>
        <p className="text-gray-700 mb-2">Ha ocurrido un problema inesperado al procesar los datos de la base de datos.</p>
        <p className="text-gray-600 text-sm mb-6 bg-red-50 p-3 rounded-lg border border-red-100">
          Por favor, toma una captura de pantalla de este mensaje y envíala a soporte para solucionarlo.
        </p>
        <div className="bg-gray-50 p-4 rounded-xl text-xs font-mono text-gray-800 w-full max-w-2xl overflow-auto text-left whitespace-pre-wrap border border-gray-200">
          <span className="font-bold text-red-500 block mb-2">Detalles técnicos del error:</span>
          {error.message || String(error)}
        </div>
      </div>
    )
  }
}
