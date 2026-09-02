'use client';
import { useMemo, useState } from 'react';
import Link from 'next/link';
import StatusSelect from '@/components/StatusSelect';

const PERIODS = [
  { key: 'day', label: 'Today', days: 1 },
  { key: 'week', label: 'This Week', days: 7 },
  { key: 'month', label: 'This Month', days: 30 },
  { key: 'quarter', label: 'This Quarter', days: 90 },
  { key: 'year', label: 'This Year', days: 365 },
  { key: 'all', label: 'All Time', days: null },
] as const;

export default function OrdersTable({ orders }: { orders: any[] }) {
  const [tab, setTab] = useState<'paid' | 'pending'>('paid');
  const [period, setPeriod] = useState<(typeof PERIODS)[number]['key']>('all');

  const filtered = useMemo(() => {
    const periodDef = PERIODS.find((p) => p.key === period)!;
    const cutoff = periodDef.days ? Date.now() - periodDef.days * 24 * 60 * 60 * 1000 : null;
    return orders.filter((o) => {
      if (o.payment_status !== tab) return false;
      if (cutoff && new Date(o.created_at).getTime() < cutoff) return false;
      return true;
    });
  }, [orders, tab, period]);

  const totalValue = filtered.reduce((sum, o) => sum + Number(o.total_amount), 0);
  const totalUnits = filtered.reduce((sum, o) => sum + Number(o.quantity), 0);
  const pendingDelivery = filtered.filter(
    (o) => (o.fulfillment_status || 'new') !== 'delivered' && o.fulfillment_status !== 'cancelled'
  ).length;
  const allDelivered = tab === 'paid' && filtered.length > 0 && pendingDelivery === 0;

  return (
    <>
      <div className="filter-tabs">
        <button className={`filter-tab ${tab === 'paid' ? 'active' : ''}`} onClick={() => setTab('paid')}>Payment Made</button>
        <button className={`filter-tab ${tab === 'pending' ? 'active' : ''}`} onClick={() => setTab('pending')}>Payment Pending</button>
      </div>

      <div className="period-filters">
        {PERIODS.map((p) => (
          <button key={p.key} className={`period-btn ${period === p.key ? 'active' : ''}`} onClick={() => setPeriod(p.key)}>
            {p.label}
          </button>
        ))}
      </div>

      {filtered.length === 0 ? (
        <div className="empty">No orders in this period.</div>
      ) : (
        <table className="admin-table">
          <thead>
            <tr>
              <th>Order #</th><th>Customer</th><th>Phone</th><th>City / State</th>
              <th>Qty</th><th>Coupon</th><th>Total</th><th>Payment</th><th>Fulfillment</th><th>Date</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((o: any) => (
              <tr key={o.id}>
                <td><Link href={`/admin/orders/${o.id}`}>{o.order_number}</Link></td>
                <td>{o.customer_name}<br /><small style={{ color: '#5A7A94' }}>{o.email}</small></td>
                <td>{o.phone}</td>
                <td>{o.city}, {o.state}</td>
                <td>{o.quantity}</td>
                <td>{o.coupon_code || '—'}</td>
                <td>₹{Number(o.total_amount).toFixed(2)}</td>
                <td><span className={`badge ${o.payment_status}`}>{o.payment_status}</span></td>
                <td><StatusSelect orderId={o.id} currentStatus={o.fulfillment_status || 'new'} /></td>
                <td>{new Date(o.created_at).toLocaleString('en-IN')}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      <div className="stats" style={{ marginTop: '1.5rem' }}>
        <div className="stat">
          <div className="val">₹{totalValue.toLocaleString('en-IN')}</div>
          <div className="label">Total Order Value</div>
        </div>
        <div className="stat">
          <div className="val">{totalUnits}</div>
          <div className="label">Total Units Sold</div>
        </div>
        {tab === 'paid' && (
          <div className="stat">
            <div className="val">{pendingDelivery}</div>
            <div className="label">Pending Delivery</div>
          </div>
        )}
        {allDelivered && (
          <div className="stat success">
            <div className="val">✓</div>
            <div className="label">All Orders Delivered</div>
          </div>
        )}
      </div>
    </>
  );
}