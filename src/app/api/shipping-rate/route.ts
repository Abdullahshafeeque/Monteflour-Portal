import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseServer';

export async function GET(req: NextRequest) {
  const state = req.nextUrl.searchParams.get('state') || '';
  const supabase = supabaseAdmin();

  const { data: stateRule } = await supabase
    .from('shipping_rules')
    .select('*')
    .eq('state', state)
    .maybeSingle();

  const { data: defaultRule } = await supabase
    .from('shipping_rules')
    .select('*')
    .eq('state', 'ALL')
    .maybeSingle();

  const rule = stateRule || defaultRule;

  return NextResponse.json({
    shipping_fee: Number(rule?.shipping_fee || 0),
    free_shipping_above: Number(rule?.free_shipping_above || 0),
  });
}