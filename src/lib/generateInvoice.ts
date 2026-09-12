// src/lib/generateInvoice.ts
//
// Call generateAndStoreInvoice(orderId) once an order's payment_status is
// 'paid'. It's safe to call more than once for the same order — it checks
// for an existing invoice first and returns that instead of making a new one.

import { supabaseAdmin } from "@/lib/supabaseServer";
import { calculateGstInclusive, currentFinancialYear, HSN_CODE } from "@/lib/gst";
import { generateInvoicePdf } from "@/lib/invoice-pdf";

// TODO: fill in PRFM Pvt. Ltd.'s exact registered details
const SELLER = {
  name: "Punathil Roller Flour Mills Pvt. Ltd.",
  address: "PPVI/300, Punathil Roller Flour Mills Pvt Ltd, Kottali Road, Kannur, Kannur, Kerala, 670005",
  gstin: "32AABCP7017J1ZL",
};

const PRODUCT_NAME = process.env.NEXT_PUBLIC_PRODUCT_NAME || "Monteflour";

export async function generateAndStoreInvoice(orderId: number) {
  const supabase = supabaseAdmin();

  // 1. Idempotency check — never allocate a number twice for one order.
  const { data: existing } = await supabase
    .from("invoices")
    .select("id, pdf_url")
    .eq("order_id", orderId)
    .maybeSingle();

  if (existing) {
    return { invoiceId: existing.id, pdfUrl: existing.pdf_url };
  }

  // 2. Fetch the order.
  const { data: order, error } = await supabase
    .from("orders")
    .select("*")
    .eq("id", orderId)
    .single();

  if (error || !order) {
    throw new Error(`Order ${orderId} not found`);
  }

  // 3. Allocate the next sequential invoice number for this GST FY.
  const fy = currentFinancialYear();
  const { data: invoiceNumber, error: numError } = await supabase.rpc(
    "next_invoice_number",
    { fy }
  );
  if (numError || !invoiceNumber) {
    throw new Error("Failed to allocate invoice number");
  }

  // 4. Tax calc — price is GST-inclusive, so tax is pulled out of total_amount.
  const { taxableValue, cgst, sgst, igst } = calculateGstInclusive(
    order.total_amount,
    order.state
  );

  const buyerAddress = [order.address_line1, order.address_line2, order.city, order.state, order.pincode]
    .filter(Boolean)
    .join(", ");

  // 5. Render the PDF.
  const pdfBytes = await generateInvoicePdf({
    invoiceNumber,
    invoiceDate: new Date().toISOString().slice(0, 10),
    sellerName: SELLER.name,
    sellerAddress: SELLER.address,
    sellerGstin: SELLER.gstin,
    buyerName: order.customer_name,
    buyerAddress,
    buyerState: order.state,
    productName: PRODUCT_NAME,
    quantity: order.quantity,
    unitPrice: order.unit_price,
    subtotal: order.subtotal,
    discountAmount: order.discount_amount || 0,
    shippingFee: order.shipping_fee || 0,
    taxableValue,
    cgst,
    sgst,
    igst,
    totalAmount: order.total_amount,
  });

  // 6. Store the PDF in Supabase Storage.
  const filePath = `invoices/${invoiceNumber.replace(/\//g, "-")}.pdf`;
  const { error: uploadError } = await supabase.storage
    .from("invoices")
    .upload(filePath, pdfBytes, { contentType: "application/pdf" });

  if (uploadError) {
    throw new Error(`Failed to store invoice PDF: ${uploadError.message}`);
  }

  const { data: urlData } = supabase.storage.from("invoices").getPublicUrl(filePath);

  // 7. Persist the invoice record — this is what your books/GSTR-1 export reads from.
  const { data: invoice, error: insertError } = await supabase
    .from("invoices")
    .insert({
      order_id: orderId,
      invoice_number: invoiceNumber,
      financial_year: fy,
      customer_name: order.customer_name,
      customer_address: buyerAddress,
      customer_state: order.state,
      taxable_value: taxableValue,
      cgst_amount: cgst,
      sgst_amount: sgst,
      igst_amount: igst,
      total_amount: order.total_amount,
      hsn_code: HSN_CODE,
      pdf_url: urlData.publicUrl,
    })
    .select()
    .single();

  if (insertError) {
    throw new Error(`Failed to save invoice record: ${insertError.message}`);
  }

  return { invoiceId: invoice.id, pdfUrl: invoice.pdf_url };
}