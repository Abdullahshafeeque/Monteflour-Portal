import { supabaseAdmin } from '@/lib/supabaseServer';

export const dynamic = 'force-dynamic';

export default async function DashboardPage() {
  const supabase = supabaseAdmin();
  const { data: orders } = await supabase
    .from('orders')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(200);

  const list = orders || [];
  const paid = list.filter((o: any) => o.payment_status === 'paid');
  const revenue = paid.reduce((sum: number, o: any) => sum + Number(o.total_amount), 0);
  const pendingCount = list.filter((o: any) => o.payment_status === 'pending').length;

  return (
    <main className="admin-main">
      <div className="stats">
        <div className="stat">
          <div className="val">₹{revenue.toLocaleString('en-IN')}</div>
          <div className="label">Revenue (Paid)</div>
        </div>
        <div className="stat">
          <div className="val">{paid.length}</div>
          <div className="label">Paid Orders</div>
        </div>
        <div className="stat">
          <div className="val">{pendingCount}</div>
          <div className="label">Pending / Abandoned</div>
        </div>
      </div>

      {list.length === 0 ? (
        <div className="empty">No orders yet.</div>
      ) : (
        <table className="admin-table">
          <thead>
            <tr>
              <th>Order #</th><th>Customer</th><th>Phone</th><th>City / State</th>
              <th>Qty</th><th>Coupon</th><th>Total</th><th>Status</th><th>Date</th>
            </tr>
          </thead>
          <tbody>
            {list.map((o: any) => (
              <tr key={o.id}>
                <td>{o.order_number}</td>
                <td>{o.customer_name}<br /><small style={{ color: '#5A7A94' }}>{o.email}</small></td>
                <td>{o.phone}</td>
                <td>{o.city}, {o.state}</td>
                <td>{o.quantity}</td>
                <td>{o.coupon_code || '—'}</td>
                <td>₹{Number(o.total_amount).toFixed(2)}</td>
                <td><span className={`badge ${o.payment_status}`}>{o.payment_status}</span></td>
                <td>{new Date(o.created_at).toLocaleString('en-IN')}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </main>
  );
}
