'use client';
import { useEffect, useMemo, useState, useTransition } from 'react';
import Link from 'next/link';
import StatusSelect from '@/components/StatusSelect';
import { markOrdersDelivered } from '@/app/admin/orders/actions';

const PERIODS = [
  { key: 'day', label: 'Today' },
  { key: 'week', label: 'This Week' },
  { key: 'month', label: 'This Month' },
  { key: 'quarter', label: 'This Quarter' },
  { key: 'year', label: 'This Year' },
  { key: 'all', label: 'All Time' },
  { key: 'custom', label: 'Custom Range' },
] as const;

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

const PAGE_SIZE = 150;

export default function OrdersTable({ orders }: { orders: any[] }) {
  const [tab, setTab] = useState<'paid' | 'pending'>('paid');
  const [period, setPeriod] = useState<(typeof PERIODS)[number]['key']>('all');
  const [page, setPage] = useState(1);
  const [customFrom, setCustomFrom] = useState('');
  const [customTo, setCustomTo] = useState('');
  const [selected, setSelected] = useState<number[]>([]);
  const [bulkMsg, setBulkMsg] = useState<{ text: string; ok: boolean } | null>(null);
  const [isBulkPending, startBulk] = useTransition();

  const filtered = useMemo(() => {
    return orders.filter((o) => {
      const matchesTab = tab === 'pending'
        ? (o.payment_status === 'pending' || o.payment_status === 'failed')
        : o.payment_status === tab;
      if (!matchesTab) return false;
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

  // Forget any ticked boxes whenever the visible list changes, so you can
  // never mark orders that are no longer on screen.
  useEffect(() => {
    setSelected([]);
  }, [tab, period, page, customFrom, customTo]);

  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const paginated = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  // Only paid orders that are currently "shipped" can be marked delivered in bulk.
  const selectableIds = paginated
    .filter((o) => o.payment_status === 'paid' && o.fulfillment_status === 'shipped')
    .map((o) => o.id as number);
  const selectedIds = selected.filter((id) => selectableIds.includes(id));
  const allSelected = selectableIds.length > 0 && selectedIds.length === selectableIds.length;

  function toggleOne(id: number) {
    setBulkMsg(null);
    setSelected((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  }

  function toggleAll() {
    setBulkMsg(null);
    setSelected(allSelected ? [] : selectableIds);
  }

  function handleMarkDelivered() {
    if (selectedIds.length === 0) return;
    const n = selectedIds.length;
    if (!window.confirm(`Mark ${n} order${n === 1 ? '' : 's'} as delivered?`)) return;
    startBulk(async () => {
      const result = await markOrdersDelivered(selectedIds);
      if (result.error) {
        setBulkMsg({ text: result.error, ok: false });
        return;
      }
      setSelected([]);
      setBulkMsg({
        text: `${result.updated} order${result.updated === 1 ? '' : 's'} marked as delivered.`,
        ok: true,
      });
    });
  }

  const activeOrders = filtered.filter((o) => o.fulfillment_status !== 'cancelled');
  const totalValue = activeOrders.reduce((sum, o) => sum + Number(o.total_amount), 0);
  const totalUnits = activeOrders.reduce((sum, o) => sum + Number(o.quantity), 0);
  const pendingDelivery = filtered.filter(
    (o) => (o.fulfillment_status || 'new') !== 'delivered' && o.fulfillment_status !== 'cancelled'
  ).length;
  const allDelivered = tab === 'paid' && activeOrders.length > 0 && pendingDelivery === 0;

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

      {tab === 'paid' && (selectableIds.length > 0 || bulkMsg) && (
        <div className="bulk-bar">
          <span>{selectedIds.length} selected</span>
          <button
            type="button"
            className="btn-submit"
            onClick={handleMarkDelivered}
            disabled={selectedIds.length === 0 || isBulkPending}
          >
            {isBulkPending ? 'Updating…' : 'Mark selected as delivered'}
          </button>
          {bulkMsg && (
            <span style={{ color: bulkMsg.ok ? '#2E8B57' : '#C0392B' }}>{bulkMsg.text}</span>
          )}
        </div>
      )}

      {filtered.length === 0 ? (
        <div className="empty">No orders in this period.</div>
      ) : (
        <table className="admin-table">
          <thead>
            <tr>
              {tab === 'paid' && (
                <th style={{ width: 40 }}>
                  <input
                    type="checkbox"
                    className="row-check"
                    checked={allSelected}
                    onChange={toggleAll}
                    disabled={selectableIds.length === 0}
                    aria-label="Select all shipped orders"
                  />
                </th>
              )}
              <th>Order #</th><th>Customer</th><th>Phone</th><th>City / State</th>
              <th>Qty</th><th>Coupon</th><th>Total</th><th>Payment</th><th>Attempts</th><th>Fulfillment</th><th>Date</th><th>Invoice</th>
            </tr>
          </thead>
          <tbody>
            {paginated.map((o: any) => (
              <tr key={o.id}>
                {tab === 'paid' && (
                  <td>
                    {o.payment_status === 'paid' && o.fulfillment_status === 'shipped' && (
                      <input
                        type="checkbox"
                        className="row-check"
                        checked={selected.includes(o.id)}
                        onChange={() => toggleOne(o.id)}
                        aria-label={`Select order ${o.order_number}`}
                      />
                    )}
                  </td>
                )}
                <td><Link href={`/admin/orders/${o.id}`}>{o.order_number}</Link></td>
                <td>{o.customer_name}<br /><small style={{ color: '#5A7A94' }}>{o.email}</small></td>
                <td>{o.phone}</td>
                <td>{o.city}, {o.state}</td>
                <td>{o.quantity}</td>
                <td>{o.coupon_code || '—'}</td>
                <td>₹{Number(o.total_amount).toFixed(2)}</td>
                <td><span className={`badge ${o.payment_status}`}>{o.payment_status}</span></td>
                <td>{o.attempt_count && o.attempt_count > 1 ? `${o.attempt_count}x` : '—'}</td>
                <td>
                  <StatusSelect
                    key={`${o.id}-${o.fulfillment_status || 'new'}`}
                    orderId={o.id}
                    currentStatus={o.fulfillment_status || 'new'}
                  />
                </td>
                <td>{new Date(o.created_at).toLocaleString('en-IN')}</td>
                <td>
                  {o.payment_status === 'paid' && (
                    <a href={`/api/admin/invoices/by-order/${o.id}`} target="_blank" rel="noopener noreferrer">
                      View
                    </a>
                  )}
                </td>
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