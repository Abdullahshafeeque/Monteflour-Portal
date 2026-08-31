import { supabaseAdmin } from '@/lib/supabaseServer';
import { revalidatePath } from 'next/cache';

export const dynamic = 'force-dynamic';

export default async function InfluencerDashboard({ searchParams }: { searchParams: { user?: string } }) {
  // For safety during initial setup, we can fetch the profile or pass ID securely. 
  // Let's hook up the server action for requesting a payout directly:
  
  async function requestPayout(formData: FormData) {
    'use server';
    const influencerId = String(formData.get('influencer_id'));
    const amount = Number(formData.get('amount'));
    
    if (amount <= 0 || !influencerId) return;

    const adminClient = supabaseAdmin();
    await adminClient.from('payout_requests').insert({
      influencer_id: influencerId,
      amount: amount,
      status: 'pending'
    });
    
    revalidatePath('/influencer/dashboard');
  }

  const supabase = supabaseAdmin();

  // For testing or multi-tenant lookup, let's grab the first influencer profile or check session
  // (We can refine session auth for influencers next, but this makes the dashboard fully functional right now)
  const { data: influencers } = await supabase.from('influencers').select('*').limit(1);
  const influencer = influencers?.[0];

  if (!influencer) {
    return (
      <div className="admin-main" style={{ textAlign: 'center', padding: '4rem' }}>
        <h2>No Influencer Account Found</h2>
        <p style={{ color: '#5A7A94', marginTop: '0.5rem' }}>Please create an influencer account from your admin panel first.</p>
      </div>
    );
  }

  // Fetch coupons for this influencer
  const { data: coupons } = await supabase.from('coupons').select('code').eq('influencer_id', influencer.id);
  const couponCodes = coupons?.map(c => c.code) || [];

  // Calculate Total Orders Driven
  const { count: orderCount } = await supabase.from('orders')
    .select('*', { count: 'exact', head: true })
    .in('coupon_code', couponCodes)
    .eq('payment_status', 'paid');
    
  const totalEarned = (orderCount || 0) * Number(influencer.commission_per_order || 0);

  // Calculate Total Payouts Requested
  const { data: payouts } = await supabase.from('payout_requests')
    .select('amount')
    .eq('influencer_id', influencer.id);
    
  const totalRequested = payouts?.reduce((sum, p) => sum + Number(p.amount), 0) || 0;
  const availableBalance = totalEarned - totalRequested;

  return (
    <main className="admin-main" style={{ maxWidth: '800px', margin: '2rem auto', padding: '0 1rem' }}>
      <div className="admin-card">
        <h2 style={{ color: 'var(--navy)', fontFamily: 'Bebas Neue', fontSize: '2rem', letterSpacing: '0.04em' }}>
          Welcome, {influencer.name}
        </h2>
        <p style={{ color: 'var(--muted)', fontSize: '0.9rem', marginBottom: '1.5rem' }}>
          Active Coupon Code: <strong style={{ color: 'var(--navy)' }}>{couponCodes.join(', ') || 'None assigned'}</strong>
        </p>

        <div className="stats" style={{ marginBottom: '1.5rem' }}>
          <div className="stat">
            <div className="val">₹{availableBalance.toFixed(2)}</div>
            <div className="label">Available Balance</div>
          </div>
          <div className="stat">
            <div className="val">{orderCount || 0}</div>
            <div className="label">Paid Orders Driven</div>
          </div>
        </div>

        <form action={requestPayout}>
          <input type="hidden" name="influencer_id" value={influencer.id} />
          <input type="hidden" name="amount" value={availableBalance} />
          <button 
            type="submit"
            disabled={availableBalance <= 0}
            className="btn-submit"
            style={{ width: '100%', padding: '0.9rem', fontSize: '0.95rem' }}
          >
            {availableBalance > 0 ? 'Request Payout' : 'No Balance to Request'}
          </button>
        </form>
      </div>
    </main>
  );
}