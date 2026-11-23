import { NextResponse } from 'next/server'
import { createClient } from '@/utils/supabase/server'
import { stripe } from '@/lib/stripe'
import prisma from '@/lib/prisma'

export async function POST(req: Request) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user || !user.email) {
      return new NextResponse('Unauthorized', { status: 401 })
    }

    const dbUser = await prisma.user.findUnique({
      where: { email: user.email },
      include: { subscription: true }
    })

    if (!dbUser || !dbUser.subscription || !dbUser.subscription.stripeSubscriptionId) {
      return new NextResponse('Subscription not found', { status: 404 })
    }

    const isTrial = dbUser.subscription.status === 'TRIAL' || Boolean(dbUser.subscription.trialEndsAt && new Date(dbUser.subscription.trialEndsAt) > new Date())
    let currentPeriodEnd = dbUser.subscription.currentPeriodEnd

    if (isTrial) {
      // Trial users haven't paid yet: cancel immediately so they are never charged
      try {
        await stripe.subscriptions.cancel(dbUser.subscription.stripeSubscriptionId)
      } catch (stripeErr: any) {
        console.warn('[STRIPE_CANCEL_WARN]', stripeErr?.message || stripeErr)
      }

      await prisma.subscription.update({
        where: { userId: dbUser.id },
        data: {
          status: 'CANCELED',
          cancelAtPeriodEnd: false
        }
      })

      await prisma.user.update({
        where: { id: dbUser.id },
        data: {
          isActive: false
        }
      })
    } else {
      // Paid active subscribers keep full access until the end of their paid billing period
      try {
        const updatedSub = await stripe.subscriptions.update(dbUser.subscription.stripeSubscriptionId, {
          cancel_at_period_end: true
        })
        const stripePeriodEndTs = (updatedSub as any).current_period_end || (updatedSub.items?.data?.[0] as any)?.current_period_end
        if (stripePeriodEndTs) {
          currentPeriodEnd = new Date(stripePeriodEndTs * 1000)
        }
      } catch (stripeErr: any) {
        console.warn('[STRIPE_CANCEL_AT_PERIOD_END_WARN]', stripeErr?.message || stripeErr)
      }

      await prisma.subscription.update({
        where: { userId: dbUser.id },
        data: {
          status: 'ACTIVE',
          cancelAtPeriodEnd: true,
          ...(currentPeriodEnd ? { currentPeriodEnd } : {})
        }
      })

      await prisma.user.update({
        where: { id: dbUser.id },
        data: {
          isActive: true
        }
      })
    }

    // Send cancellation confirmation email
    try {
      if (process.env.RESEND_API_KEY) {
        const { Resend } = await import('resend')
        const resend = new Resend(process.env.RESEND_API_KEY)
        const dashboardUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://www.agora-lexlatin.com'
        const periodEndFormatted = currentPeriodEnd
          ? currentPeriodEnd.toLocaleDateString('es-ES', { day: 'numeric', month: 'long', year: 'numeric' })
          : 'el final de tu ciclo actual'

        let subject: string
        let html: string

        if (isTrial) {
          const template = await prisma.emailTemplate.findUnique({ where: { type: 'TRIAL_CANCELLED' } })
          subject = template?.subject || 'Confirmación: Tu prueba gratuita de Ágora Plus ha sido cancelada'
          html = template?.htmlBody || `<h1>Tu suscripción de prueba ha sido cancelada</h1><p>Hola {{userFirstname}},</p><p>Confirmamos que tu suscripción ha sido cancelada exitosamente y <strong>no se realizó ni se realizará cobro alguno</strong> a tu tarjeta.</p><p><a href="{{dashboardUrl}}">Ir a Ágora Plus</a></p><p>Saludos,<br>Equipo Ágora Plus</p>`
        } else {
          const template = await prisma.emailTemplate.findUnique({ where: { type: 'SUBSCRIPTION_CANCELLED' } })
          subject = template?.subject || 'Confirmación: Renovación cancelada — Mantienes acceso a Ágora Plus hasta fin de periodo'
          html = template?.htmlBody || `<h1>Tu renovación automática ha sido cancelada</h1><p>Hola {{userFirstname}},</p><p>Confirmamos que la renovación automática de tu suscripción a <strong>Ágora Plus</strong> ha sido cancelada y <strong>no se realizarán nuevos cobros</strong> a tu tarjeta.</p><p>Debido a que ya cubriste el ciclo mensual en curso, <strong>mantendrás acceso completo a la plataforma hasta el ${periodEndFormatted}</strong>.</p><p><a href="{{dashboardUrl}}/dashboard/billing">Ver detalles de mi suscripción</a></p><p>Saludos,<br>Equipo Ágora Plus</p>`
        }

        html = html.replace(/{{userFirstname}}/g, dbUser.name || 'Usuario')
                   .replace(/{{dashboardUrl}}/g, dashboardUrl)
                   .replace(/{{periodEndDate}}/g, periodEndFormatted)

        await resend.emails.send({
          from: 'Ágora Plus <soporte@agora-lexlatin.com>',
          to: [dbUser.email],
          subject: subject,
          html: html,
        })
      }
    } catch (emailErr) {
      console.error('[CANCEL_EMAIL_ERROR] Failed to send cancel confirmation email', emailErr)
    }

    // Disparar sincronización con CRM (Cancelación)
    try {
      const { sendCrmWebhook } = await import('@/lib/crm')
      await sendCrmWebhook({
        event: 'SUBSCRIPTION_CANCELED',
        email: dbUser.email,
        name: dbUser.name,
      })
    } catch (crmErr) {
      console.error('[CRM_WEBHOOK_ERROR]', crmErr)
    }

    return NextResponse.json({
      success: true,
      cancelAtPeriodEnd: !isTrial,
      currentPeriodEnd: currentPeriodEnd?.toISOString() || null
    })
  } catch (error: any) {
    console.error('[CANCEL_SUBSCRIPTION_ERROR]', error)
    return new NextResponse('Internal Error', { status: 500 })
  }
}
