import { supabaseAdmin } from '@/lib/supabaseServer';
import { upsertShippingRule, deleteShippingRule } from '../actions';

export const dynamic = 'force-dynamic';

const INDIAN_STATES = [
  'ALL', 'Andhra Pradesh', 'Arunachal Pradesh', 'Assam', 'Bihar', 'Chhattisgarh', 'Goa', 'Gujarat',
  'Haryana', 'Himachal Pradesh', 'Jharkhand', 'Karnataka', 'Kerala', 'Madhya Pradesh',
  'Maharashtra', 'Manipur', 'Meghalaya', 'Mizoram', 'Nagaland', 'Odisha', 'Punjab',
  'Rajasthan', 'Sikkim', 'Tamil Nadu', 'Telangana', 'Tripura', 'Uttar Pradesh',
  'Uttarakhand', 'West Bengal',
  'Andaman and Nicobar Islands', 'Chandigarh', 'Dadra and Nagar Haveli and Daman and Diu',
  'Delhi', 'Jammu and Kashmir', 'Ladakh', 'Lakshadweep', 'Puducherry',
];

export default async function ShippingPage() {
  const supabase = supabaseAdmin();

  const { data: rules } = await supabase
    .from('shipping_rules')
    .select('*')
    .order('state', { ascending: true });

  const list = rules || [];

  return (
    <main className="admin-main">
      <div className="admin-card">
        <h3>Add / Update Shipping Rate</h3>
        <form action={upsertShippingRule} className="coupon-form">
          <div className="form-row">
            <div>
              <label>State ("ALL" = default for every other state)</label>
              <select name="state" required defaultValue="">
                <option value="" disabled>Select state</option>
                {INDIAN_STATES.map((s) => (
                  <option key={s} value={s}>{s}</option>
                ))}
              </select>
            </div>
            <div>
              <label>Shipping Fee (₹)</label>
              <input type="number" step="0.01" name="shipping_fee" required placeholder="e.g. 40" />
            </div>
            <div>
              <label>Free shipping above (₹) — 0 to disable</label>
              <input type="number" step="0.01" name="free_shipping_above" defaultValue={0} />
            </div>
          </div>
          <button type="submit" className="btn-submit">Save Rate</button>
        </form>
      </div>

      {list.length === 0 ? (
        <div className="admin-card">No shipping rules yet — add one above.</div>
      ) : (
        <table className="admin-table">
          <thead>
            <tr>
              <th>State</th><th>Shipping Fee</th><th>Free Above</th><th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {list.map((r: any) => (
              <tr key={r.id}>
                <td><strong>{r.state}</strong></td>
                <td>₹{Number(r.shipping_fee).toFixed(2)}</td>
                <td>{Number(r.free_shipping_above) > 0 ? `₹${Number(r.free_shipping_above).toFixed(2)}` : 'Disabled'}</td>
                <td>
                  <form action={deleteShippingRule.bind(null, r.id)} style={{ display: 'inline' }}>
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