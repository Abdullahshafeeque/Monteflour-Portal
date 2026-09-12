// GST helpers for Monteflour invoicing.
// Product is branded, pre-packaged multigrain flour -> HSN 1101, 5% GST
// (post-22-Sep-2025 slab reform). Re-verify if your product mix changes.
//
// IMPORTANT: your checkout price is GST-INCLUSIVE (confirmed) — so tax is
// extracted from the amount actually paid, not added on top.

export const HSN_CODE = "1101";
export const GST_RATE = 0.05;

// PRFM Pvt. Ltd.'s GST registration state. Change if this isn't Kerala.
export const SELLER_STATE = "Kerala";
export const SELLER_STATE_CODE = "32";

// Maps the exact state name strings used in your checkout page's
// INDIAN_STATES list to their official GST state codes.
export const STATE_GST_CODES: Record<string, string> = {
  "Jammu and Kashmir": "01",
  "Himachal Pradesh": "02",
  Punjab: "03",
  Chandigarh: "04",
  Uttarakhand: "05",
  Haryana: "06",
  Delhi: "07",
  Rajasthan: "08",
  "Uttar Pradesh": "09",
  Bihar: "10",
  Sikkim: "11",
  "Arunachal Pradesh": "12",
  Nagaland: "13",
  Manipur: "14",
  Mizoram: "15",
  Tripura: "16",
  Meghalaya: "17",
  Assam: "18",
  "West Bengal": "19",
  Jharkhand: "20",
  Odisha: "21",
  Chhattisgarh: "22",
  "Madhya Pradesh": "23",
  Gujarat: "24",
  "Dadra and Nagar Haveli and Daman and Diu": "26",
  Maharashtra: "27",
  Karnataka: "29",
  Goa: "30",
  Lakshadweep: "31",
  Kerala: "32",
  "Tamil Nadu": "33",
  Puducherry: "34",
  "Andaman and Nicobar Islands": "35",
  Telangana: "36",
  "Andhra Pradesh": "37",
  Ladakh: "38",
};

export interface GstBreakup {
  taxableValue: number;
  cgst: number;
  sgst: number;
  igst: number;
  totalTax: number;
}

/**
 * `totalPaid` is GST-inclusive (matches your checkout's total_amount).
 * Extracts the taxable value and splits the tax into CGST+SGST (same-state
 * sale) or IGST (inter-state sale), based on the customer's state name.
 */
export function calculateGstInclusive(totalPaid: number, buyerState: string): GstBreakup {
  const taxableValue = round2(totalPaid / (1 + GST_RATE));
  const totalTax = round2(totalPaid - taxableValue);

  const buyerCode = STATE_GST_CODES[buyerState];
  const isIntraState = buyerCode === SELLER_STATE_CODE;

  if (isIntraState) {
    const half = round2(totalTax / 2);
    return { taxableValue, cgst: half, sgst: half, igst: 0, totalTax };
  }
  return { taxableValue, cgst: 0, sgst: 0, igst: totalTax, totalTax };
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

/**
 * GST financial year runs Apr 1 - Mar 31, formatted "25-26" style,
 * matching the FY key used by next_invoice_number() in Postgres.
 */
export function currentFinancialYear(date: Date = new Date()): string {
  const year = date.getFullYear();
  const isBeforeApril = date.getMonth() < 3; // Jan(0)-Mar(2)
  const startYear = isBeforeApril ? year - 1 : year;
  const shortStart = String(startYear).slice(-2);
  const shortEnd = String(startYear + 1).slice(-2);
  return `${shortStart}-${shortEnd}`;
}