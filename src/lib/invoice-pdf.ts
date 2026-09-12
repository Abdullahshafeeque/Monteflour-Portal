// npm install pdf-lib
import { PDFDocument, StandardFonts, rgb, PDFFont } from "pdf-lib";

export interface InvoiceData {
  invoiceNumber: string;
  invoiceDate: string;
  sellerName: string;
  sellerAddress: string;
  sellerGstin: string;
  buyerName: string;
  buyerAddress: string;
  buyerState: string;
  productName: string;
  quantity: number;
  unitPrice: number;
  subtotal: number;
  discountAmount: number;
  shippingFee: number;
  taxableValue: number;
  cgst: number;
  sgst: number;
  igst: number;
  totalAmount: number;
}

export async function generateInvoicePdf(data: InvoiceData): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  const page = doc.addPage([595, 842]); // A4
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const bold = await doc.embedFont(StandardFonts.HelveticaBold);

  let y = 800;
  const left = 40;

  const draw = (text: string, x: number, size = 10, f: PDFFont = font) => {
    page.drawText(text, { x, y, size, font: f, color: rgb(0, 0, 0) });
  };
  const newLine = (gap = 14) => (y -= gap);

  draw(data.sellerName, left, 14, bold); newLine(16);
  draw(data.sellerAddress, left, 9); newLine(12);
  draw(`GSTIN: ${data.sellerGstin}`, left, 9); newLine(24);

  draw("TAX INVOICE", left, 12, bold); newLine(18);
  draw(`Invoice No: ${data.invoiceNumber}`, left, 10);
  draw(`Date: ${data.invoiceDate}`, 380, 10);
  newLine(16);
  draw(`Place of Supply: ${data.buyerState}`, left, 10); newLine(20);

  draw("Bill To:", left, 10, bold); newLine(14);
  draw(data.buyerName, left, 10); newLine(12);
  draw(data.buyerAddress, left, 9); newLine(24);

  // Line item table
  draw("Description", left, 9, bold);
  draw("HSN", 260, 9, bold);
  draw("Qty", 310, 9, bold);
  draw("Rate", 360, 9, bold);
  draw("Amount", 450, 9, bold);
  newLine(14);

  draw(data.productName, left, 9);
  draw("1101", 260, 9);
  draw(String(data.quantity), 310, 9);
  draw(data.unitPrice.toFixed(2), 360, 9);
  draw(data.subtotal.toFixed(2), 450, 9);
  newLine(20);

  if (data.discountAmount > 0) {
    draw("Discount", 350, 9);
    draw(`- Rs ${data.discountAmount.toFixed(2)}`, 460, 9);
    newLine(12);
  }
  if (data.shippingFee > 0) {
    draw("Shipping", 350, 9);
    draw(`Rs ${data.shippingFee.toFixed(2)}`, 460, 9);
    newLine(12);
  }
  newLine(6);

  draw("Taxable Value:", 350, 9);
  draw(`Rs ${data.taxableValue.toFixed(2)}`, 470, 9);
  newLine(12);

  if (data.cgst > 0) {
    draw("CGST (2.5%):", 350, 9);
    draw(`Rs ${data.cgst.toFixed(2)}`, 470, 9);
    newLine(12);
  }
  if (data.sgst > 0) {
    draw("SGST (2.5%):", 350, 9);
    draw(`Rs ${data.sgst.toFixed(2)}`, 470, 9);
    newLine(12);
  }
  if (data.igst > 0) {
    draw("IGST (5%):", 350, 9);
    draw(`Rs ${data.igst.toFixed(2)}`, 470, 9);
    newLine(12);
  }

  draw("Total (tax incl.):", 350, 11, bold);
  draw(`Rs ${data.totalAmount.toFixed(2)}`, 460, 11, bold);
  newLine(24);

  draw("This is a computer-generated invoice and does not require a signature.", left, 8);

  return doc.save();
}