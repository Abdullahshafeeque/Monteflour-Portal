import { supabaseAdmin } from '@/lib/supabaseServer';
import Link from 'next/link';
import { notFound } from 'next/navigation';

export const dynamic = 'force-dynamic';

type DayStat = {
  date: string;
  orders: number;
  paidOrders: number;
  revenue: number;
  commission: number;
};

export default async function InfluencerDetailPage({ params }: { params: { id: string } }) {
  const supabase = supabaseAdmin();

  // Fetch influencer profile + coupons
  const { data: influencer } = await supabase
    .from('influencers')
    .select('*, coupons(code, active, discount_type, discount_value, used_count)')
    .eq('id', params.id)
    .maybeSingle();

  if (!influencer) return notFound();

  const couponCodes = (influencer.coupons || []).map((c: any) => c.code);

  // Fetch orders driven by this influencer’s coupons
  const { data: orders } = couponCodes.length
    ? await supabase
        .from('orders')
        .select('*')
        .in('coupon_code', couponCodes)
        .order('created_at', { ascending: false })
    : { data: [] as any[] };

  const allOrders = orders || [];
  const paidOrders = allOrders.filter((o: any) => o.payment_status === 'paid');
  const failedOrders = allOrders.filter((o: any) => o.payment_status === 'failed');
  const pendingOrders = allOrders.filter((o: any) => o.payment_status === 'pending');

  const commissionPerOrder = Number(influencer.commission_per_order || 0);
  const totalRevenue = paidOrders.reduce((sum: number, o: any) => sum + Number(o.total_amount || 0), 0);
  const totalCommissionEarned = paidOrders.length * commissionPerOrder;

  // Payout history
  const { data: payouts } = await supabase
    .from('payout_requests')
    .select('*')
    .eq('influencer_id', params.id)
    .order('created_at', { ascending: false });

  const allPayouts = payouts || [];
  const totalPaidOut = allPayouts.filter((p: any) => p.status === 'paid').reduce((s: number, p: any) => s + Number(p.amount), 0);
  const totalPendingPayout = allPayouts.filter((p: any) => p.status === 'pending').reduce((s: number, p: any) => s + Number(p.amount), 0);
  const availableBalance = totalCommissionEarned - totalPaidOut - totalPendingPayout;

  // Day-by-day breakdown
  const dayMap = new Map<string, DayStat>();
  for (const o of allOrders) {
    const d = new Date(o.created_at);
    const key = d.toISOString().slice(0, 10);
    if (!dayMap.has(key)) {
      dayMap.set(key, { date: key, orders: 0, paidOrders: 0, revenue: 0, commission: 0 });
    }
    const stat = dayMap.get(key)!;
    stat.orders += 1;
    if (o.payment_status === 'paid') {
      stat.paidOrders += 1;
      stat.revenue += Number(o.total_amount || 0);
      stat.commission += commissionPerOrder;
    }
  }
  const dayStats = Array.from(dayMap.values()).sort((a, b) => (a.date < b.date ? 1 : -1));

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
          Coupon(s): {couponCodes.length ? couponCodes.join(', ') : 'None assigned'}
        </p>
        <div style={{ fontSize: '1.4rem', fontWeight: 700, color: 'var(--navy)', marginTop: '0.5rem' }}>
          ₹{availableBalance.toFixed(2)} Available Balance
        </div>
      </div>

      <div className="admin-card">
        <h3>Performance Summary</h3>
        <ul>
          <li>Total Orders: {allOrders.length}</li>
          <li>Paid Orders: {paidOrders.length}</li>
          <li>Pending Orders: {pendingOrders.length}</li>
          <li>Failed Orders: {failedOrders.length}</li>
          <li>Total Revenue: ₹{totalRevenue.toFixed(2)}</li>
          <li>Total Commission Earned: ₹{totalCommissionEarned.toFixed(2)}</li>
          <li>Already Paid Out: ₹{totalPaidOut.toFixed(2)}</li>
          <li>Pending Payout Requests: ₹{totalPendingPayout.toFixed(2)}</li>
        </ul>
      </div>

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
                <th>Paid Orders</th>
                <th>Revenue</th>
                <th>Commission</th>
              </tr>
            </thead>
            <tbody>
              {dayStats.map((d) => (
                <tr key={d.date}>
                  <td>{new Date(d.date).toLocaleDateString()}</td>
                  <td>{d.orders}</td>
                  <td>{d.paidOrders}</td>
                  <td>₹{d.revenue.toFixed(2)}</td>
                  <td>₹{d.commission.toFixed(2)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <div className="admin-card">
        <h3>Payout History</h3>
        {allPayouts.length === 0 ? (
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
              {allPayouts.map((p: any) => (
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
