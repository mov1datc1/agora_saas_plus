const Stripe = require('stripe');
const dotenv = require('dotenv');

dotenv.config({ path: '.env.local' });

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
  apiVersion: '2026-05-27.dahlia'
});

async function run() {
  try {
    const session = await stripe.checkout.sessions.create({
      mode: 'subscription',
      payment_method_types: ['card'],
      line_items: [
        {
          price: process.env.STRIPE_PRICE_ID,
          quantity: 1,
        },
      ],
      subscription_data: {
        trial_period_days: 15,
      },
      // Collect email at checkout since they are not logged in (Stripe does this automatically in subscription mode)
      success_url: `http://localhost:3000/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `http://localhost:3000/`,
    });
    console.log(session.url);
  } catch (err) {
    console.error("STRIPE ERROR:", err.message);
  }
}
run();
