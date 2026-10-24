import { NextResponse } from 'next/server'
import { stripe } from '@/lib/stripe'
import prisma from '@/lib/prisma'

export async function GET(req: Request) {
  try {
    const priceId = process.env.STRIPE_PRICE_ID
    if (!priceId) {
      return new NextResponse('Stripe Price ID not configured', { status: 500 })
    }

    const { searchParams } = new URL(req.url)
    const emailParam = searchParams.get('email')?.trim().toLowerCase()
    const noTrialParam = searchParams.get('noTrial') === 'true'

    const baseUrl = process.env.NEXT_PUBLIC_SITE_URL 
      || (process.env.VERCEL_PROJECT_PRODUCTION_URL ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}` : null)
      || (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : 'http://localhost:3000')

    let hasHadTrial = noTrialParam
    let stripeCustomerId: string | undefined = undefined

    if (emailParam) {
      const existingUser = await prisma.user.findFirst({
        where: { email: { equals: emailParam, mode: 'insensitive' } },
        include: { subscription: true }
      })
      if (existingUser) {
        if (existingUser.subscription?.trialEndsAt || existingUser.subscription?.status === 'CANCELED' || existingUser.subscription?.status === 'ACTIVE') {
          hasHadTrial = true
        }
        if (existingUser.stripeCustomerId) {
          stripeCustomerId = existingUser.stripeCustomerId
        }
      }
    }

    const session = await stripe.checkout.sessions.create({
      customer: stripeCustomerId,
      customer_email: stripeCustomerId ? undefined : (emailParam || undefined),
      mode: 'subscription',
      payment_method_types: ['card'],
      line_items: [
        {
          price: priceId,
          quantity: 1,
        },
      ],
      // Si el correo ya tuvo prueba gratuita o se fuerza noTrial, NO se otorgan 15 días gratis (pago inmediato)
      subscription_data: hasHadTrial ? {} : {
        trial_period_days: 15,
      },
      success_url: `${baseUrl}/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${baseUrl}/`,
    })

    if (session.url) {
      return NextResponse.redirect(session.url)
    }

    return new NextResponse('Error creating session', { status: 500 })

  } catch (error: any) {
    console.error('[PUBLIC_CHECKOUT_ERROR]', error)
    return new NextResponse('Internal Error', { status: 500 })
  }
}
