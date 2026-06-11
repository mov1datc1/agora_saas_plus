import { ArrowLeftRight } from 'lucide-react'

export default function TransactionsPage() {
  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold tracking-tight text-gray-900">Transacciones</h2>
          <p className="mt-2 text-sm text-gray-500">
            Explora y filtra la base de datos completa de operaciones de M&A y fusiones.
          </p>
        </div>
      </div>

      <div className="rounded-2xl bg-white p-12 text-center shadow-sm ring-1 ring-gray-100 flex flex-col items-center justify-center min-h-[400px]">
        <div className="rounded-full bg-red-50 p-4 mb-4">
          <ArrowLeftRight className="h-8 w-8 text-[#E05C50]" />
        </div>
        <h3 className="text-lg font-semibold text-gray-900 mb-2">Módulo en Desarrollo</h3>
        <p className="text-gray-500 max-w-md mx-auto">
          Estamos conectando este módulo con la base de datos de Drupal. Muy pronto podrás ver y buscar todas las transacciones históricas aquí.
        </p>
      </div>
    </div>
  )
}
