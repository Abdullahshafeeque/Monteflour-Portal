'use client';
import { useEffect, useMemo, useState } from 'react';

const PERIODS = [
  { key: 'day', label: 'Today' },
  { key: 'week', label: 'This Week' },
  { key: 'month', label: 'This Month' },
  { key: 'quarter', label: 'This Quarter' },
  { key: 'year', label: 'This Year' },
  { key: 'all', label: 'All Time' },
  { key: 'custom', label: 'Custom Range' },
] as const;

const PAGE_SIZE = 100;

function getPeriodStart(key: string): number | null {
  const now = new Date();
  if (key === 'day') {
    return new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  }
  if (key === 'week') {
    const day = now.getDay();
    const diffToMonday = day === 0 ? 6 : day - 1;
    const monday = new Date(now.getFullYear(), now.getMonth(), now.getDate() - diffToMonday);
    return monday.getTime();
  }
  if (key === 'month') {
    return new Date(now.getFullYear(), now.getMonth(), 1).getTime();
  }
  if (key === 'quarter') {
    const quarterStartMonth = Math.floor(now.getMonth() / 3) * 3;
    return new Date(now.getFullYear(), quarterStartMonth, 1).getTime();
  }
  if (key === 'year') {
    return new Date(now.getFullYear(), 0, 1).getTime();
  }
  return null;
}

export default function InfluencerOrdersTable({ orders }: { orders: any[] }) {
  const [tab, setTab] = useState<'paid' | 'pending'>('paid');
  const [period, setPeriod] = useState<(typeof PERIODS)[number]['key']>('all');
  const [page, setPage] = useState(1);
  const [customFrom, setCustomFrom] = useState('');
  const [customTo, setCustomTo] = useState('');

  const filtered = useMemo(() => {
    return orders.filter((o) => {
      if (o.payment_status !== tab) return false;
      const orderTime = new Date(o.created_at).getTime();
      if (period === 'custom') {
        if (customFrom && orderTime < new Date(customFrom).setHours(0, 0, 0, 0)) return false;
        if (customTo && orderTime > new Date(customTo).setHours(23, 59, 59, 999)) return false;
        return true;
      }
      const cutoff = getPeriodStart(period);
      if (cutoff && orderTime < cutoff) return false;
      return true;
    });
  }, [orders, tab, period, customFrom, customTo]);

  useEffect(() => {
    setPage(1);
  }, [tab, period]);

  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const paginated = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

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

      {period === 'custom' && (
        <div className="custom-range">
          <div>
            <label>From</label>
            <input type="date" value={customFrom} onChange={(e) => setCustomFrom(e.target.value)} />
          </div>
          <div>
            <label>To</label>
            <input type="date" value={customTo} onChange={(e) => setCustomTo(e.target.value)} />
          </div>
        </div>
      )}

      {filtered.length === 0 ? (
        <p className="empty">No orders in this period.</p>
      ) : (
        <table className="admin-table">
          <thead>
            <tr>
              <th>Date</th>
              <th>Order #</th>
              <th>Customer</th>
              <th>Amount</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {paginated.map((o: any) => (
              <tr key={o.id}>
                <td>{new Date(o.created_at).toLocaleDateString()}</td>
                <td>{o.order_number}</td>
                <td>{o.customer_name}</td>
                <td>₹{Number(o.total_amount).toFixed(2)}</td>
                <td>{o.payment_status}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {filtered.length > PAGE_SIZE && (
        <div className="pagination">
          <button className="period-btn" onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page === 1}>Prev</button>
          <span className="pagination-info">Page {page} of {pageCount}</span>
          <button className="period-btn" onClick={() => setPage((p) => Math.min(pageCount, p + 1))} disabled={page === pageCount}>Next</button>
        </div>
      )}
    </>
  );
}