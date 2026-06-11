'use client'

import { useState } from 'react'

export default function CheckoutButton() {
  const [isLoading, setIsLoading] = useState(false)

  const handleCheckout = async () => {
    try {
      setIsLoading(true)
      const res = await fetch('/api/checkout', {
        method: 'POST',
      })

      if (!res.ok) {
        throw new Error('Error creating checkout session')
      }

      const data = await res.json()
      if (data.url) {
        window.location.href = data.url
      }
    } catch (error) {
      console.error(error)
      alert('Hubo un error al procesar el pago. Por favor intenta de nuevo.')
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <button
      onClick={handleCheckout}
      disabled={isLoading}
      className="rounded-xl bg-[#E05C50] px-8 py-4 text-base font-semibold text-white shadow-sm hover:bg-[#c94b40] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#E05C50] transition-all disabled:opacity-50 disabled:cursor-not-allowed"
    >
      {isLoading ? 'Redirigiendo a Stripe...' : 'Empezar Prueba de 15 Días (Gratis)'}
    </button>
  )
}
