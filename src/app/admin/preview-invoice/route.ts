// src/app/api/admin/preview-invoice/route.ts
//
// GET /api/admin/preview-invoice
// Renders one sample invoice PDF using made-up data. Doesn't touch the
// orders/invoices tables, doesn't call next_invoice_number(), so it can't
// create a gap in your real invoice sequence — safe to open as many times
// as you like.

import { NextRequest, NextResponse } from 'next/server';
import { supabaseServerClient } from '@/lib/supabaseServer';
import { calculateGstInclusive } from '@/lib/gst';
import { generateInvoicePdf } from '@/lib/invoice-pdf';

const ADMIN_EMAIL = 'abdshafeeque@gmail.com';

// TODO: keep these in sync with the real values in generateInvoice.ts
const SELLER = {
  name: 'Punathil Roller Flour Mills Pvt. Ltd.',
  address: 'REPLACE_WITH_REGISTERED_ADDRESS, Kannur, Kerala - PIN',
  gstin: 'REPLACE_WITH_GSTIN',
};

const PRODUCT_NAME = process.env.NEXT_PUBLIC_PRODUCT_NAME || 'Monteflour';
const UNIT_PRICE = Number(process.env.NEXT_PUBLIC_PRODUCT_PRICE || 500);

export async function GET(req: NextRequest) {
  const authClient = supabaseServerClient();
  const { data: { user } } = await authClient.auth.getUser();
  if (!user || user.email !== ADMIN_EMAIL) {
    return NextResponse.json({ message: 'Unauthorized.' }, { status: 401 });
  }

  // Change ?state=Maharashtra in the URL to preview an inter-state (IGST) invoice.
  const buyerState = req.nextUrl.searchParams.get('state') || 'Kerala';

  const quantity = 2;
  const subtotal = UNIT_PRICE * quantity;
  const discountAmount = 0;
  const shippingFee = 90;
  const totalAmount = subtotal - discountAmount + shippingFee;

  const { taxableValue, cgst, sgst, igst } = calculateGstInclusive(totalAmount, buyerState);

  const pdfBytes = await generateInvoicePdf({
    invoiceNumber: 'SAMPLE/PREVIEW',
    invoiceDate: new Date().toISOString().slice(0, 10),
    sellerName: SELLER.name,
    sellerAddress: SELLER.address,
    sellerGstin: SELLER.gstin,
    buyerName: 'Test Customer',
    buyerAddress: '123 Sample Street, Sample City, ' + buyerState + ', 682001',
    buyerState,
    productName: PRODUCT_NAME,
    quantity,
    unitPrice: UNIT_PRICE,
    subtotal,
    discountAmount,
    shippingFee,
    taxableValue,
    cgst,
    sgst,
    igst,
    totalAmount,
  });

  return new NextResponse(Buffer.from(pdfBytes), {
    status: 200,
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': 'inline; filename="sample-invoice.pdf"',
    },
  });
}