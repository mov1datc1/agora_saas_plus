import Stripe from 'stripe'

export const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || 'sk_test_dummy', {
  apiVersion: '2026-05-27.dahlia' as any,
  appInfo: {
    name: 'Agora Plus SaaS',
    version: '0.1.0',
  },
})
