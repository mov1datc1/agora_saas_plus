require('dotenv').config({ path: '.env.local' });
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);

async function checkWebhooks() {
  const events = await stripe.events.list({ limit: 5 });
  for (const event of events.data) {
    console.log(`Event: ${event.type}`);
    // Unfortunately, Stripe API doesn't easily expose the webhook delivery success/failure via standard event list, 
    // but we can check if the checkout session was completed.
    if (event.type === 'checkout.session.completed') {
      console.log('Customer Email:', event.data.object.customer_details?.email);
    }
  }
}
checkWebhooks().catch(console.error);
