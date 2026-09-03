'use client';
import { useMemo, useState } from 'react';

type Order = {
  id: number;
  order_number: string;
  customer_name: string;
  phone: string;
  email: string;
  city: string;
  state: string;
  pincode: string;
  quantity: number;
  unit_price: number;
  subtotal: number;
  coupon_code: string | null;
  discount_amount: number;
  shipping_fee: number;
  total_amount: number;
  payment_status: string;
  fulfillment_status: string | null;
  created_at: string;
  packed_at?: string | null;
  shipped_at?: string | null;
  delivered_at?: string | null;
};

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

const IST_OFFSET_MS = 5.5 * 60 * 60 * 1000;
const DAY_MS = 24 * 60 * 60 * 1000;

function toIST(dateInput: string) {
  return new Date(new Date(dateInput).getTime() + IST_OFFSET_MS);
}
function toISTDateKey(dateInput: string) {
  const ist = toIST(dateInput);
  return `${ist.getUTCFullYear()}-${String(ist.getUTCMonth() + 1).padStart(2, '0')}-${String(ist.getUTCDate()).padStart(2, '0')}`;
}
function money(n: number) {
  return `₹${Math.round(n).toLocaleString('en-IN')}`;
}
function pct(n: number) {
  return `${(n * 100).toFixed(1)}%`;
}
// Normalizes free-text city/state entry so "Kerala" and "kerala" aren't
// counted as two different places. Trims, lowercases for the grouping key,
// then title-cases for display.
function normalizePlace(raw: string) {
  const cleaned = (raw || '').trim().replace(/\s+/g, ' ');
  const key = cleaned.toLowerCase();
  const display = cleaned.replace(/\w\S*/g, (w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase());
  return { key, display };
}

export default function AnalyticsSection({ orders: allOrders }: { orders: Order[] }) {
  const [period, setPeriod] = useState<(typeof PERIODS)[number]['key']>('all');
  const [customFrom, setCustomFrom] = useState('');
  const [customTo, setCustomTo] = useState('');

  const orders = useMemo(() => {
    return allOrders.filter((o) => {
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
  }, [allOrders, period, customFrom, customTo]);

  const paid = orders.filter((o) => o.payment_status === 'paid' && o.fulfillment_status !== 'cancelled');
  const failed = orders.filter((o) => o.payment_status === 'failed');
  const pending = orders.filter((o) => o.payment_status === 'pending');
  const cancelled = orders.filter((o) => o.payment_status === 'paid' && o.fulfillment_status === 'cancelled');
  const totalAttempts = orders.length;
  const revenue = paid.reduce((s, o) => s + Number(o.total_amount), 0);
  const unitsSold = paid.reduce((s, o) => s + Number(o.quantity), 0);
  const avgOrderValue = paid.length ? revenue / paid.length : 0;
  const avgUnitsPerOrder = paid.length ? unitsSold / paid.length : 0;
  const revenuePerUnit = unitsSold ? revenue / unitsSold : 0;
  const conversionRate = totalAttempts ? paid.length / totalAttempts : 0;
  const dropOffRate = totalAttempts ? (failed.length + pending.length) / totalAttempts : 0;

  // ---------- revenue trend, last 14 days (+ 7-day-prior comparison) ----------
  // Always computed off allOrders/paid-globally so the 14-day trend chart still
  // makes sense even when a shorter period (e.g. "Today") is selected above.
  const todayDate = new Date();
  const paidAll = allOrders.filter((o) => o.payment_status === 'paid' && o.fulfillment_status !== 'cancelled');
  const last14: { key: string; label: string; revenue: number; orders: number }[] = [];
  for (let i = 13; i >= 0; i--) {
    const d = new Date(todayDate.getTime() - i * DAY_MS);
    const key = toISTDateKey(d.toISOString());
    last14.push({ key, label: `${d.getDate()}/${d.getMonth() + 1}`, revenue: 0, orders: 0 });
  }
  const dayIndex = new Map(last14.map((d, i) => [d.key, i]));
  for (const o of paidAll) {
    const key = toISTDateKey(o.created_at);
    const idx = dayIndex.get(key);
    if (idx !== undefined) {
      last14[idx].revenue += Number(o.total_amount);
      last14[idx].orders += 1;
    }
  }
  const maxDayRevenue = Math.max(1, ...last14.map((d) => d.revenue));
  const last7Revenue = last14.slice(7).reduce((s, d) => s + d.revenue, 0);
  const prev7Revenue = last14.slice(0, 7).reduce((s, d) => s + d.revenue, 0);
  const weekOverWeekChange = prev7Revenue ? (last7Revenue - prev7Revenue) / prev7Revenue : null;
  const ordersLast7 = last14.slice(7).reduce((s, d) => s + d.orders, 0);
  const ordersPrev7 = last14.slice(0, 7).reduce((s, d) => s + d.orders, 0);
  const orderMomentum = ordersPrev7 ? (ordersLast7 - ordersPrev7) / ordersPrev7 : null;

  // ---------- day-of-week x hour heatmap ----------
  const heat: number[][] = Array.from({ length: 7 }, () => Array(24).fill(0));
  for (const o of paid) {
    const ist = toIST(o.created_at);
    heat[ist.getUTCDay()][ist.getUTCHours()] += 1;
  }
  const maxHeat = Math.max(1, ...heat.flat());
  const dowLabels = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  let peakDow = 0, peakHour = 0, peakVal = -1;
  heat.forEach((row, d) => row.forEach((v, h) => { if (v > peakVal) { peakVal = v; peakDow = d; peakHour = h; } }));

  // ---------- geography (normalized) ----------
  const byState = new Map<string, { display: string; revenue: number; orders: number }>();
  const byCity = new Map<string, { display: string; revenue: number; orders: number }>();
  for (const o of paid) {
    const st = normalizePlace(o.state);
    const s = byState.get(st.key) || { display: st.display, revenue: 0, orders: 0 };
    s.revenue += Number(o.total_amount);
    s.orders += 1;
    byState.set(st.key, s);

    const ct = normalizePlace(o.city);
    const cityKey = `${ct.key}|${st.key}`;
    const c = byCity.get(cityKey) || { display: `${ct.display}, ${st.display}`, revenue: 0, orders: 0 };
    c.revenue += Number(o.total_amount);
    c.orders += 1;
    byCity.set(cityKey, c);
  }
  const topStates = [...byState.values()].sort((a, b) => b.revenue - a.revenue).slice(0, 6);
  const topCities = [...byCity.values()].sort((a, b) => b.revenue - a.revenue).slice(0, 8);
  const maxStateRevenue = Math.max(1, ...topStates.map((v) => v.revenue));
  const cityConcentration = revenue ? (topCities[0]?.revenue || 0) / revenue : 0;

  // ---------- coupon performance ----------
  const byCoupon = new Map<string, { revenue: number; orders: number; discount: number }>();
  let noCouponRevenue = 0;
  let noCouponOrders = 0;
  for (const o of paid) {
    if (o.coupon_code) {
      const c = byCoupon.get(o.coupon_code) || { revenue: 0, orders: 0, discount: 0 };
      c.revenue += Number(o.total_amount);
      c.orders += 1;
      c.discount += Number(o.discount_amount || 0);
      byCoupon.set(o.coupon_code, c);
    } else {
      noCouponRevenue += Number(o.total_amount);
      noCouponOrders += 1;
    }
  }
  const topCoupons = [...byCoupon.entries()].sort((a, b) => b[1].revenue - a[1].revenue).slice(0, 6);
  const totalDiscountGiven = [...byCoupon.values()].reduce((s, c) => s + c.discount, 0);
  const couponOrderShare = paid.length ? ([...byCoupon.values()].reduce((s, c) => s + c.orders, 0)) / paid.length : 0;
  const effectiveDiscountRate = revenue + totalDiscountGiven ? totalDiscountGiven / (revenue + totalDiscountGiven) : 0;

  // ---------- quantity / basket size distribution ----------
  const qtyBuckets = new Map<number, number>();
  for (const o of paid) {
    const q = Number(o.quantity);
    qtyBuckets.set(q, (qtyBuckets.get(q) || 0) + 1);
  }
  const qtyRows = [...qtyBuckets.entries()].sort((a, b) => a[0] - b[0]).slice(0, 8);
  const maxQtyCount = Math.max(1, ...qtyRows.map(([, c]) => c));
  const bulkOrders = paid.filter((o) => Number(o.quantity) >= 10);

  // ---------- fulfillment funnel + SLA ----------
  const stages = ['new', 'packed', 'shipped', 'delivered'];
  const stageCounts = stages.map(
    (s) => paid.filter((o) => (o.fulfillment_status || 'new') === s).length
  );
  const cancelledCount = cancelled.length;
  const cancellationRate = paid.length + cancelledCount ? cancelledCount / (paid.length + cancelledCount) : 0;
  const deliveredOrders = paid.filter((o) => o.fulfillment_status === 'delivered' && o.delivered_at);
  const avgFulfillmentHours = deliveredOrders.length
    ? deliveredOrders.reduce((s, o) => {
        const start = new Date(o.created_at).getTime();
        const end = new Date(o.delivered_at as string).getTime();
        return s + (end - start) / (1000 * 60 * 60);
      }, 0) / deliveredOrders.length
    : null;
  const packedOrders = paid.filter((o) => o.packed_at);
  const avgPackHours = packedOrders.length
    ? packedOrders.reduce((s, o) => {
        const start = new Date(o.created_at).getTime();
        const end = new Date(o.packed_at as string).getTime();
        return s + (end - start) / (1000 * 60 * 60);
      }, 0) / packedOrders.length
    : null;
  const stuckOrders = paid.filter((o) => {
    const status = o.fulfillment_status || 'new';
    if (status === 'delivered') return false;
    const ageHours = (Date.now() - new Date(o.created_at).getTime()) / (1000 * 60 * 60);
    return ageHours > 72;
  });

  // ---------- customer repeat / RFM-lite segmentation ----------
  const byPhone = new Map<string, Order[]>();
  for (const o of paid) {
    const arr = byPhone.get(o.phone) || [];
    arr.push(o);
    byPhone.set(o.phone, arr);
  }
  const repeatCustomers = [...byPhone.values()].filter((arr) => arr.length > 1).length;
  const oneTimeCustomers = byPhone.size - repeatCustomers;
  const repeatRate = byPhone.size ? repeatCustomers / byPhone.size : 0;
  const nowMs = Date.now();
  let champions = 0, loyal = 0, atRisk = 0, lost = 0, newCustomers = 0;
  for (const arr of byPhone.values()) {
    const spend = arr.reduce((s, o) => s + Number(o.total_amount), 0);
    const lastOrder = Math.max(...arr.map((o) => new Date(o.created_at).getTime()));
    const daysSince = (nowMs - lastOrder) / DAY_MS;
    if (arr.length === 1 && daysSince <= 14) newCustomers++;
    else if (arr.length >= 2 && daysSince <= 30 && spend >= avgOrderValue * 2) champions++;
    else if (arr.length >= 2 && daysSince <= 60) loyal++;
    else if (daysSince > 60 && daysSince <= 120) atRisk++;
    else if (daysSince > 120) lost++;
  }
  const topSpenders = [...byPhone.entries()]
    .map(([phone, arr]) => ({
      phone,
      name: arr[0].customer_name,
      spend: arr.reduce((s, o) => s + Number(o.total_amount), 0),
      orders: arr.length,
    }))
    .sort((a, b) => b.spend - a.spend)
    .slice(0, 6);
  const avgCustomerLifetimeValue = byPhone.size ? revenue / byPhone.size : 0;
  const sortedSpends = [...byPhone.values()]
    .map((arr) => arr.reduce((s, o) => s + Number(o.total_amount), 0))
    .sort((a, b) => b - a);
  const top20Count = Math.max(1, Math.ceil(sortedSpends.length * 0.2));
  const top20Revenue = sortedSpends.slice(0, top20Count).reduce((s, v) => s + v, 0);
  const top20Share = revenue ? top20Revenue / revenue : 0;

  // ---------- pincode concentration (mini logistics insight) ----------
  const byPincode = new Map<string, number>();
  for (const o of paid) byPincode.set(o.pincode, (byPincode.get(o.pincode) || 0) + 1);
  const topPincodes = [...byPincode.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5);

  // ---------- failed payment loss estimate ----------
  const failedValueLost = failed.reduce((s, o) => s + Number(o.total_amount || 0), 0);
  const pendingValueAtStake = pending.reduce((s, o) => s + Number(o.total_amount || 0), 0);
  const cancelledValueLost = cancelled.reduce((s, o) => s + Number(o.total_amount || 0), 0);

  // ---------- failure reason breakdown by phone-retry pattern ----------
  const failedPhones = new Set(failed.map((o) => o.phone));
  const paidPhones = new Set(paid.map((o) => o.phone));
  const recoveredAfterFail = [...failedPhones].filter((p) => paidPhones.has(p)).length;
  const neverRecovered = failedPhones.size - recoveredAfterFail;

  return (
    <section className="analytics-section">
      <h2 className="analytics-title">Analytics</h2>

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

      {paid.length === 0 && failed.length === 0 && pending.length === 0 ? (
        <div className="empty">No orders in this period.</div>
      ) : (
        <>
          {/* ---- headline KPIs ---- */}
          <div className="stats">
            <div className="stat">
              <div className="val">{money(revenue)}</div>
              <div className="label">Total Revenue (Paid)</div>
            </div>
            <div className="stat">
              <div className="val">{money(avgOrderValue)}</div>
              <div className="label">Avg Order Value</div>
            </div>
            <div className="stat">
              <div className="val">{unitsSold}</div>
              <div className="label">Units Sold (Paid)</div>
            </div>
            <div className="stat">
              <div className="val">{pct(conversionRate)}</div>
              <div className="label">Checkout Conversion</div>
            </div>
            <div className="stat">
              <div className="val">{pct(dropOffRate)}</div>
              <div className="label">Drop-off Rate</div>
            </div>
            <div className="stat">
              <div className="val">{pct(repeatRate)}</div>
              <div className="label">Repeat Customer Rate</div>
            </div>
            <div className="stat">
              <div className="val">{money(avgCustomerLifetimeValue)}</div>
              <div className="label">Avg Customer LTV</div>
            </div>
            <div className="stat">
              <div className="val">{money(failedValueLost)}</div>
              <div className="label">Value Lost to Failed Payments</div>
            </div>
          </div>

          <div className="analytics-grid">
            {/* ---- revenue trend ---- */}
            <div className="admin-card">
              <h3>Revenue — Last 14 Days</h3>
              <div className="bar-chart">
                {last14.map((d) => (
                  <div className="bar-col" key={d.key}>
                    <div className="bar-track">
                      <div
                        className="bar-fill"
                        style={{ height: `${Math.max(3, (d.revenue / maxDayRevenue) * 100)}%` }}
                        title={`${d.label}: ${money(d.revenue)} (${d.orders} orders)`}
                      />
                    </div>
                    <div className="bar-label">{d.label}</div>
                  </div>
                ))}
              </div>
              <p className="analytics-note">
                {weekOverWeekChange !== null ? (
                  <>This week's revenue is {weekOverWeekChange >= 0 ? 'up' : 'down'}{' '}
                    <strong className={weekOverWeekChange >= 0 ? 'trend-up' : 'trend-down'}>
                      {pct(Math.abs(weekOverWeekChange))}
                    </strong>{' '}
                    vs the prior 7 days.</>
                ) : 'Not enough history yet to compare week over week.'}
                {orderMomentum !== null && (
                  <> Order count is {orderMomentum >= 0 ? 'up' : 'down'} {pct(Math.abs(orderMomentum))} over the same window.</>
                )}
                {' '}(This chart always shows the last 14 days, independent of the period filter above.)
              </p>
            </div>

            {/* ---- order size distribution ---- */}
            <div className="admin-card">
              <h3>Basket Size Distribution</h3>
              {qtyRows.map(([q, count]) => (
                <div className="hbar-row" key={q}>
                  <div className="hbar-label">{q} unit{q === 1 ? '' : 's'}</div>
                  <div className="hbar-track">
                    <div className="hbar-fill" style={{ width: `${(count / maxQtyCount) * 100}%` }} />
                  </div>
                  <div className="hbar-value">{count}</div>
                </div>
              ))}
              <p className="analytics-note">
                Avg {avgUnitsPerOrder.toFixed(1)} units/order · {money(revenuePerUnit)} revenue per unit.
                {bulkOrders.length > 0 && <> {bulkOrders.length} order{bulkOrders.length === 1 ? '' : 's'} of 10+ units — worth checking these are genuine retail orders, not test entries.</>}
              </p>
            </div>

            {/* ---- fulfillment funnel ---- */}
            <div className="admin-card">
              <h3>Fulfillment Funnel</h3>
              {stages.map((s, i) => (
                <div className="hbar-row" key={s}>
                  <div className="hbar-label" style={{ textTransform: 'capitalize' }}>{s}</div>
                  <div className="hbar-track">
                    <div
                      className={`hbar-fill fulfillment-${s}`}
                      style={{ width: `${paid.length ? (stageCounts[i] / paid.length) * 100 : 0}%` }}
                    />
                  </div>
                  <div className="hbar-value">{stageCounts[i]}</div>
                </div>
              ))}
              <p className="analytics-note">
                {avgPackHours !== null ? `Avg time to pack: ${avgPackHours.toFixed(1)}h. ` : ''}
                {avgFulfillmentHours !== null ? `Avg order → delivered: ${avgFulfillmentHours.toFixed(1)}h. ` : ''}
                Cancelled: {cancelledCount} ({pct(cancellationRate)} of paid+cancelled), worth {money(cancelledValueLost)}.
                {stuckOrders.length > 0 && <> {stuckOrders.length} paid order{stuckOrders.length === 1 ? '' : 's'} older than 72h still not delivered — may need a follow-up.</>}
              </p>
            </div>

            {/* ---- customer segments ---- */}
            <div className="admin-card">
              <h3>Customer Segments (RFM-lite)</h3>
              <div className="segment-grid">
                <div className="segment-pill champions">Champions<span>{champions}</span></div>
                <div className="segment-pill loyal">Loyal<span>{loyal}</span></div>
                <div className="segment-pill new">New<span>{newCustomers}</span></div>
                <div className="segment-pill at-risk">At Risk<span>{atRisk}</span></div>
                <div className="segment-pill lost">Lost<span>{lost}</span></div>
                <div className="segment-pill one-time">One-time<span>{oneTimeCustomers}</span></div>
              </div>
              <p className="analytics-note">
                Top 20% of customers ({top20Count}) drive {pct(top20Share)} of total revenue.
              </p>
            </div>

            {/* ---- top spenders ---- */}
            <div className="admin-card">
              <h3>Top Spenders</h3>
              <table className="admin-table">
                <thead>
                  <tr><th>Customer</th><th>Orders</th><th>Total Spend</th></tr>
                </thead>
                <tbody>
                  {topSpenders.map((c) => (
                    <tr key={c.phone}>
                      <td>{c.name}</td>
                      <td>{c.orders}</td>
                      <td>{money(c.spend)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* ---- geography: states ---- */}
            <div className="admin-card">
              <h3>Revenue by State</h3>
              {topStates.map((v) => (
                <div className="hbar-row" key={v.display}>
                  <div className="hbar-label">{v.display}</div>
                  <div className="hbar-track">
                    <div className="hbar-fill" style={{ width: `${(v.revenue / maxStateRevenue) * 100}%` }} />
                  </div>
                  <div className="hbar-value">{money(v.revenue)}</div>
                </div>
              ))}
            </div>

            {/* ---- geography: top cities ---- */}
            <div className="admin-card">
              <h3>Top Cities</h3>
              <table className="admin-table">
                <thead>
                  <tr><th>City</th><th>Orders</th><th>Revenue</th></tr>
                </thead>
                <tbody>
                  {topCities.map((v) => (
                    <tr key={v.display}>
                      <td>{v.display}</td>
                      <td>{v.orders}</td>
                      <td>{money(v.revenue)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <p className="analytics-note">Your single biggest city makes up {pct(cityConcentration)} of all revenue.</p>
            </div>

            {/* ---- pincode concentration ---- */}
            <div className="admin-card">
              <h3>Top Delivery Pincodes</h3>
              <table className="admin-table">
                <thead>
                  <tr><th>Pincode</th><th>Paid Orders</th></tr>
                </thead>
                <tbody>
                  {topPincodes.map(([pin, count]) => (
                    <tr key={pin}>
                      <td>{pin}</td>
                      <td>{count}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* ---- coupon performance ---- */}
            <div className="admin-card">
              <h3>Coupon Performance</h3>
              <table className="admin-table">
                <thead>
                  <tr><th>Code</th><th>Orders</th><th>Revenue</th><th>Discount Given</th></tr>
                </thead>
                <tbody>
                  <tr>
                    <td><em>No coupon</em></td>
                    <td>{noCouponOrders}</td>
                    <td>{money(noCouponRevenue)}</td>
                    <td>—</td>
                  </tr>
                  {topCoupons.map(([code, v]) => (
                    <tr key={code}>
                      <td><strong>{code}</strong></td>
                      <td>{v.orders}</td>
                      <td>{money(v.revenue)}</td>
                      <td>{money(v.discount)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <p className="analytics-note">
                {pct(couponOrderShare)} of paid orders used a coupon. Total discount given: {money(totalDiscountGiven)}
                {' '}— an effective {pct(effectiveDiscountRate)} off gross sales.
              </p>
            </div>

            {/* ---- lost revenue / checkout leakage ---- */}
            <div className="admin-card">
              <h3>Checkout Leakage</h3>
              <p className="analytics-note">
                {failed.length} failed payment attempt{failed.length === 1 ? '' : 's'} worth {money(failedValueLost)}
                {' '}never converted. {pending.length} order{pending.length === 1 ? '' : 's'} worth {money(pendingValueAtStake)}
                {' '}are currently stuck pending. Of {failedPhones.size} customer{failedPhones.size === 1 ? '' : 's'} who had a failed
                payment, {recoveredAfterFail} came back and paid successfully, {neverRecovered} never did. Recovering even a
                third of failed attempts here would add roughly {money(failedValueLost / 3)} in revenue.
              </p>
            </div>

            {/* ---- day/hour heatmap ---- */}
            <div className="admin-card heatmap-card">
              <h3>When Customers Order (IST)</h3>
              <div className="heatmap">
                <div className="heatmap-hours">
                  {Array.from({ length: 24 }, (_, h) => (
                    <span key={h}>{h % 3 === 0 ? h : ''}</span>
                  ))}
                </div>
                {heat.map((row, dow) => (
                  <div className="heatmap-row" key={dow}>
                    <div className="heatmap-dow">{dowLabels[dow]}</div>
                    {row.map((count, hour) => (
                      <div
                        key={hour}
                        className="heatmap-cell"
                        title={`${dowLabels[dow]} ${hour}:00 — ${count} orders`}
                        style={{ opacity: count ? 0.15 + 0.85 * (count / maxHeat) : 0.05 }}
                      />
                    ))}
                  </div>
                ))}
              </div>
              {peakVal > 0 && (
                <p className="analytics-note">
                  Peak ordering window: <strong>{dowLabels[peakDow]} around {peakHour}:00 IST</strong> ({peakVal} orders).
                </p>
              )}
            </div>
          </div>
        </>
      )}
    </section>
  );
}