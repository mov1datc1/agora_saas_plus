import { NextResponse } from 'next/server'
import prisma from '@/lib/prisma'

// ── LEGACY: This route is kept for backwards compatibility with old cron entries ──
// New deployments should use /api/sync-drupal instead.
// Redirects to the new sync-drupal endpoint internally.

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const token = searchParams.get('token')
  const cronSecret = process.env.CRON_SECRET

  // 1. Proteger el endpoint
  if (token !== cronSecret && request.headers.get('Authorization') !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // Redirect to the main sync-drupal endpoint
  const { POST } = await import('@/app/api/sync-drupal/route')
  const mockRequest = new Request(request.url, {
    method: 'POST',
    headers: {
      'authorization': `Bearer ${cronSecret}`
    }
  })
  
  return POST(mockRequest)
}
