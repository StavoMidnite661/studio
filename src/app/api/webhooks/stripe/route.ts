import { NextResponse } from 'next/server';
import { headers } from 'next/headers';
import Stripe from 'stripe';
import { stripeService } from '@/lib/stripe.service';
import crypto from 'crypto';

const {
  EVENTSTORE_BASE,
  EVENTSTORE_API_KEY,
  EVENTSTORE_STREAM_PREFIX = 'orders',
  STRIPE_WEBHOOK_SECRET
} = process.env;

if (!STRIPE_WEBHOOK_SECRET) {
  console.error("Missing STRIPE_WEBHOOK_SECRET in env");
}

async function publishEvent(streamName: string, eventType: string, data: object): Promise<boolean> {
    if(!EVENTSTORE_BASE) {
        console.error("EVENTSTORE_BASE not set, cannot publish event");
        return false;
    }
    const event = [{
        eventId: crypto.randomUUID(),
        eventType,
        data
    }];
    const url = `${EVENTSTORE_BASE}/streams/${encodeURIComponent(streamName)}`;
    const res = await fetch(url, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/vnd.eventstore.events+json',
            ...(EVENTSTORE_API_KEY ? { 'ES-ApiKey': EVENTSTORE_API_KEY } : {})
        },
        body: JSON.stringify(event)
    });

    if (!res.ok) {
        const txt = await res.text().catch(() => '<no body>');
        console.error(`EventStore publish failed: ${res.status} ${txt}`);
        return false;
    }
    return true;
}


export async function POST(req: Request) {
    if (!STRIPE_WEBHOOK_SECRET) {
      return NextResponse.json({ error: 'Stripe webhook secret not configured.' }, { status: 500 });
    }
    
    const body = await req.text();
    const signature = headers().get('stripe-signature') as string;

    let event: Stripe.Event;

    try {
        event = stripeService.stripe.webhooks.constructEvent(body, signature, STRIPE_WEBHOOK_SECRET);
    } catch (err: any) {
        return NextResponse.json({ error: `Webhook Error: ${err.message}` }, { status: 400 });
    }

    // This metadata would need to be set when creating the PaymentIntent
    const order_id = event.data.object.metadata?.order_id;
    if (!order_id) {
         console.warn("Received Stripe event without order_id in metadata", event.id);
         // Still acknowledge receipt to Stripe
         return NextResponse.json({ received: true });
    }

    const stream = `${EVENTSTORE_STREAM_PREFIX}-${order_id}`;

    switch (event.type) {
        case 'payment_intent.succeeded':
            const paymentIntentSucceeded = event.data.object;
            console.log(`PaymentIntent ${paymentIntentSucceeded.id} for order ${order_id} succeeded!`);
            
            await publishEvent(stream, 'PaymentAuthorized', {
                order_id,
                amount: paymentIntentSucceeded.amount,
                currency: paymentIntentSucceeded.currency,
                settled_at: new Date(paymentIntentSucceeded.created * 1000).toISOString(),
                settlement_reference: paymentIntentSucceeded.id, // Using PI id as ref
            });

            await publishEvent(stream, 'OrderSettled', {
                order_id,
                merchant_receipt: paymentIntentSucceeded.id
            });
            break;

        case 'payment_intent.payment_failed':
            const paymentIntentFailed = event.data.object;
            console.log(`PaymentIntent ${paymentIntentFailed.id} for order ${order_id} failed!`);
            await publishEvent(stream, 'PaymentFailed', {
                order_id,
                reason: 'Stripe payment failed',
                details: paymentIntentFailed.last_payment_error?.message || 'Unknown error',
            });
            break;
            
        default:
            console.log(`Unhandled Stripe event type ${event.type}`);
    }

    return NextResponse.json({ received: true });
}
