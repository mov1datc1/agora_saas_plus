import { NextResponse } from 'next/server'

/**
 * Returns the server's public outbound IP address.
 * The user needs this to whitelist it in Cloudways before running MySQL sync.
 */
export async function GET() {
  try {
    // Use multiple IP detection services for reliability
    const services = [
      'https://api.ipify.org?format=json',
      'https://httpbin.org/ip',
    ]

    for (const service of services) {
      try {
        const res = await fetch(service, { 
          signal: AbortSignal.timeout(5000),
          cache: 'no-store'
        })
        if (res.ok) {
          const data = await res.json()
          const ip = data.ip || data.origin || null
          if (ip) {
            return NextResponse.json({ 
              success: true, 
              ip: ip.split(',')[0].trim(), // httpbin sometimes returns comma-separated
              service: new URL(service).hostname,
              note: 'Esta IP debe agregarse al whitelist de Cloudways antes de ejecutar la sincronización MySQL.'
            })
          }
        }
      } catch { continue }
    }

    return NextResponse.json({ 
      success: false, 
      error: 'No se pudo detectar la IP del servidor.' 
    }, { status: 500 })

  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 })
  }
}
