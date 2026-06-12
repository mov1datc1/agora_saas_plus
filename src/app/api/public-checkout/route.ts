import { NextResponse } from 'next/server'
import { stripe } from '@/lib/stripe'
import { redirect } from 'next/navigation'

export async function GET(req: Request) {
  try {
    const priceId = process.env.STRIPE_PRICE_ID
    if (!priceId) {
      return new NextResponse('Stripe Price ID not configured', { status: 500 })
    }

    const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000'

    // We do NOT pass a customer here because we don't know who they are yet.
    // Stripe will collect their email and create the customer.
    const session = await stripe.checkout.sessions.create({
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
      // Collect email at checkout since they are not logged in
      customer_creation: 'always',
      success_url: `${baseUrl}/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${baseUrl}/`,
    })

    if (session.url) {
      redirect(session.url)
    }

    return new NextResponse('Error creating session', { status: 500 })

  } catch (error: any) {
    console.error('[PUBLIC_CHECKOUT_ERROR]', error)
    return new NextResponse('Internal Error', { status: 500 })
  }
}
