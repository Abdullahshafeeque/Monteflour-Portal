// GET /api/admin/invoices/by-order/123
// Admin only. Looks up the invoice for this order and sends you to a
// temporary (2 minute) link to the PDF. The storage bucket is private,
// so the PDF can't be opened without a link made by this route.

import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin, supabaseServerClient } from '@/lib/supabaseServer';
import { isAdmin } from '@/lib/roles';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest, { params }: { params: { orderId: string } }) {
  const authClient = supabaseServerClient();
  const { data: { user } } = await authClient.auth.getUser();
  if (!isAdmin(user)) {
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

  // New invoices store just the file's location. Older ones stored a full public
  // web link, so pull the location out of that if needed.
  const stored: string = invoice.pdf_url;
  const marker = '/object/public/invoices/';
  const filePath = stored.includes(marker)
    ? decodeURIComponent(stored.split(marker)[1])
    : stored;

  const { data: signed, error } = await supabase.storage
    .from('invoices')
    .createSignedUrl(filePath, 120);

  if (error || !signed?.signedUrl) {
    console.error('Could not create invoice link for order', orderId, error?.message);
    return new NextResponse('Could not open this invoice. Please try again.', {
      status: 500,
      headers: { 'Content-Type': 'text/plain' },
    });
  }

  const res = NextResponse.redirect(signed.signedUrl);
  res.headers.set('Cache-Control', 'no-store');
  return res;
}