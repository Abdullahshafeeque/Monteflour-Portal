'use server';
import { revalidatePath } from 'next/cache';
import { supabaseAdmin } from '@/lib/supabaseServer';

const VALID_STATUSES = ['new', 'packed', 'shipped', 'delivered', 'cancelled'];

export async function updateFulfillmentStatus(orderId: number, status: string) {
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