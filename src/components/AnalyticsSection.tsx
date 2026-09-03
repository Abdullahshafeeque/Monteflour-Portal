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

export default function AnalyticsSection({ orders }: { orders: Order[] }) {
  const paid = orders.filter((o) => o.payment_status === 'paid' && o.fulfillment_status !== 'cancelled');
  const failed = orders.filter((o) => o.payment_status === 'failed');
  const pending = orders.filter((o) => o.payment_status === 'pending');
  const totalAttempts = orders.length;
  const revenue = paid.reduce((s, o) => s + Number(o.total_amount), 0);
  const unitsSold = paid.reduce((s, o) => s + Number(o.quantity), 0);
  const avgOrderValue = paid.length ? revenue / paid.length : 0;
  const conversionRate = totalAttempts ? paid.length / totalAttempts : 0;
  const dropOffRate = totalAttempts ? (failed.length + pending.length) / totalAttempts : 0;

  // ---------- revenue trend, last 14 days ----------
  const today = new Date();
  const last14: { key: string; label: string; revenue: number; orders: number }[] = [];
  for (let i = 13; i >= 0; i--) {
    const d = new Date(today.getTime() - i * DAY_MS);
    const key = toISTDateKey(d.toISOString());
    last14.push({ key, label: `${d.getDate()}/${d.getMonth() + 1}`, revenue: 0, orders: 0 });
  }
  const dayIndex = new Map(last14.map((d, i) => [d.key, i]));
  for (const o of paid) {
    const key = toISTDateKey(o.created_at);
    const idx = dayIndex.get(key);
    if (idx !== undefined) {
      last14[idx].revenue += Number(o.total_amount);
      last14[idx].orders += 1;
    }
  }
  const maxDayRevenue = Math.max(1, ...last14.map((d) => d.revenue));

  // ---------- day-of-week x hour heatmap ----------
  const heat: number[][] = Array.from({ length: 7 }, () => Array(24).fill(0));
  for (const o of paid) {
    const ist = toIST(o.created_at);
    heat[ist.getUTCDay()][ist.getUTCHours()] += 1;
  }
  const maxHeat = Math.max(1, ...heat.flat());
  const dowLabels = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

  // ---------- geography ----------
  const byState = new Map<string, { revenue: number; orders: number }>();
  const byCity = new Map<string, { revenue: number; orders: number }>();
  for (const o of paid) {
    const s = byState.get(o.state) || { revenue: 0, orders: 0 };
    s.revenue += Number(o.total_amount);
    s.orders += 1;
    byState.set(o.state, s);

    const cityKey = `${o.city}, ${o.state}`;
    const c = byCity.get(cityKey) || { revenue: 0, orders: 0 };
    c.revenue += Number(o.total_amount);
    c.orders += 1;
    byCity.set(cityKey, c);
  }
  const topStates = [...byState.entries()].sort((a, b) => b[1].revenue - a[1].revenue).slice(0, 6);
  const topCities = [...byCity.entries()].sort((a, b) => b[1].revenue - a[1].revenue).slice(0, 8);
  const maxStateRevenue = Math.max(1, ...topStates.map(([, v]) => v.revenue));

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

  // ---------- quantity / basket size distribution ----------
  const qtyBuckets = new Map<number, number>();
  for (const o of paid) {
    const q = Number(o.quantity);
    qtyBuckets.set(q, (qtyBuckets.get(q) || 0) + 1);
  }
  const qtyRows = [...qtyBuckets.entries()].sort((a, b) => a[0] - b[0]).slice(0, 8);
  const maxQtyCount = Math.max(1, ...qtyRows.map(([, c]) => c));

  // ---------- fulfillment funnel + SLA ----------
  const stages = ['new', 'packed', 'shipped', 'delivered'];
  const stageCounts = stages.map(
    (s) => paid.filter((o) => (o.fulfillment_status || 'new') === s).length
  );
  const cancelledCount = orders.filter((o) => o.fulfillment_status === 'cancelled').length;
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

  // ---------- pincode concentration (mini logistics insight) ----------
  const byPincode = new Map<string, number>();
  for (const o of paid) byPincode.set(o.pincode, (byPincode.get(o.pincode) || 0) + 1);
  const topPincodes = [...byPincode.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5);

  // ---------- failed payment loss estimate ----------
  const failedValueLost = failed.reduce((s, o) => s + Number(o.total_amount || 0), 0);
  const pendingValueAtStake = pending.reduce((s, o) => s + Number(o.total_amount || 0), 0);

  return (
    <section className="analytics-section">
      <h2 className="analytics-title">Analytics</h2>

      {/* ---- headline KPIs ---- */}
      <div className="stats">
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
            Cancelled: {cancelledCount}.
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
          {topStates.map(([state, v]) => (
            <div className="hbar-row" key={state}>
              <div className="hbar-label">{state}</div>
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
              {topCities.map(([city, v]) => (
                <tr key={city}>
                  <td>{city}</td>
                  <td>{v.orders}</td>
                  <td>{money(v.revenue)}</td>
                </tr>
              ))}
            </tbody>
          </table>
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
          <p className="analytics-note">Total discount given across all coupons: {money(totalDiscountGiven)}.</p>
        </div>

        {/* ---- lost revenue ---- */}
        <div className="admin-card">
          <h3>Checkout Leakage</h3>
          <p className="analytics-note">
            {failed.length} failed payment attempt{failed.length === 1 ? '' : 's'} worth {money(failedValueLost)}
            {' '}never converted. {pending.length} order{pending.length === 1 ? '' : 's'} worth {money(pendingValueAtStake)}
            {' '}are currently stuck pending. Recovering even a third of failed attempts here would add roughly{' '}
            {money(failedValueLost / 3)} in revenue.
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
        </div>
      </div>
    </section>
  );
}