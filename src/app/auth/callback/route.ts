import { NextResponse } from 'next/server'
import { createClient } from '@/utils/supabase/server'

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url)
  const code = searchParams.get('code')
  const token_hash = searchParams.get('token_hash')
  const type = searchParams.get('type')
  const next = searchParams.get('next') ?? '/dashboard'

  const forwardedHost = request.headers.get('x-forwarded-host') 
  const isLocalEnv = process.env.NODE_ENV === 'development'
  const redirectBase = isLocalEnv ? origin : (forwardedHost ? `https://${forwardedHost}` : origin)

  if (code) {
    const supabase = await createClient()
    const { error } = await supabase.auth.exchangeCodeForSession(code)
    
    if (!error) {
      try {
        const { data: { user } } = await supabase.auth.getUser()
        if (user?.email) {
          const prisma = (await import('@/lib/prisma')).default
          const now = new Date()
          await prisma.user.updateMany({
            where: { email: user.email, firstLoginAt: null },
            data: { firstLoginAt: now, lastLoginAt: now }
          })
          await prisma.user.updateMany({
            where: { email: user.email },
            data: { lastLoginAt: now }
          })
        }
      } catch (trackErr) {
        console.error('[CALLBACK_TRACK_ERROR]', trackErr)
      }
      return NextResponse.redirect(`${redirectBase}${next}`)
    }
  }

  if (token_hash && type) {
    const supabase = await createClient()
    const { error } = await supabase.auth.verifyOtp({
      type: type as any,
      token_hash,
    })

    if (!error) {
      try {
        const { data: { user } } = await supabase.auth.getUser()
        if (user?.email) {
          const prisma = (await import('@/lib/prisma')).default
          const now = new Date()
          await prisma.user.updateMany({
            where: { email: user.email, firstLoginAt: null },
            data: { firstLoginAt: now, lastLoginAt: now }
          })
          await prisma.user.updateMany({
            where: { email: user.email },
            data: { lastLoginAt: now }
          })
        }
      } catch (trackErr) {
        console.error('[CALLBACK_TRACK_ERROR]', trackErr)
      }
      return NextResponse.redirect(`${redirectBase}${next}`)
    }
  }

  // Devolver al usuario a login con un error genérico
  return NextResponse.redirect(`${origin}/login?error=Invalid_Auth_Callback`)
}
