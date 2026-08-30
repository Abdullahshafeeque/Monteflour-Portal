import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseServer';

export async function POST(req: NextRequest) {
  const body = await req.json();
  const cleanCode = String(body.code || '').trim().toUpperCase();
  const sub = Number(body.subtotal) || 0;

  if (!cleanCode) {
    return NextResponse.json({ valid: false, message: 'Enter a coupon code.' });
  }

  const supabase = supabaseAdmin();
  const { data: coupon } = await supabase
    .from('coupons')
    .select('*')
    .eq('code', cleanCode)
    .eq('active', true)
    .maybeSingle();

  if (!coupon) {
    return NextResponse.json({ valid: false, message: 'Invalid or inactive coupon code.' });
  }
  const today = new Date(new Date().toDateString());
  if (coupon.expires_at && new Date(coupon.expires_at) < today) {
    return NextResponse.json({ valid: false, message: 'This coupon has expired.' });
  }
  if (coupon.max_uses !== null && coupon.used_count >= coupon.max_uses) {
    return NextResponse.json({ valid: false, message: 'This coupon has reached its usage limit.' });
  }
  if (sub < Number(coupon.min_order_amount)) {
    return NextResponse.json({
      valid: false,
      message: `Minimum order for this coupon is ₹${Number(coupon.min_order_amount).toFixed(0)}.`,
    });
  }

  const rawDiscount = coupon.discount_type === 'percent'
    ? Math.round(((sub * Number(coupon.discount_value)) / 100) * 100) / 100
    : Number(coupon.discount_value);
  const discount_amount = Math.min(rawDiscount, sub);

  return NextResponse.json({
    valid: true,
    code: coupon.code,
    discount_amount,
    message: 'Coupon applied!',
  });
}
