import prisma from '@/lib/prisma'
import FirmsClient from './FirmsClient'

export const dynamic = 'force-dynamic'

export default async function MetricsFirmsPage() {
  try {
    // 1. Obtener todas las transacciones con su industria
    const transactions = await prisma.transaction.findMany({
      include: {
        industry: true
      }
    })

    const totalTransactions = transactions.length
    
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

    // 3. Obtener Data detallada para la tabla Power BI (TransactionAdvisor -> Firm + Transaction)
    const rawAdvisors = await prisma.transactionAdvisor.findMany({
      include: {
        firm: true,
        transaction: {
          include: {
            industry: true,
            companies: { include: { company: true } },
            lawyers: { include: { lawyer: true } },
          }
        }
      },
      orderBy: {
        transaction: { dateAnnounced: 'desc' }
      }
    })

    // Mapear al formato plano para la tabla
    const tableData = rawAdvisors.map(adv => {
      const tx = adv.transaction
      return {
        id: adv.id,
        firma: adv.firm.name,
        monto: tx.valueString || 'No revelado',
        volumen: tx.value ? Number(tx.value) : null,
        tipoOperacion: tx.type || 'M&A',
        pais: tx.country || 'N/D',
        abogados: tx.lawyers.map(l => l.lawyer.name).join(', ') || 'N/D',
        industria: tx.industry?.name || 'Varios / Sin Clasificar',
        empresa: tx.companies.map(c => c.company.name).join(', ') || 'N/D',
        fecha: tx.dateAnnounced ? tx.dateAnnounced.toISOString() : (tx.dateClosed ? tx.dateClosed.toISOString() : null),
        transactionId: tx.id
      }
    })

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
          tableData={tableData}
        />
      </div>
    )
  } catch (error: any) {
    return (
      <div className="flex flex-col items-center justify-center h-full p-8 bg-white rounded-2xl shadow-sm border border-red-200">
        <h2 className="text-2xl font-bold text-red-600 mb-4">Error cargando métricas de firmas</h2>
        <p className="text-gray-700 mb-4">La consulta de datos es muy pesada o hubo un problema de conexión.</p>
        <div className="bg-red-50 p-4 rounded-xl text-sm font-mono text-red-800 w-full overflow-auto text-left whitespace-pre-wrap border border-red-100">
          {error.message || String(error)}
        </div>
      </div>
    )
  }
}
