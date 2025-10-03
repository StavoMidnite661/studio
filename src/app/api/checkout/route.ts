
import { NextResponse } from 'next/server';
import crypto from 'crypto';
import { stripeService } from '@/lib/stripe.service';
import { sovrService } from '@/lib/sovr.service';

const {
  EVENTSTORE_BASE,
  EVENTSTORE_API_KEY,
  EVENTSTORE_STREAM_PREFIX = 'orders',
  IDEMPOTENCY_WINDOW_MS = 300000, // 5 minutes
  // HONOR_VAULT_ADDRESS is no longer needed for this contract
} = process.env;


if (!EVENTSTORE_BASE) {
  console.error('Missing EVENTSTORE_BASE in env');
}
if (!process.env.STRIPE_SECRET_KEY) {
  console.error('Missing STRIPE_SECRET_KEY in env');
}

const recentRequests = new Map<string, number>();

function isDuplicate(key: string): boolean {
  const now = Date.now();
  const last = recentRequests.get(key);
  if (last && now - last < Number(IDEMPOTENCY_WINDOW_MS)) {
    return true;
  }
  recentRequests.set(key, now);
  if (recentRequests.size > 10000) {
    const oldestKey = recentRequests.keys().next().value;
    recentRequests.delete(oldestKey);
  }
  return false;
}

async function publishEvent(streamName: string, eventType: string, data: object): Promise<boolean> {
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
        const err = new Error(`EventStore publish failed: ${res.status} ${txt}`);
        (err as any).status = res.status;
        throw err;
    }
    return true;
}

interface CheckoutRequestBody {
    order_id: string;
    amount_usd: number;
    payer: string; // This should be the user's wallet address
    merchant_id: string;
    site_order_id?: string;
    metadata?: object;
    idempotency_key?: string;
}

export async function POST(req: Request) {
    if (!EVENTSTORE_BASE || !process.env.STRIPE_SECRET_KEY) {
      return NextResponse.json({ error: 'Gateway not configured correctly.' }, { status: 500 });
    }

    try {
        const body: CheckoutRequestBody = await req.json();
        const { order_id, amount_usd, payer, merchant_id, site_order_id, metadata } = body;

        if (!order_id || amount_usd === undefined || !payer || !merchant_id) {
            return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
        }

        const idempotency_key = body.idempotency_key || crypto.createHash('sha256').update(JSON.stringify(body)).digest('hex');

        if (isDuplicate(idempotency_key)) {
            return NextResponse.json({ error: 'Duplicate request' }, { status: 409 });
        }

        const stream = `${EVENTSTORE_STREAM_PREFIX}-${order_id}`;

        await publishEvent(stream, 'PaymentInitiated', {
            order_id, amount_usd, payer, merchant_id, idempotency_key, metadata: metadata || {}
        });

        const sovrAmountToBurn = String(amount_usd); // 1:1 for now, a real implementation would use a price feed.

        // 1. Burn POSCR tokens
        try {
            console.log(`Attempting to burn ${sovrAmountToBurn} POSCR from ${payer} for retailer ${merchant_id}`);
            // A real implementation would generate a meaningful compliance hash
            const compliancePlaceholder = crypto.createHash('sha256').update(JSON.stringify({order_id, ts: Date.now()})).digest('hex');
            const burnResult = await sovrService.burnForPOSPurchase(payer, sovrAmountToBurn, merchant_id, `0x${compliancePlaceholder}`);
            console.log('POSCR Burn Result:', burnResult);

            await publishEvent(stream, 'TokensBurned', {
                order_id,
                amount: sovrAmountToBurn,
                payer,
                retailerId: merchant_id,
                transaction_hash: burnResult.txHash,
                compliancePayloadHash: `0x${compliancePlaceholder}`
            });
        } catch(err: any) {
            await publishEvent(stream, 'PaymentFailed', { order_id, reason: `POSCR token burn failed: ${err.message}`, idempotency_key });
            throw err;
        }

        // 2. Create Stripe Payment Intent for USD
        let paymentIntent;
        try {
            console.log(`Creating Stripe Payment Intent for ${amount_usd} USD`);
            paymentIntent = await stripeService.createPaymentIntent(
              amount_usd * 100, // Stripe expects amount in cents
              'usd',
              `Order ${order_id} for ${merchant_id}`,
              { order_id } // Pass order_id in metadata
            );
            console.log('Stripe Payment Intent Created:', paymentIntent.id);
        
            await publishEvent(stream, 'PaymentIntentCreated', {
                order_id,
                payment_intent_id: paymentIntent.id,
                amount_usd: amount_usd,
            });

        } catch (err: any) {
            await publishEvent(stream, 'PaymentFailed', { order_id, reason: `Stripe Payment Intent creation failed: ${err.message}`, idempotency_key });
            throw err;
        }
        
        // 3) Return the client secret to the frontend
        return NextResponse.json({
            ok: true,
            order_id,
            clientSecret: paymentIntent.client_secret
        });

    } catch (err: any) {
        console.error('Checkout error:', err);
        return NextResponse.json({ error: err.message || 'checkout_failed' }, { status: 500 });
    }
}

    