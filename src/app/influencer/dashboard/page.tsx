import { supabaseAdmin } from '@/lib/supabaseServer';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { revalidatePath } from 'next/cache';
import SignOutButton from '@/components/SignOutButton';
import InfluencerOrdersTable from '@/components/InfluencerOrdersTable';

export const dynamic = 'force-dynamic';

async function getSession() {
  const cookieStore = cookies();
  const supabaseSession = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) { return cookieStore.get(name)?.value; },
        set() {},
        remove() {},
      },
    }
  );
  const { data: { session } } = await supabaseSession.auth.getSession();
  return session;
}

export default async function InfluencerDashboard() {
  const session = await getSession();
  const supabase = supabaseAdmin();

  const { data: influencer } = await supabase
    .from('influencers')
    .select('*')
    .eq('id', session?.user.id)
    .maybeSingle();

  if (!influencer) {
    return (
      <div className="admin-main" style={{ textAlign: 'center', padding: '4rem' }}>
        <h2>No Influencer Account Found</h2>
        <p style={{ color: '#5A7A94', marginTop: '0.5rem' }}>
          This login isn't linked to an influencer profile. Contact the site admin.
        </p>
        <div style={{ marginTop: '2rem' }}><SignOutButton /></div>
      </div>
    );
  }

  const { data: coupons } = await supabase.from('coupons').select('code').eq('influencer_id', influencer.id);
  const couponCodes = coupons?.map(c => c.code) || [];

  const { data: orders } = couponCodes.length
    ? await supabase.from('orders').select('*').in('coupon_code', couponCodes).order('created_at', { ascending: false })
    : { data: [] };

  const allOrders = orders || [];
  const paidOrders = allOrders.filter((o: any) => o.payment_status === 'paid');
  const commissionPerOrder = Number(influencer.commission_per_order || 0);
  const totalRevenue = paidOrders.reduce((sum: number, o: any) => sum + Number(o.total_amount || 0), 0);
  const totalCommissionEarned = paidOrders.reduce((sum: number, o: any) => sum + Number(o.quantity || 0), 0) * commissionPerOrder;


  // Day-by-day breakdown
  const dayMap = new Map<string, { date: string; orders: number; paidOrders: number; units: number; commission: number }>();
  for (const o of allOrders) {
    const d = new Date(o.created_at);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    if (!dayMap.has(key)) {
      dayMap.set(key, { date: key, orders: 0, paidOrders: 0, units: 0, commission: 0 });
    }
    const stat = dayMap.get(key)!;
    stat.orders += 1;
    if (o.payment_status === 'paid') {
      stat.paidOrders += 1;
      stat.units += Number(o.quantity || 0);
      stat.commission += commissionPerOrder * Number(o.quantity || 0);
    }
  }
  const dayStats = Array.from(dayMap.values()).sort((a, b) => (a.date < b.date ? 1 : -1)).slice(0, 7);
  const { data: payoutsData } = await supabase
    .from('payout_requests')
    .select('*')
    .eq('influencer_id', influencer.id)
    .order('created_at', { ascending: false });

  const payouts = payoutsData || [];
    const totalPaidOut = payouts.filter((p: any) => p.status === 'paid')
    .reduce((s: number, p: any) => s + Number(p.amount), 0) || 0;

  const totalPendingPayout = payouts.filter((p: any) => p.status === 'pending')
    .reduce((s: number, p: any) => s + Number(p.amount), 0) || 0;

  const availableBalance = totalCommissionEarned - totalPaidOut - totalPendingPayout;


  async function requestPayout() {
    'use server';
    const session = await getSession();
    if (!session) return;

    const adminClient = supabaseAdmin();
    const { data: inf } = await adminClient.from('influencers').select('*').eq('id', session.user.id).maybeSingle();
    if (!inf) return;

    const { data: cpns } = await adminClient.from('coupons').select('code').eq('influencer_id', inf.id);
    const codes = cpns?.map(c => c.code) || [];

    const { data: paidOrdersData } = await adminClient.from('orders')
      .select('quantity')
      .in('coupon_code', codes.length ? codes : ['__none__'])
      .eq('payment_status', 'paid');

    const totalUnits = (paidOrdersData || []).reduce((sum: number, o: any) => sum + Number(o.quantity || 0), 0);
    const earned = totalUnits * Number(inf.commission_per_order || 0);
    const { data: existingPayouts } = await adminClient.from('payout_requests').select('amount').eq('influencer_id', inf.id);
    const requested = existingPayouts?.reduce((sum, p) => sum + Number(p.amount), 0) || 0;

    const balance = Math.round((earned - requested) * 100) / 100;
    if (balance <= 0) return;

    await adminClient.from('payout_requests').insert({
      influencer_id: inf.id,
      amount: balance,
      status: 'pending',
    });

    revalidatePath('/influencer/dashboard');
  }


  return (


    <main className="admin-main" style={{ maxWidth: '900px', margin: '2rem auto', padding: '0 1rem' }}>
      {/* Summary + Request Payout */}
      <div className="admin-card">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
          <h2 style={{ color: 'var(--navy)', fontFamily: 'Bebas Neue', fontSize: '2rem', letterSpacing: '0.04em', margin: 0 }}>
            Welcome, {influencer.name}
          </h2>
          <SignOutButton />
        </div>
        <p style={{ color: 'var(--muted)', fontSize: '0.9rem', marginBottom: '1.5rem' }}>
          Active Coupon Code: <strong style={{ color: 'var(--navy)' }}>{couponCodes.join(', ') || 'None assigned'}</strong>
        </p>

        <div className="stats" style={{ marginBottom: '1.5rem' }}>
          <div className="stat">
            <div className="val">₹{availableBalance.toFixed(2)}</div>
            <div className="label">Available Balance</div>
          </div>
          <div className="stat">
            <div className="val">{paidOrders.length}</div>
            <div className="label">Paid Orders Driven</div>
          </div>
        </div>

        <form action={requestPayout}>
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

      {/* Orders list */}
      <div className="admin-card">
        <h3>Your Orders</h3>
        <InfluencerOrdersTable orders={allOrders} />
      </div>

      {/* Day-by-day breakdown */}
<div className="admin-card">
  <h3>Orders by Day</h3>
  {dayStats.length === 0 ? (
    <p className="empty">No orders yet.</p>
  ) : (
    <table className="admin-table">
      <thead>
        <tr>
          <th>Date</th>
          <th>Total Orders</th>
          <th>Units Sold</th>
          <th>Commission</th>
        </tr>
      </thead>
      <tbody>
        {dayStats.map((d) => (
          <tr key={d.date}>
            <td>{new Date(d.date).toLocaleDateString()}</td>
            <td>{d.paidOrders}</td>
            <td>{d.units}</td>
            <td>₹{d.commission.toFixed(2)}</td>
          </tr>
        ))}
      </tbody>
    </table>
  )}
</div>
      {/* Payout history */}
      <div className="admin-card">
        <h3>Payout History</h3>
        {payouts.length === 0 ? (
          <p className="empty">No payout requests yet.</p>
        ) : (
          <table className="admin-table">
            <thead>
              <tr>
                <th>Date</th>
                <th>Amount</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {payouts.map((p: any) => (
                <tr key={p.id}>
                  <td>{new Date(p.created_at).toLocaleDateString()}</td>
                  <td>₹{Number(p.amount).toFixed(2)}</td>
                  <td>{p.status}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>


</main>
);
}
