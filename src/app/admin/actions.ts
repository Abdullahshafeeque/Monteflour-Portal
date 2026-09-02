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

export async function createInfluencer(prevState: any, formData: FormData) {
  const name = String(formData.get('name'));
  const email = String(formData.get('email'));
  const password = String(formData.get('password'));
  const commission = Number(formData.get('commission'));
  const couponCode = String(formData.get('coupon_code')).toUpperCase();

  const supabase = supabaseAdmin();
  
  // 1. Create Auth User
  const { data: authData, error: authError } = await supabase.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  });
  
  if (authError || !authData.user) return { error: authError?.message, success: false };

  // 2. Create Influencer Profile
  await supabase.from('influencers').insert({
    id: authData.user.id,
    name,
    email,
    commission_per_order: commission
  });

  // 3. Generate their exclusive coupon (skip if no code was entered)
  if (couponCode && couponCode !== 'NULL') {
    const { error: couponError } = await supabase.from('coupons').insert({
      code: couponCode,
      discount_type: 'percent',
      discount_value: 10,
      influencer_id: authData.user.id,
      active: true,
    });

    if (couponError) {
      // Roll back the half-created influencer so retrying with a different code works cleanly
      await supabase.from('influencers').delete().eq('id', authData.user.id);
      await supabase.auth.admin.deleteUser(authData.user.id);
      return { error: `Coupon code "${couponCode}" is already in use. Influencer was not created.`, success: false };
    }
  }

  revalidatePath('/admin/influencers');
  return { error: null, success: true };
}
export async function deleteInfluencer(id: string) {
  const supabase = supabaseAdmin();

  // Detach their coupon(s) rather than deleting the coupon itself,
  // so past orders that used the coupon code still make sense.
  await supabase.from('coupons').update({ influencer_id: null }).eq('influencer_id', id);

  // Snapshot their name/email onto any payout requests before the row disappears,
  // so payout history still reads clearly after deletion.
  const { data: influencer } = await supabase
    .from('influencers')
    .select('name, email')
    .eq('id', id)
    .maybeSingle();

  if (influencer) {
    await supabase
      .from('payout_requests')
      .update({
        influencer_id: null,
        influencer_name_snapshot: influencer.name,
        influencer_email_snapshot: influencer.email,
      })
      .eq('influencer_id', id);
  }

  // Delete the influencer profile row first — it references the auth user, so it has to
  // go before the auth user can be deleted.
  await supabase.from('influencers').delete().eq('id', id);

  // Delete their auth login so they can no longer sign in. Log (don't block) if this fails —
  // the influencer is already removed from your list either way at this point.
  const { error: authDeleteError } = await supabase.auth.admin.deleteUser(id);
  if (authDeleteError) {
    console.error('Failed to delete influencer auth user:', authDeleteError.message);
  }

  revalidatePath('/admin/influencers');
}