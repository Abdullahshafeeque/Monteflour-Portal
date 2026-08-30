import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseServer';

function genOrderNumber() {
  const ymd = new Date().toISOString().slice(2, 10).replace(/-/g, '');
  const rand = Math.random().toString(16).slice(2, 7).toUpperCase();
  return `MF${ymd}${rand}`;
}

export async function POST(req: NextRequest) {
  const body = await req.json();

  const name = String(body.name || '').trim();
  const phone = String(body.phone || '').trim();
  const email = String(body.email || '').trim();
  const address1 = String(body.address1 || '').trim();
  const address2 = String(body.address2 || '').trim();
  const city = String(body.city || '').trim();
  const state = String(body.state || '').trim();
  const pincode = String(body.pincode || '').trim();
  const quantity = Math.max(1, parseInt(body.quantity) || 1);
  const couponCode = String(body.coupon_code || '').trim().toUpperCase();

  if (!name || !phone || !email || !address1 || !city || !state || !pincode) {
    return NextResponse.json({ error: 'Please fill in all required fields.' }, { status: 400 });
  }
  if (!/^[6-9]\d{9}$/.test(phone)) {
    return NextResponse.json({ error: 'Enter a valid 10-digit Indian phone number.' }, { status: 400 });
  }
  if (!/^\S+@\S+\.\S+$/.test(email)) {
    return NextResponse.json({ error: 'Enter a valid email address.' }, { status: 400 });
  }
  if (!/^\d{6}$/.test(pincode)) {
    return NextResponse.json({ error: 'Enter a valid 6-digit pincode.' }, { status: 400 });
  }

  const supabase = supabaseAdmin();

  // ---- recompute pricing server-side. never trust numbers sent from the browser ----
  const unitPrice = Number(process.env.NEXT_PUBLIC_PRODUCT_PRICE || 0);
  const subtotal = unitPrice * quantity;

  let discount = 0;
  let appliedCouponCode: string | null = null;

  if (couponCode) {
    const { data: coupon } = await supabase
      .from('coupons')
      .select('*')
      .eq('code', couponCode)
      .eq('active', true)
      .maybeSingle();

    const today = new Date(new Date().toDateString());
    if (
      coupon &&
      (!coupon.expires_at || new Date(coupon.expires_at) >= today) &&
      (coupon.max_uses === null || coupon.used_count < coupon.max_uses) &&
      subtotal >= Number(coupon.min_order_amount)
    ) {
      const rawDiscount = coupon.discount_type === 'percent'
        ? Math.round(((subtotal * Number(coupon.discount_value)) / 100) * 100) / 100
        : Number(coupon.discount_value);
      discount = Math.min(rawDiscount, subtotal);
      appliedCouponCode = coupon.code;
    }
  }

  const freeShippingAbove = Number(process.env.NEXT_PUBLIC_FREE_SHIPPING_ABOVE || 0);
  const shippingFee = Number(process.env.NEXT_PUBLIC_SHIPPING_FEE || 0);
  const shipping = (freeShippingAbove > 0 && subtotal - discount >= freeShippingAbove) ? 0 : shippingFee;
  const total = Math.round((subtotal - discount + shipping) * 100) / 100;

  if (total <= 0) {
    return NextResponse.json({ error: 'Invalid order total.' }, { status: 400 });
  }

  const orderNumber = genOrderNumber();
  const amountPaise = Math.round(total * 100);

  // ---- create the order on Razorpay's side (server-to-server; secret key never reaches the browser) ----
  const auth = Buffer.from(`${process.env.RAZORPAY_KEY_ID}:${process.env.RAZORPAY_KEY_SECRET}`).toString('base64');
  const rpRes = await fetch('https://api.razorpay.com/v1/orders', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Basic ${auth}` },
    body: JSON.stringify({
      amount: amountPaise,
      currency: 'INR',
      receipt: orderNumber,
      notes: { customer_name: name, phone },
    }),
  });

  if (!rpRes.ok) {
    return NextResponse.json(
      { error: 'Could not reach the payment gateway. Check your Razorpay keys in the environment variables.' },
      { status: 502 }
    );
  }
  const rpOrder = await rpRes.json();

  const { error: insertError } = await supabase.from('orders').insert({
    order_number: orderNumber,
    customer_name: name,
    phone,
    email,
    address_line1: address1,
    address_line2: address2 || null,
    city,
    state,
    pincode,
    quantity,
    unit_price: unitPrice,
    subtotal,
    coupon_code: appliedCouponCode,
    discount_amount: discount,
    shipping_fee: shipping,
    total_amount: total,
    razorpay_order_id: rpOrder.id,
    payment_status: 'pending',
  });

  if (insertError) {
    return NextResponse.json({ error: 'Could not save the order. Please try again.' }, { status: 500 });
  }

  return NextResponse.json({
    razorpay_order_id: rpOrder.id,
    amount: amountPaise,
    currency: 'INR',
    key_id: process.env.RAZORPAY_KEY_ID,
    name,
    email,
    phone,
  });
}
