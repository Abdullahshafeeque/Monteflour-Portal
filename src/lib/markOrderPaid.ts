import { supabaseAdmin } from '@/lib/supabaseServer';
import { generateAndStoreInvoice } from '@/lib/generateInvoice';

type MarkPaidResult =
  | { status: 'paid_now'; orderNumber: string }
  | { status: 'already_paid'; orderNumber: string }
  | { status: 'not_found' }
  | { status: 'amount_mismatch' };

// Safe to call many times for the same payment. Only the FIRST call actually
// changes the order, counts the coupon and makes the invoice.
export async function markOrderPaid(
  razorpayOrderId: string,
  razorpayPaymentId: string,
  paidAmountPaise?: number
): Promise<MarkPaidResult> {
  const supabase = supabaseAdmin();

  const { data: order, error } = await supabase
    .from('orders')
    .select('id, order_number, coupon_code, payment_status, total_amount')
    .eq('razorpay_order_id', razorpayOrderId)
    .maybeSingle();

  if (error) throw new Error(error.message);
  if (!order) return { status: 'not_found' };
  if (order.payment_status === 'paid') {
    return { status: 'already_paid', orderNumber: order.order_number };
  }

  // Safety check: the amount Razorpay received must match what we expected.
  if (
    paidAmountPaise !== undefined &&
    Math.round(Number(order.total_amount) * 100) !== paidAmountPaise
  ) {
    console.error(
      `Amount mismatch for order ${order.order_number}: expected ${Math.round(Number(order.total_amount) * 100)} paise, Razorpay says ${paidAmountPaise}`
    );
    return { status: 'amount_mismatch' };
  }

  const update: Record<string, any> = {
    payment_status: 'paid',
    razorpay_payment_id: razorpayPaymentId,
  };
  // If the dashboard cleanup had wrongly marked this order failed + cancelled,
  // bring it back to a normal new order.
  if (order.payment_status === 'failed') update.fulfillment_status = 'new';

  // ".neq('payment_status','paid')" means: only change it if nobody else
  // has already marked it paid a split second ago.
  const { data: updated, error: updateError } = await supabase
    .from('orders')
    .update(update)
    .eq('id', order.id)
    .neq('payment_status', 'paid')
    .select('id')
    .maybeSingle();

  if (updateError) throw new Error(updateError.message);
  if (!updated) return { status: 'already_paid', orderNumber: order.order_number };

  // From here on, only the one call that really flipped the order runs.
  if (order.coupon_code) {
    const { data: coupon } = await supabase
      .from('coupons')
      .select('used_count')
      .eq('code', order.coupon_code)
      .maybeSingle();
    if (coupon) {
      await supabase
        .from('coupons')
        .update({ used_count: coupon.used_count + 1 })
        .eq('code', order.coupon_code);
    }
  }

  try {
    await generateAndStoreInvoice(order.id);
  } catch (err) {
    // Don't fail the payment just because the invoice failed.
    console.error('Invoice generation failed for order', order.id, err);
  }

  return { status: 'paid_now', orderNumber: order.order_number };
}