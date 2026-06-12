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

    return NextResponse.json({ success: true })
  } catch (error: any) {
    console.error('[CANCEL_SUBSCRIPTION_ERROR]', error)
    return new NextResponse('Internal Error', { status: 500 })
  }
}
