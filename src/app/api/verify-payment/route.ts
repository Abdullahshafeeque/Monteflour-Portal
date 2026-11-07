import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import { markOrderPaid } from '@/lib/markOrderPaid';

export async function POST(req: NextRequest) {
  const body = await req.json();
  const razorpay_order_id = String(body.razorpay_order_id || '');
  const razorpay_payment_id = String(body.razorpay_payment_id || '');
  const razorpay_signature = String(body.razorpay_signature || '');

  if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature) {
    return NextResponse.json({ success: false, error: 'Missing payment details.' }, { status: 400 });
  }

  // this signature check is what actually proves the payment is genuine
  const expected = crypto
    .createHmac('sha256', process.env.RAZORPAY_KEY_SECRET!)
    .update(`${razorpay_order_id}|${razorpay_payment_id}`)
    .digest('hex');

  if (expected !== razorpay_signature) {
    return NextResponse.json({ success: false, error: 'Payment verification failed.' }, { status: 400 });
  }

  try {
    const result = await markOrderPaid(razorpay_order_id, razorpay_payment_id);

    if (result.status === 'not_found') {
      return NextResponse.json({ success: false, error: 'Order not found.' }, { status: 404 });
    }
    if (result.status === 'amount_mismatch') {
      return NextResponse.json({ success: false, error: 'Payment amount mismatch.' }, { status: 400 });
    }

    return NextResponse.json({ success: true, order_number: result.orderNumber });
  } catch (err) {
    console.error('verify-payment failed:', err);
    return NextResponse.json({ success: false, error: 'Could not record the payment.' }, { status: 500 });
  }
}