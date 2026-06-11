import Image from 'next/link'
import Link from 'next/link'

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50/50 relative overflow-hidden">
      {/* Background Ornaments */}
      <div className="absolute top-0 left-0 w-full h-full overflow-hidden -z-10 pointer-events-none">
        <div className="absolute -top-[20%] -left-[10%] w-[50%] h-[50%] rounded-full bg-[#E05C50]/10 blur-[100px]" />
        <div className="absolute top-[60%] -right-[10%] w-[40%] h-[40%] rounded-full bg-[#E05C50]/5 blur-[100px]" />
      </div>

      <div className="w-full max-w-md p-6">
        <div className="text-center mb-8">
          <Link href="/" className="inline-block">
            <h1 className="text-4xl font-bold tracking-tight text-gray-900">
              Ágora<span className="text-[#E05C50]">Plus</span>
            </h1>
          </Link>
        </div>
        <div className="bg-white rounded-3xl shadow-xl shadow-gray-200/50 p-8 ring-1 ring-gray-100">
          {children}
        </div>
      </div>
    </div>
  )
}
