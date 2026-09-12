// src/app/api/admin/invoices/by-order/[orderId]/route.ts
//
// GET /api/admin/invoices/by-order/123
// Looks up the invoice linked to this order and redirects to its stored
// PDF. If no invoice exists yet (order predates this feature, or was a
// Razorpay test-mode payment that got skipped), returns a plain message
// instead of a broken redirect.

import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin, supabaseServerClient } from '@/lib/supabaseServer';

const ADMIN_EMAIL = 'abdshafeeque@gmail.com';

export async function GET(req: NextRequest, { params }: { params: { orderId: string } }) {
  const authClient = supabaseServerClient();
  const { data: { user } } = await authClient.auth.getUser();
  if (!user || user.email !== ADMIN_EMAIL) {
    return NextResponse.json({ message: 'Unauthorized.' }, { status: 401 });
  }

  const orderId = Number(params.orderId);
  if (!orderId) {
    return NextResponse.json({ message: 'Invalid order id.' }, { status: 400 });
  }

  const supabase = supabaseAdmin();
  const { data: invoice } = await supabase
    .from('invoices')
    .select('pdf_url')
    .eq('order_id', orderId)
    .maybeSingle();

  if (!invoice?.pdf_url) {
    return new NextResponse('No invoice has been generated for this order yet.', {
      status: 404,
      headers: { 'Content-Type': 'text/plain' },
    });
  }

  return NextResponse.redirect(invoice.pdf_url);
}