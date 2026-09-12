// src/app/api/admin/export-invoices/route.ts
//
// GET /api/admin/export-invoices?from=2026-09-01&to=2026-09-30
// Downloads a CSV of every invoice in that date range, ready to hand to
// your accountant for import into Tally.

import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin, supabaseServerClient } from '@/lib/supabaseServer';

const ADMIN_EMAIL = 'abdshafeeque@gmail.com';
const PRODUCT_NAME = process.env.NEXT_PUBLIC_PRODUCT_NAME || 'Monteflour';

export async function GET(req: NextRequest) {
  // Same auth check used by the other protected /api/admin/* routes.
  const authClient = supabaseServerClient();
  const { data: { user } } = await authClient.auth.getUser();
  if (!user || user.email !== ADMIN_EMAIL) {
    return NextResponse.json({ message: 'Unauthorized.' }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const from = searchParams.get('from');
  const to = searchParams.get('to');

  if (!from || !to) {
    return NextResponse.json({ message: 'Both from and to dates are required (YYYY-MM-DD).' }, { status: 400 });
  }

  const supabase = supabaseAdmin();

  // orders(quantity, unit_price) pulls those two columns from the linked
  // order via the order_id foreign key — no separate query needed.
  const { data: invoices, error } = await supabase
    .from('invoices')
    .select('*, orders(quantity, unit_price)')
    .gte('invoice_date', from)
    .lte('invoice_date', to)
    .order('invoice_number', { ascending: true });

  if (error) {
    return NextResponse.json({ message: error.message }, { status: 500 });
  }

  const header = [
    'Date',
    'Invoice No',
    'Party Name',
    'Party Address',
    'Party State',
    'Party GSTIN',
    'Item Name',
    'HSN/SAC',
    'Quantity',
    'Rate',
    'Taxable Value',
    'CGST Amount',
    'SGST Amount',
    'IGST Amount',
    'Total Amount',
  ];

  const rows = (invoices || []).map((inv: any) => [
    formatDateDDMMYYYY(inv.invoice_date),
    inv.invoice_number,
    inv.customer_name,
    inv.customer_address,
    inv.customer_state,
    '', // B2C — no customer GSTIN captured at checkout
    PRODUCT_NAME,
    inv.hsn_code,
    inv.orders?.quantity ?? '',
    inv.orders?.unit_price ?? '',
    inv.taxable_value,
    inv.cgst_amount,
    inv.sgst_amount,
    inv.igst_amount,
    inv.total_amount,
  ]);

  const csv = [header, ...rows].map((row) => row.map(csvEscape).join(',')).join('\r\n');

  return new NextResponse(csv, {
    status: 200,
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="monteflour-invoices_${from}_to_${to}.csv"`,
    },
  });
}

function csvEscape(value: unknown): string {
  const str = String(value ?? '');
  // Quote any field containing a comma, quote, or newline; double up internal quotes.
  if (/[",\n]/.test(str)) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

function formatDateDDMMYYYY(isoDate: string): string {
  const [year, month, day] = isoDate.split('-');
  return `${day}-${month}-${year}`;
}