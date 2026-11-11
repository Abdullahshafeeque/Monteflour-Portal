'use server';
import { revalidatePath } from 'next/cache';
import { supabaseAdmin } from '@/lib/supabaseServer';
import { getAdminUser } from '@/lib/requireAdmin';

const VALID_STATUSES = ['new', 'packed', 'shipped', 'delivered', 'cancelled'];

export async function updateFulfillmentStatus(orderId: number, status: string) {
  if (!(await getAdminUser())) return { error: 'Unauthorized' };
  if (!VALID_STATUSES.includes(status)) return { error: 'Invalid status' };

  const supabase = supabaseAdmin();
  const update: Record<string, any> = { fulfillment_status: status };

  if (status === 'packed') update.packed_at = new Date().toISOString();
  if (status === 'shipped') update.shipped_at = new Date().toISOString();
  if (status === 'delivered') update.delivered_at = new Date().toISOString();

  const { error } = await supabase.from('orders').update(update).eq('id', orderId);
  if (error) return { error: error.message };

  revalidatePath('/admin/dashboard');
  return { error: null };
}

export async function updateTracking(orderId: number, courier: string, trackingNumber: string) {
  if (!(await getAdminUser())) return { error: 'Unauthorized' };

  const supabase = supabaseAdmin();
  const update: Record<string, any> = {
    courier: courier || null,
    tracking_number: trackingNumber || null,
  };

  // A tracking number means the parcel has been handed to the courier, so move
  // the order to "shipped" automatically. Only from new/packed, and only if paid:
  // shipped orders keep their original shipped time, and delivered or cancelled
  // orders are never touched.
  if (trackingNumber) {
    const { data: order } = await supabase
      .from('orders')
      .select('fulfillment_status, payment_status')
      .eq('id', orderId)
      .maybeSingle();

    const current = order?.fulfillment_status || 'new';
    if (order?.payment_status === 'paid' && (current === 'new' || current === 'packed')) {
      update.fulfillment_status = 'shipped';
      update.shipped_at = new Date().toISOString();
    }
  }

  const { error } = await supabase.from('orders').update(update).eq('id', orderId);
  if (error) return { error: error.message };

  revalidatePath('/admin/dashboard');
  revalidatePath(`/admin/orders/${orderId}`);
  return { error: null };
}

export async function markOrdersDelivered(orderIds: number[]) {
  if (!(await getAdminUser())) return { error: 'Unauthorized', updated: 0 };

  const ids = Array.from(new Set((orderIds || []).map(Number))).filter(
    (n) => Number.isInteger(n) && n > 0
  );
  if (ids.length === 0) return { error: 'No orders selected.', updated: 0 };
  if (ids.length > 200) return { error: 'Please select 200 orders or fewer at a time.', updated: 0 };

  const supabase = supabaseAdmin();

  // Only paid orders that are currently "shipped" can be marked delivered this way.
  const { data, error } = await supabase
    .from('orders')
    .update({ fulfillment_status: 'delivered', delivered_at: new Date().toISOString() })
    .in('id', ids)
    .eq('payment_status', 'paid')
    .eq('fulfillment_status', 'shipped')
    .select('id');

  if (error) return { error: error.message, updated: 0 };

  revalidatePath('/admin/dashboard');
  return { error: null, updated: data?.length ?? 0 };
}