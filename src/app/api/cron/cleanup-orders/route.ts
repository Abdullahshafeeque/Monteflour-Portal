import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseServer';
import { markOrderPaid } from '@/lib/markOrderPaid';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

export async function GET(req: NextRequest) {
  // Only Vercel's scheduler (which knows CRON_SECRET) is allowed in.
  const secret = process.env.CRON_SECRET;
  if (!secret || req.headers.get('authorization') !== `Bearer ${secret}`) {
    return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 });
  }

  const supabase = supabaseAdmin();
  const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();

  // Pending orders older than 1 hour. Newer ones may still be mid-payment.
  const { data: stale, error } = await supabase
    .from('orders')
    .select('id, order_number, razorpay_order_id')
    .eq('payment_status', 'pending')
    .lt('created_at', oneHourAgo)
    .order('created_at', { ascending: true })
    .limit(200);

  if (error) {
    console.error('Cleanup: could not load pending orders:', error.message);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const auth = Buffer.from(
    `${process.env.RAZORPAY_KEY_ID}:${process.env.RAZORPAY_KEY_SECRET}`
  ).toString('base64');

  // Marks an order failed + cancelled, but only if it is still pending.
  async function markFailed(id: number) {
    await supabase
      .from('orders')
      .update({ payment_status: 'failed', fulfillment_status: 'cancelled' })
      .eq('id', id)
      .eq('payment_status', 'pending');
  }

  let recovered = 0;
  let markedFailed = 0;
  let skipped = 0;

  for (const order of stale || []) {
    if (!order.razorpay_order_id) {
      await markFailed(order.id);
      markedFailed++;
      continue;
    }

    // Ask Razorpay what really happened to this order.
    let rpRes: Response;
    try {
      rpRes = await fetch(
        `https://api.razorpay.com/v1/orders/${order.razorpay_order_id}/payments`,
        { headers: { Authorization: `Basic ${auth}` } }
      );
    } catch {
      skipped++; // network problem: leave it pending, try again tomorrow
      continue;
    }

    // 400/404 = Razorpay has no such order in this mode (e.g. an old test order
    // after switching to live keys), so there is no payment to wait for.
    if (rpRes.status === 400 || rpRes.status === 404) {
      await markFailed(order.id);
      markedFailed++;
      continue;
    }
    if (!rpRes.ok) {
      skipped++; // any other Razorpay problem: leave it alone
      continue;
    }

    const body = await rpRes.json();
    const payments: any[] = body.items || [];

    // Money was actually collected: the webhook must have been missed. Fix it.
    const captured = payments.find((p) => p.status === 'captured');
    if (captured) {
      try {
        await markOrderPaid(order.razorpay_order_id, captured.id, captured.amount);
        recovered++;
      } catch (err) {
        console.error('Cleanup: could not mark paid', order.order_number, err);
        skipped++;
      }
      continue;
    }

    // Payment is held but not collected yet: don't cancel it.
    if (payments.some((p) => p.status === 'authorized')) {
      skipped++;
      continue;
    }

    // No payment at all: the customer abandoned checkout.
    await markFailed(order.id);
    markedFailed++;
  }

  // Housekeeping: forget rate-limit counters older than a day.
  await supabase
    .from('rate_limits')
    .delete()
    .lt('window_start', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString());

  const summary = { checked: (stale || []).length, recovered, markedFailed, skipped };
  console.log('Cleanup finished:', JSON.stringify(summary));
  return NextResponse.json({ ok: true, ...summary });
}