import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import { markOrderPaid } from '@/lib/markOrderPaid';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  const secret = process.env.RAZORPAY_WEBHOOK_SECRET;
  if (!secret) {
    console.error('RAZORPAY_WEBHOOK_SECRET is not set');
    return NextResponse.json({ error: 'Webhook not configured.' }, { status: 500 });
  }

  // The signature is calculated on the EXACT raw text Razorpay sent,
  // so we must read it as text first, before turning it into JSON.
  const rawBody = await req.text();
  const signature = req.headers.get('x-razorpay-signature') || '';

  const expected = crypto.createHmac('sha256', secret).update(rawBody).digest('hex');
  const a = Buffer.from(expected);
  const b = Buffer.from(signature);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) {
    return NextResponse.json({ error: 'Invalid signature.' }, { status: 400 });
  }

  let event: any;
  try {
    event = JSON.parse(rawBody);
  } catch {
    return NextResponse.json({ error: 'Bad payload.' }, { status: 400 });
  }

  // We only care about "payment succeeded" events. Anything else: say OK and ignore.
  if (event.event !== 'payment.captured' && event.event !== 'order.paid') {
    return NextResponse.json({ ok: true, ignored: true });
  }

  const payment = event.payload?.payment?.entity;
  const razorpayOrderId = payment?.order_id || event.payload?.order?.entity?.id;
  const razorpayPaymentId = payment?.id;

  if (!razorpayOrderId || !razorpayPaymentId) {
    return NextResponse.json({ ok: true, ignored: true });
  }

  try {
    const result = await markOrderPaid(
      razorpayOrderId,
      razorpayPaymentId,
      typeof payment?.amount === 'number' ? payment.amount : undefined
    );
    console.log(`Razorpay webhook (${event.event}) -> ${result.status} for ${razorpayOrderId}`);
    return NextResponse.json({ ok: true, result: result.status });
  } catch (err) {
    // A 500 tells Razorpay to try again later, so a temporary database
    // problem doesn't lose the payment.
    console.error('Razorpay webhook processing failed:', err);
    return NextResponse.json({ error: 'Processing failed.' }, { status: 500 });
  }
}