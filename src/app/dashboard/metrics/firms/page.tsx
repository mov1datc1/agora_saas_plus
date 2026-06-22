import prisma from '@/lib/prisma'
import FirmsClient from './FirmsClient'

export const dynamic = 'force-dynamic'

export default async function MetricsFirmsPage() {
  try {
    // 1. Conteo de transacciones reales en la DB
    const totalTransactions = await prisma.transaction.count()
    
    // Conteo de Firmas reales en la DB
    const totalFirms = await prisma.firm.count()

    // 2. Firmas Top (Todas las firmas ordenadas para el panel lateral)
    const firmsData = await prisma.firm.findMany({
      include: { _count: { select: { transactions: true } } },
      orderBy: { transactions: { _count: 'desc' } }
    })
    
    const topFirmsList = firmsData.map(f => ({
      name: f.name,
      deals: f._count.transactions
    }))

    return (
      <div className="flex flex-col h-full space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-700">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <h2 className="text-3xl font-bold tracking-tight text-foreground">Metricas del Mercado Global</h2>
            <p className="mt-2 text-sm text-muted-foreground">Analiza el desempeño y volumen histórico de transacciones.</p>
          </div>
        </div>

        <FirmsClient 
          totalTransactions={totalTransactions} 
          totalFirms={totalFirms}
          topFirmsList={topFirmsList}
        />
      </div>
    )
  } catch (error: any) {
    return (
      <div className="flex flex-col items-center justify-center h-full p-8 bg-white rounded-2xl shadow-sm border border-red-200">
        <h2 className="text-2xl font-bold text-red-600 mb-4">Error interno del servidor</h2>
        <p className="text-gray-700 mb-2">Ha ocurrido un problema inesperado al procesar los datos de este módulo.</p>
        <p className="text-gray-600 text-sm mb-6 bg-red-50 p-3 rounded-lg border border-red-100">
          Por favor, toma una captura de pantalla de este mensaje y envíala a <strong>soporte@lexlatin.com</strong> para que nuestro equipo técnico lo solucione a la brevedad.
        </p>
        <div className="bg-gray-50 p-4 rounded-xl text-xs font-mono text-gray-800 w-full max-w-2xl overflow-auto text-left whitespace-pre-wrap border border-gray-200">
          <span className="font-bold text-red-500 block mb-2">Detalles técnicos del error:</span>
          {error.message || String(error)}
        </div>
      </div>
    )
  }
}
