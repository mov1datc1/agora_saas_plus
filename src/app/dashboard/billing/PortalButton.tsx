'use client'

import { useState } from 'react'

export default function PortalButton({ label = 'Gestionar Suscripción' }: { label?: string }) {
  const [isLoading, setIsLoading] = useState(false)

  const handlePortal = async () => {
    try {
      setIsLoading(true)
      const res = await fetch('/api/portal', {
        method: 'POST',
      })

      if (!res.ok) {
        throw new Error('Error creating portal session')
      }

      const data = await res.json()
      if (data.url) {
        window.location.href = data.url
      }
    } catch (error) {
      console.error(error)
      alert('Hubo un error al abrir el portal. Por favor intenta de nuevo.')
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <button
      onClick={handlePortal}
      disabled={isLoading}
      className="rounded-xl bg-[#E05C50] px-6 py-3 text-sm font-semibold text-white shadow-sm hover:bg-[#c94b40] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#E05C50] transition-all disabled:opacity-50 disabled:cursor-not-allowed"
    >
      {isLoading ? 'Redirigiendo...' : label}
    </button>
  )
}
