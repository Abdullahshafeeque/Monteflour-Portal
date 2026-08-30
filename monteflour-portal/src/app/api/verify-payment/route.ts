import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import { supabaseAdmin } from '@/lib/supabaseServer';

export async function POST(req: NextRequest) {
  const body = await req.json();
  const razorpay_order_id = String(body.razorpay_order_id || '');
  const razorpay_payment_id = String(body.razorpay_payment_id || '');
  const razorpay_signature = String(body.razorpay_signature || '');

  if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature) {
    return NextResponse.json({ success: false, error: 'Missing payment details.' }, { status: 400 });
  }

  // ---- this signature check is what actually proves the payment is genuine ----
  const expected = crypto
    .createHmac('sha256', process.env.RAZORPAY_KEY_SECRET!)
    .update(`${razorpay_order_id}|${razorpay_payment_id}`)
    .digest('hex');

  if (expected !== razorpay_signature) {
    return NextResponse.json({ success: false, error: 'Payment verification failed.' }, { status: 400 });
  }

  const supabase = supabaseAdmin();

  const { data: order } = await supabase
    .from('orders')
    .update({ payment_status: 'paid', razorpay_payment_id })
    .eq('razorpay_order_id', razorpay_order_id)
    .select('order_number, coupon_code')
    .maybeSingle();

  if (order?.coupon_code) {
    const { data: coupon } = await supabase
      .from('coupons')
      .select('used_count')
      .eq('code', order.coupon_code)
      .maybeSingle();
    if (coupon) {
      await supabase
        .from('coupons')
        .update({ used_count: coupon.used_count + 1 })
        .eq('code', order.coupon_code);
    }
  }

  return NextResponse.json({ success: true, order_number: order?.order_number || null });
}
