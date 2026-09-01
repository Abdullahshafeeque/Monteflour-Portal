import { supabaseAdmin } from '@/lib/supabaseServer';
import Link from 'next/link';
import { notFound } from 'next/navigation';

export const dynamic = 'force-dynamic';

export default async function InfluencerDetailPage({ params }: { params: { id: string } }) {
  const supabase = supabaseAdmin();

  const { data: influencer } = await supabase
    .from('influencers')
    .select('*, coupons(code, active, discount_type, discount_value, used_count)')
    .eq('id', params.id)
    .maybeSingle();

  if (!influencer) return notFound();

  return (
    <main className="admin-main">
      <div style={{ marginBottom: '1rem' }}>
        <Link href="/admin/influencers" style={{ fontSize: '0.9rem' }}>
          &larr; Back to Influencers
        </Link>
      </div>

      <div className="admin-card">
        <h2>{influencer.name}</h2>
        <p style={{ color: 'var(--muted)' }}>{influencer.email}</p>
        <p style={{ color: 'var(--muted)', fontSize: '0.85rem' }}>
          Coupon(s): {influencer.coupons?.map((c: any) => c.code).join(', ') || 'None assigned'}
        </p>
      </div>

      {/* Add more stats, orders, payouts here if needed */}
    </main>
  );
}
