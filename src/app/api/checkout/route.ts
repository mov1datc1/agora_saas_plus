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

    // Get or create customer in Stripe
    let dbUser = await prisma.user.findUnique({
      where: { email: user.email }
    })

    if (!dbUser) {
      return new NextResponse('User not found in DB', { status: 404 })
    }

    let stripeCustomerId = dbUser.stripeCustomerId

    if (!stripeCustomerId) {
      const customer = await stripe.customers.create({
        email: user.email,
        name: dbUser.name || user.email.split('@')[0],
        metadata: {
          supabaseUUID: user.id
        }
      })
      
      stripeCustomerId = customer.id
      
      await prisma.user.update({
        where: { id: dbUser.id },
        data: { stripeCustomerId }
      })
    }

    const priceId = process.env.STRIPE_PRICE_ID
    if (!priceId) {
      return new NextResponse('Stripe Price ID not configured', { status: 500 })
    }

    const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000'

    const session = await stripe.checkout.sessions.create({
      customer: stripeCustomerId,
      mode: 'subscription',
      payment_method_types: ['card'],
      line_items: [
        {
          price: priceId,
          quantity: 1,
        },
      ],
      // 15 days free trial with credit card required
      subscription_data: {
        trial_period_days: 15,
      },
      success_url: `${baseUrl}/dashboard/billing?session_id={CHECKOUT_SESSION_ID}&success=true`,
      cancel_url: `${baseUrl}/dashboard/billing?canceled=true`,
    })

    return NextResponse.json({ url: session.url })

  } catch (error: any) {
    console.error('[STRIPE_CHECKOUT_ERROR]', error)
    return new NextResponse('Internal Error', { status: 500 })
  }
}
