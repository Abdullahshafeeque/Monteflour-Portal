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
  const { data: coupon, error } = await supabase
    .from('coupons')
    .select('*')
    .eq('code', cleanCode)
    .eq('active', true)
    .maybeSingle();

  // TEMPORARY DEBUG: surface the real error instead of hiding it.
  if (error) {
    return NextResponse.json({
      valid: false,
      message: 'DEBUG ERROR: ' + error.message + ' | code: ' + error.code + ' | details: ' + error.details,
    });
  }

  if (!coupon) {
    return NextResponse.json({ valid: false, message: 'DEBUG: connected fine, but no matching row found for code=' + cleanCode });
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