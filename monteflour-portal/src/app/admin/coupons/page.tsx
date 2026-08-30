import { supabaseAdmin } from '@/lib/supabaseServer';
import { addCoupon, toggleCoupon, deleteCoupon } from '../actions';

export const dynamic = 'force-dynamic';

export default async function CouponsPage() {
  const supabase = supabaseAdmin();
  const { data: coupons } = await supabase
    .from('coupons')
    .select('*')
    .order('created_at', { ascending: false });

  const list = coupons || [];

  return (
    <main className="admin-main">
      <div className="admin-card">
        <h3>Create New Coupon</h3>
        <form action={addCoupon} className="coupon-form">
          <div className="form-row">
            <div>
              <label>Code</label>
              <input name="code" required placeholder="e.g. DIWALI20" />
            </div>
            <div>
              <label>Type</label>
              <select name="discount_type" defaultValue="percent">
                <option value="percent">Percent (%)</option>
                <option value="flat">Flat (₹)</option>
              </select>
            </div>
            <div>
              <label>Value</label>
              <input type="number" step="0.01" name="discount_value" required placeholder="e.g. 10" />
            </div>
          </div>
          <div className="form-row">
            <div>
              <label>Max uses (blank = unlimited)</label>
              <input type="number" name="max_uses" />
            </div>
            <div>
              <label>Min order amount (₹)</label>
              <input type="number" step="0.01" name="min_order_amount" defaultValue={0} />
            </div>
            <div>
              <label>Expiry date (blank = never)</label>
              <input type="date" name="expires_at" />
            </div>
          </div>
          <button type="submit" className="btn-submit">Add Coupon</button>
        </form>
      </div>

      {list.length === 0 ? (
        <div className="admin-card">No coupons yet — create one above.</div>
      ) : (
        <table className="admin-table">
          <thead>
            <tr>
              <th>Code</th><th>Discount</th><th>Used / Max</th><th>Min Order</th>
              <th>Expires</th><th>Status</th><th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {list.map((c: any) => (
              <tr key={c.id}>
                <td><strong>{c.code}</strong></td>
                <td>{c.discount_type === 'percent' ? `${c.discount_value}%` : `₹${c.discount_value}`}</td>
                <td>{c.used_count} / {c.max_uses ?? '∞'}</td>
                <td>₹{Number(c.min_order_amount).toFixed(0)}</td>
                <td>{c.expires_at || 'Never'}</td>
                <td><span className={`badge ${c.active ? 'on' : 'off'}`}>{c.active ? 'Active' : 'Off'}</span></td>
                <td>
                  <form action={toggleCoupon.bind(null, c.id, c.active)} style={{ display: 'inline' }}>
                    <button className="mini-btn toggle">{c.active ? 'Disable' : 'Enable'}</button>
                  </form>
                  <form action={deleteCoupon.bind(null, c.id)} style={{ display: 'inline' }}>
                    <button className="mini-btn delete">Delete</button>
                  </form>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </main>
  );
}
