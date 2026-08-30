'use server';
import { revalidatePath } from 'next/cache';
import { supabaseAdmin } from '@/lib/supabaseServer';

export async function addCoupon(formData: FormData) {
  const code = String(formData.get('code') || '').trim().toUpperCase();
  const discount_type = formData.get('discount_type') === 'flat' ? 'flat' : 'percent';
  const discount_value = Number(formData.get('discount_value') || 0);
  const maxUsesRaw = String(formData.get('max_uses') || '').trim();
  const max_uses = maxUsesRaw ? parseInt(maxUsesRaw) : null;
  const min_order_amount = Number(formData.get('min_order_amount') || 0);
  const expiresRaw = String(formData.get('expires_at') || '').trim();
  const expires_at = expiresRaw || null;

  if (!code || !discount_value) return;

  const supabase = supabaseAdmin();
  await supabase.from('coupons').insert({
    code,
    discount_type,
    discount_value,
    max_uses,
    min_order_amount,
    expires_at,
    active: true,
  });
  revalidatePath('/admin/coupons');
}

export async function toggleCoupon(id: number, active: boolean) {
  const supabase = supabaseAdmin();
  await supabase.from('coupons').update({ active: !active }).eq('id', id);
  revalidatePath('/admin/coupons');
}

export async function deleteCoupon(id: number) {
  const supabase = supabaseAdmin();
  await supabase.from('coupons').delete().eq('id', id);
  revalidatePath('/admin/coupons');
}
