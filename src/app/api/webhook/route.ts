import { NextResponse } from 'next/server'
import { headers } from 'next/headers'
import Stripe from 'stripe'
import { stripe } from '@/lib/stripe'
import prisma from '@/lib/prisma'
import { SubscriptionStatus } from '@prisma/client'

export async function POST(req: Request) {
  const body = await req.text()
  const signature = headers().get('Stripe-Signature') as string

  let event: Stripe.Event

  try {
    event = stripe.webhooks.constructEvent(
      body,
      signature,
      process.env.STRIPE_WEBHOOK_SECRET || ''
    )
  } catch (error: any) {
    console.error(`[WEBHOOK_ERROR] ${error.message}`)
    return new NextResponse(`Webhook Error: ${error.message}`, { status: 400 })
  }

  const session = event.data.object as Stripe.Checkout.Session
  const subscription = event.data.object as Stripe.Subscription

  try {
    switch (event.type) {
      case 'checkout.session.completed':
        if (session.subscription) {
          const stripeSubscription = await stripe.subscriptions.retrieve(session.subscription as string)
          
          const dbUser = await prisma.user.findUnique({
            where: { stripeCustomerId: session.customer as string }
          })
          
          if (dbUser) {
            await prisma.subscription.upsert({
              where: { userId: dbUser.id },
              create: {
                userId: dbUser.id,
                stripeSubscriptionId: stripeSubscription.id,
                status: stripeSubscription.status === 'trialing' ? SubscriptionStatus.TRIAL : SubscriptionStatus.ACTIVE,
                priceId: stripeSubscription.items.data[0].price.id,
                trialEndsAt: stripeSubscription.trial_end ? new Date(stripeSubscription.trial_end * 1000) : null,
                currentPeriodEnd: new Date(stripeSubscription.current_period_end * 1000),
                cancelAtPeriodEnd: stripeSubscription.cancel_at_period_end,
              },
              update: {
                stripeSubscriptionId: stripeSubscription.id,
                status: stripeSubscription.status === 'trialing' ? SubscriptionStatus.TRIAL : SubscriptionStatus.ACTIVE,
                priceId: stripeSubscription.items.data[0].price.id,
                trialEndsAt: stripeSubscription.trial_end ? new Date(stripeSubscription.trial_end * 1000) : null,
                currentPeriodEnd: new Date(stripeSubscription.current_period_end * 1000),
                cancelAtPeriodEnd: stripeSubscription.cancel_at_period_end,
              }
            })
          }
        }
        break

      case 'customer.subscription.updated':
      case 'customer.subscription.deleted':
        const dbSubUser = await prisma.user.findUnique({
          where: { stripeCustomerId: subscription.customer as string }
        })

        if (dbSubUser) {
          // Map Stripe status to Prisma Enum
          let newStatus: SubscriptionStatus = SubscriptionStatus.INCOMPLETE
          if (subscription.status === 'trialing') newStatus = SubscriptionStatus.TRIAL
          if (subscription.status === 'active') newStatus = SubscriptionStatus.ACTIVE
          if (subscription.status === 'canceled') newStatus = SubscriptionStatus.CANCELED
          if (subscription.status === 'past_due' || subscription.status === 'unpaid') newStatus = SubscriptionStatus.PAST_DUE

          await prisma.subscription.update({
            where: { userId: dbSubUser.id },
            data: {
              status: newStatus,
              priceId: subscription.items.data[0].price.id,
              currentPeriodEnd: new Date(subscription.current_period_end * 1000),
              cancelAtPeriodEnd: subscription.cancel_at_period_end,
            }
          })
        }
        break

      default:
        console.log(`[WEBHOOK_UNHANDLED] Event type ${event.type}`)
    }
  } catch (error) {
    console.error('[WEBHOOK_DB_ERROR]', error)
    return new NextResponse('Database Error', { status: 500 })
  }

  return new NextResponse('Webhook processed', { status: 200 })
}
