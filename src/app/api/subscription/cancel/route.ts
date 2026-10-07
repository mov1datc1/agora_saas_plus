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

    // Tell Stripe to cancel at the end of the current billing period
    const stripeSubscription = await stripe.subscriptions.update(
      dbUser.subscription.stripeSubscriptionId,
      { cancel_at_period_end: true }
    )

    // Update Prisma
    await prisma.subscription.update({
      where: { userId: dbUser.id },
      data: {
        cancelAtPeriodEnd: stripeSubscription.cancel_at_period_end
      }
    })

    // Send cancellation confirmation email
    try {
      if (process.env.RESEND_API_KEY) {
        const { Resend } = await import('resend')
        const resend = new Resend(process.env.RESEND_API_KEY)
        const isTrial = dbUser.subscription.status === 'TRIAL' || (dbUser.subscription.trialEndsAt && new Date(dbUser.subscription.trialEndsAt) > new Date())
        const templateType = isTrial ? 'TRIAL_CANCELLED' : 'SUBSCRIPTION_CANCELLED'
        
        const template = await prisma.emailTemplate.findUnique({ where: { type: templateType } })
          || await prisma.emailTemplate.findUnique({ where: { type: 'TRIAL_CANCELLED' } })

        const dashboardUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://www.agora-lexlatin.com'
        const subject = template?.subject || 'Confirmación: Tu prueba gratuita de Ágora Plus ha sido cancelada'
        let html = template?.htmlBody || `<h1>Tu suscripción de prueba ha sido cancelada</h1><p>Hola {{userFirstname}},</p><p>Confirmamos que tu suscripción ha sido cancelada exitosamente y <strong>no se realizó ni se realizará cobro alguno</strong> a tu tarjeta.</p><p><a href="{{dashboardUrl}}">Ir a Ágora Plus</a></p><p>Saludos,<br>Equipo Ágora Plus</p>`

        html = html.replace(/{{userFirstname}}/g, dbUser.name || 'Usuario')
                   .replace(/{{dashboardUrl}}/g, dashboardUrl)

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

    return NextResponse.json({ success: true })
  } catch (error: any) {
    console.error('[CANCEL_SUBSCRIPTION_ERROR]', error)
    return new NextResponse('Internal Error', { status: 500 })
  }
}
