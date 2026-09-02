import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseServer';

export async function POST(req: NextRequest) {
  const body = await req.json();
  const name = String(body.name || '').trim();
  const email = String(body.email || '').trim().toLowerCase();
  const password = String(body.password || '');
  const commission_per_order = Number(body.commission_per_order) || 0;
  const couponCode = String(body.coupon_code || '').trim().toUpperCase();

  if (!name || !email || password.length < 6) {
    return NextResponse.json(
      { message: 'Name, email and a password of at least 6 characters are required.' },
      { status: 400 }
    );
  }

  const supabase = supabaseAdmin();

  const { data: authUser, error: authError } = await supabase.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { role: 'influencer' },
  });

  if (authError || !authUser?.user) {
    return NextResponse.json(
      { message: authError?.message || 'Failed to create login for influencer.' },
      { status: 400 }
    );
  }

  const userId = authUser.user.id;

  const { data: influencer, error: influencerError } = await supabase
    .from('influencers')
    .insert({
      id: userId,
      auth_user_id: userId,
      name,
      email,
      commission_per_order,
    })
    .select()
    .single();

  if (influencerError) {
    await supabase.auth.admin.deleteUser(userId);
    return NextResponse.json({ message: influencerError.message }, { status: 400 });
  }

  if (couponCode) {
    const { error: updateError, count } = await supabase
      .from('coupons')
      .update({ influencer_id: influencer.id }, { count: 'exact' })
      .eq('code', couponCode);

    if (updateError) {
      return NextResponse.json(
        { message: `Influencer created, but coupon linking failed: ${updateError.message}` },
        { status: 207 }
      );
    }

    if (!count) {
      const { error: insertError } = await supabase.from('coupons').insert({
        code: couponCode,
        discount_type: 'percent',
        discount_value: 10,
        influencer_id: influencer.id,
        active: true,
      });

      if (insertError) {
        return NextResponse.json(
          { message: `Influencer created, but coupon linking failed: ${insertError.message}` },
          { status: 207 }
        );
      }
    }
  }

  return NextResponse.json({ success: true, influencer });
}
