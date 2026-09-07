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

  const { data: influencer } = await supabase
    .from('influencers')
    .select('*, coupons(code, active, discount_type, discount_value, used_count)')
    .eq('id', params.id)
    .maybeSingle();

  if (!influencer) return notFound();

  const couponCodes = (influencer.coupons || []).map((c: any) => c.code);

  // All orders that used any of this influencer's coupon codes
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
  const totalDiscountGiven = paidOrders.reduce((sum: number, o: any) => sum + Number(o.discount_amount || 0), 0);
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

  // Day-by-day breakdown (based on paid orders' created_at date, in local date form)
  const dayMap = new Map<string, DayStat>();
  for (const o of allOrders) {
    const d = new Date(o.created_at);
    const key = d.toISOString().slice(0, 10); // YYYY-MM-DD
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

  // First and most recent order-driven dates
  const firstOrderDate = allOrders.length ? allOrders[allOrders.length - 1].created_at : null;
  const lastOrderDate = allOrders.length ? allOrders[0].created_at : null;

  // Best day by paid orders
  const bestDay = dayStats.reduce<DayStat | null>((best, d) => {
    if (!best || d.paidOrders > best.paidOrders) return d;
    return best;
  }, null);

  const conversionRate = allOrders.length > 0 ? (paidOrders.length / allOrders.length) * 100 : 0;
  const avgOrderValue = paidOrders.length > 0 ? totalRevenue / paidOrders.length : 0;

  return (
    <main className="admin-main">
      <div style={{ marginBottom: '1rem' }}>
        <Link href="/admin/influencers" style={{ fontSize: '0.9rem' }}>&larr; Back to Influencers</Link>
      </div>

      <div className="admin-card">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '1rem' }}>
          <div>
            <h2 style={{ margin: 0 }}>{influencer.name}</h2>
            <p style={{ color: 'var(--muted)', margin: '0.25rem 0 0' }}>{influencer.email}</p>
            <p style={{ color: 'var(--muted)', fontSize: '0.85rem', marginTop: '0.25rem' }}>
              Coupon(s): {couponCodes.length ? couponCodes.join(', ') : 'None assigned'}
            </p>
          </div>
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontSize: '1.6rem', fontWeight: 700, color: 'var(--navy)' }}>₹{availableBalance.toFixed(2)}</div>
            <div style={{ fontSize: '0.8rem', color: 'var(--muted)' }}>Available Balance</div>
          </div>
        </div>
      </div>

      {/* Summary stats grid */}
      <div className="admin-card">
        <h3>Performance Summary</h3>
        <div className="stats" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: '1rem', marginTop: '1rem' }}>
          <Stat label="Total Orders (all)" value={allOrders.length.toString()} />
          <Stat label="Paid Orders" value={paidOrders.length.toString()} />
          <Stat label="Pending Orders" value={pendingOrders.length.toString()} />
          <Stat label="Failed Orders" value={failedOrders.length.toString()} />
          <Stat label="Conversion Rate" value={`${conversionRate.toFixed(1)}%`} />
          <Stat label="Revenue Driven" value={`₹${totalRevenue.toFixed(2)}`} />
          <Stat label="Avg Order Value" value={`₹${avgOrderValue.toFixed(2)}`} />
          <Stat label="Discount Given to Buyers" value={`₹${totalDiscountGiven.toFixed(2)}`} />
          <Stat label="Commission / Order" value={`₹${commissionPerOrder.toFixed(2)}`} />
          <Stat label="Total Commission Earned" value={`₹${totalCommissionEarned.toFixed(2)}`} />
          <Stat label="Already Paid Out" value={`₹${totalPaidOut.toFixed(2)}`} />
          <Stat label="Pending Payout Requests" value={`₹${totalPendingPayout.toFixed(2)}`} />
        </div>
        <div style={{ display: 'flex', gap: '2rem', marginTop: '1.5rem', flexWrap: 'wrap', fontSize: '0.85rem', color: 'var(--muted)' }}>
          <span>First order: {firstOrderDate ? new Date(firstOrderDate).toLocaleDateString() : '—'}</span>
          <span>Most recent order: {lastOrderDate ? new Date(lastOrderDate).toLocaleDateString() : '—'}</span>
          <span>Best day: {bestDay ? `${new Date(bestDay.date).toLocaleDateString()} (${bestDay.paidOrders} paid orders)` : '—'}</span>
        </div>
      </div>

      {/* Day-by-day breakdown */}
      <div className="admin-card">
        <h3>Orders by Day</h3>
        {dayStats.length === 0 ? (
          <p className="empty">No orders yet for this influencer's coupon(s).</p>
        ) : (
          <table className="admin-table" style={{ marginTop: '1rem' }}>
            <thead>
              <tr>
                <th>Date</th>
                <th>Total Orders</th>
                <th>Paid Orders</th>
                <th>Revenue</th>
                <th>Commission Earned</th>
              </tr>
            </thead>
            <tbody>
              {dayStats.map((d) => (
                <tr key={d.date}>
                  <td>{new Date(d.date).toLocaleDateString(undefined, { weekday: 'short', year: 'numeric', month: 'short', day: 'numeric' })}</td>
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

      {/* Individual orders */}
      <div className="admin-card">
        <h3>Order Details</h3>
        {allOrders.length === 0 ? (
          <p className="empty">No orders yet.</p>
        ) : (
          <table className="admin-table" style={{ marginTop: '1rem' }}>
            <thead>
              <tr>
                <th>Order #</th>
                <th>Date</th>
                <th>Customer</th>
                <th>Coupon Used</th>
                <th>Amount</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {allOrders.map((o: any) => (
                <tr key={o.id}>
                  <td>{o.order_number}</td>
                  <td>{new Date(o.created_at).toLocaleDateString()}</td>
                  <td>{o.customer_name}</td>
                  <td>{o.coupon_code}</td>
                  <td>₹{Number(o.total_amount).toFixed(2)}</td>
                  <td>
                    <span className={`badge ${o.payment_status === 'paid' ? 'on' : 'off'}`}>
                      {o.payment_status}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Payout history */}
      <div className="admin-card">
        <h3>Payout Request History</h3>
        {allPayouts.length === 0 ? (
          <p className="empty">No payout requests yet.</p>
        ) : (
          <table className="admin-table" style={{ marginTop: '1rem' }}>
            <thead>
              <tr>
                <th>Requested On</th>
                <th>Amount</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {allPayouts.map((p: any) => (
                <tr key={p.id}>
                  <td>{new Date(p.created_at).toLocaleDateString()}</td>
                  <td>₹{Number(p.amount).toFixed(2)}</td>
                  <td>
                    <span className={`badge ${p.status === 'paid' ? 'on' : 'off'}`}>
                      {p.status}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </main>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="stat" style={{ padding: '0.75rem', border: '1px solid #e2e8f0', borderRadius: '8px' }}>
      <div className="val" style={{ fontSize: '1.3rem', fontWeight: 700, color: 'var(--navy)' }}>{value}</div>
      <div className="label" style={{ fontSize: '0.75rem', color: 'var(--muted)', marginTop: '0.15rem' }}>{label}</div>
    </div>
  );
}