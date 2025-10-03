import { NextResponse } from 'next/server';
import crypto from 'crypto';

const {
  EVENTSTORE_BASE,
  EVENTSTORE_API_KEY,
  EVENTSTORE_STREAM_PREFIX = 'orders',
  FUNDING_SERVICE_URL,
  FUNDING_SERVICE_KEY,
  IDEMPOTENCY_WINDOW_MS = 300000, // 5 minutes
} = process.env;

if (!EVENTSTORE_BASE) {
  console.error('Missing EVENTSTORE_BASE in env');
  // In a real app, this should prevent startup, but for API routes, we check at runtime.
}

// Basic in-memory idempotency guard.
// NOTE: This is not suitable for production serverless environments as each invocation
// can be a separate instance. Use a distributed cache like Redis for production.
const recentRequests = new Map<string, number>();

function isDuplicate(key: string): boolean {
  const now = Date.now();
  const last = recentRequests.get(key);
  if (last && now - last < Number(IDEMPOTENCY_WINDOW_MS)) {
    return true;
  }
  recentRequests.set(key, now);
  // Simple cleanup to prevent memory leaks in a long-running process.
  if (recentRequests.size > 10000) {
    const oldestKey = recentRequests.keys().next().value;
    recentRequests.delete(oldestKey);
  }
  return false;
}

// Helper to publish to EventStore
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

// Optional: call funding service to verify SOVR backing
async function verifyFunding(orderId: string, amountUsd: number, payer: string, idempotencyKey: string): Promise<any> {
    if (!FUNDING_SERVICE_URL) {
        return { ok: true, note: 'no funding service configured' };
    }
    const resp = await fetch(`${FUNDING_SERVICE_URL.replace(/\/$/, '')}/verify`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            ...(FUNDING_SERVICE_KEY ? { 'Authorization': `Bearer ${FUNDING_SERVICE_KEY}` } : {})
        },
        body: JSON.stringify({ order_id: orderId, amount_usd: amountUsd, payer, idempotency_key: idempotencyKey })
    });

    if (!resp.ok) {
        const txt = await resp.text().catch(() => '<no body>');
        throw new Error(`Funding verification failed: ${resp.status} ${txt}`);
    }
    const payload = await resp.json();
    // expected payload: { ok: true, settlement_reference: "...", usd_equivalent_rate: 1.0 }
    return payload;
}

interface CheckoutRequestBody {
    order_id: string;
    amount_usd: number;
    payer: string;
    merchant_id: string;
    site_order_id?: string;
    metadata?: object;
    idempotency_key?: string;
}

export async function POST(req: Request) {
    if (!EVENTSTORE_BASE) {
      return NextResponse.json({ error: 'Gateway not configured: EVENTSTORE_BASE is missing.' }, { status: 500 });
    }

    try {
        const body: CheckoutRequestBody = await req.json();
        const { order_id, amount_usd, payer, merchant_id, site_order_id, metadata } = body;

        if (!order_id || amount_usd === undefined || !payer || !merchant_id) {
            return NextResponse.json({ error: 'Missing required fields: order_id, amount_usd, payer, merchant_id' }, { status: 400 });
        }

        const idempotency_key = body.idempotency_key || crypto.createHash('sha256').update(String(order_id) + String(amount_usd) + String(payer)).digest('hex');

        if (isDuplicate(idempotency_key)) {
            return NextResponse.json({ error: 'Duplicate request (idempotency)', idempotency_key }, { status: 409 });
        }

        const stream = `${EVENTSTORE_STREAM_PREFIX}-${order_id}`;

        // 1) Publish PaymentInitiated
        await publishEvent(stream, 'PaymentInitiated', {
            order_id, amount_usd, payer, merchant_id, idempotency_key, metadata: metadata || {}
        });

        // 2) Verify funding
        let fundingResp;
        try {
            fundingResp = await verifyFunding(order_id, amount_usd, payer, idempotency_key);
        } catch (err: any) {
            await publishEvent(stream, 'PaymentFailed', { order_id, reason: err.message, idempotency_key });
            throw err;
        }

        const settlement_reference = fundingResp.settlement_reference || crypto.randomUUID();
        const usd_equivalent_rate = fundingResp.usd_equivalent_rate || 1.0;

        // 3) Publish PaymentAuthorized
        await publishEvent(stream, 'PaymentAuthorized', {
            order_id,
            amount_usd,
            usd_equivalent_rate,
            settled_at: new Date().toISOString(),
            settlement_reference
        });

        // 4) Publish OrderSettled
        await publishEvent(stream, 'OrderSettled', {
            order_id,
            site_order_id: site_order_id || null,
            merchant_receipt: settlement_reference
        });
        
        // 5) Return success
        return NextResponse.json({
            ok: true,
            order_id,
            amount_usd,
            settlement_reference,
            usd_equivalent_rate,
            note: fundingResp.note || null
        });

    } catch (err: any) {
        console.error('Checkout error:', err);
        return NextResponse.json({ error: err.message || 'checkout_failed' }, { status: 500 });
    }
}
