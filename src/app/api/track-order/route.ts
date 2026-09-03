import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseServer';

export async function POST(req: NextRequest) {
  const body = await req.json();
  const query = String(body.query || '').trim();

  if (!query) {
    return NextResponse.json({ error: 'Enter your order number or phone number.' }, { status: 400 });
  }

  const supabase = supabaseAdmin();
  const isPhone = /^[6-9]\d{9}$/.test(query);

  // Only return what a customer needs to see their own order status —
  // never the full address, email, or exact phone, even though this
  // lookup itself is unauthenticated.
  const columns =
    'order_number, quantity, total_amount, payment_status, fulfillment_status, city, state, created_at, packed_at, shipped_at, delivered_at';

  let ordersQuery = supabase.from('orders').select(columns);
  ordersQuery = isPhone
    ? ordersQuery.eq('phone', query)
    : ordersQuery.eq('order_number', query.toUpperCase());

  const { data: orders, error } = await ordersQuery
    .order('created_at', { ascending: false })
    .limit(20);

  if (error) {
    return NextResponse.json({ error: 'Something went wrong. Please try again.' }, { status: 500 });
  }

  if (!orders || orders.length === 0) {
    return NextResponse.json(
      { error: "We couldn't find an order matching that. Double-check your order number or phone number." },
      { status: 404 }
    );
  }

  return NextResponse.json({ orders });
}