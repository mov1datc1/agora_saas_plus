'use server'

import prisma from '@/lib/prisma'
// @ts-ignore
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'

export async function checkTrialRestrictions() {
  const cookieStore = await cookies()
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) {
          return cookieStore.get(name)?.value
        },
      },
    }
  )

  const { data: { session } } = await supabase.auth.getSession()
  if (!session) return { allowed: false, message: 'No autenticado' }

  // Check global toggle
  const config = await prisma.systemConfig.findUnique({ where: { id: 'global' } })
  if (!config?.trialRestrictionsEnabled) {
    return { allowed: true, isTrial: false }
  }

  // Check user subscription
  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    include: { subscription: true }
  })

  if (!user) return { allowed: false, message: 'Usuario no encontrado' }

  const isTrial = user.subscription?.status === 'TRIAL' || !user.subscription

  if (!isTrial) {
    return { allowed: true, isTrial: false } // Active subscriptions have no limits
  }

  // It is a trial user and restrictions are enabled
  const today = new Date()
  today.setHours(0, 0, 0, 0)

  const usage = await prisma.dailyUsage.findUnique({
    where: {
      userId_date: {
        userId: user.id,
        date: today
      }
    }
  })

  const queries = usage?.queries || 0

  if (queries >= 5) {
    return { allowed: false, isTrial: true, message: 'Ya has superado las consultas diarias' }
  }

  // Increment usage
  await prisma.dailyUsage.upsert({
    where: {
      userId_date: {
        userId: user.id,
        date: today
      }
    },
    update: { queries: { increment: 1 } },
    create: {
      userId: user.id,
      date: today,
      queries: 1
    }
  })

  return { allowed: true, isTrial: true }
}

export async function checkCanDownload() {
  const cookieStore = await cookies()
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) {
          return cookieStore.get(name)?.value
        },
      },
    }
  )

  const { data: { session } } = await supabase.auth.getSession()
  if (!session) return { allowed: false }

  const config = await prisma.systemConfig.findUnique({ where: { id: 'global' } })
  if (!config?.trialRestrictionsEnabled) {
    return { allowed: true }
  }

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    include: { subscription: true }
  })

  const isTrial = user?.subscription?.status === 'TRIAL' || !user?.subscription

  if (isTrial) {
    return { allowed: false, message: 'Solo puedes descargar con una suscripción activa' }
  }

  return { allowed: true }
}
