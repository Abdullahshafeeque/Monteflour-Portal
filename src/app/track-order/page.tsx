'use client';
import { useState } from 'react';

type TrackedOrder = {
  order_number: string;
  quantity: number;
  total_amount: number;
  payment_status: string;
  fulfillment_status: string | null;
  city: string;
  state: string;
  created_at: string;
  packed_at: string | null;
  shipped_at: string | null;
  delivered_at: string | null;
  courier: string | null;
  tracking_number: string | null;
};

const STEPS = [
  { key: 'new', label: 'Order Placed' },
  { key: 'packed', label: 'Packed' },
  { key: 'shipped', label: 'Shipped' },
  { key: 'delivered', label: 'Delivered' },
];
const COURIER_LABELS: Record<string, string> = {
  delhivery: 'Delhivery',
  bluedart: 'Blue Dart',
  dtdc: 'DTDC',
  ekart: 'Ekart',
  xpressbees: 'XpressBees',
  shadowfax: 'Shadowfax',
  ecom_express: 'Ecom Express',
  india_post: 'India Post',
  fedex: 'FedEx',
  dhl: 'DHL',
  amazon_shipping: 'Amazon Shipping',
  other: 'Courier',
};

export default function TrackOrderPage() {
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [orders, setOrders] = useState<TrackedOrder[] | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setOrders(null);
    setLoading(true);
    try {
      const res = await fetch('/api/track-order', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: query.trim() }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || 'Something went wrong. Please try again.');
        return;
      }
      setOrders(data.orders);
    } catch {
      setError('Network error. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  function currentStepIndex(o: TrackedOrder) {
    if (o.payment_status !== 'paid') return -1;
    const status = o.fulfillment_status || 'new';
    if (status === 'cancelled') return -1;
    return STEPS.findIndex((s) => s.key === status);
  }

  return (
    <>
      <div className="topbar">
        <a href="https://monteflour.com">Monteflour</a>
      </div>
      <div className="track-wrap">
        <h1>Track Your Order</h1>
        <div className="card">
          <form onSubmit={handleSubmit} className="track-form">
            <div className="form-group">
              <label>Order Number or Phone Number</label>
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="e.g. MF260902ED510 or 9876543210"
                required
              />
            </div>
            <button type="submit" className="pay-btn" disabled={loading}>
              {loading ? 'Searching...' : 'Track Order'}
            </button>
          </form>
          {error && (
            <div className="form-error" style={{ marginTop: '1rem' }}>
              {error}
            </div>
          )}
        </div>

        {orders &&
          orders.map((o) => {
            const stepIdx = currentStepIndex(o);
            const isCancelled = o.payment_status !== 'paid' || o.fulfillment_status === 'cancelled';
            return (
              <div className="card track-order-card" key={o.order_number}>
                <div className="track-order-head">
                  <div>
                    <div className="track-order-number">{o.order_number}</div>
                    <div className="track-order-meta">
                      {new Date(o.created_at).toLocaleDateString('en-IN')} · {o.city}, {o.state}
                    </div>
                  </div>
                  <div className="track-order-qty">
                    {o.quantity} box{o.quantity > 1 ? 'es' : ''}
                  </div>
                </div>

                {o.payment_status === 'pending' && (
                  <div className="track-status-msg pending">
                    Payment pending — this order hasn't been confirmed yet.
                  </div>
                )}
                {o.payment_status === 'failed' && (
                  <div className="track-status-msg failed">Payment was not successful for this order.</div>
                )}
                {isCancelled && o.payment_status === 'paid' && (
                  <div className="track-status-msg failed">This order has been cancelled.</div>
                )}

                {!isCancelled && o.payment_status === 'paid' && (
                  <div className="track-steps">
                    {STEPS.map((s, i) => (
                      <div key={s.key} className={`track-step ${i <= stepIdx ? 'done' : ''}`}>
                        <div className="track-step-dot" />
                        <div className="track-step-label">{s.label}</div>
                      </div>
                    ))}
                  </div>
                )}

                {!isCancelled && o.tracking_number && (
                  <div className="track-courier-info">
                    <span className="track-courier-name">{COURIER_LABELS[o.courier || ''] || o.courier || 'Courier'}</span>
                    <span className="track-courier-awb">AWB: {o.tracking_number}</span>
                  </div>
                )}
              </div>
            );
          })}
      </div>
    </>
  );
}