import { supabaseAdmin } from '@/lib/supabaseServer';
import { createInfluencer } from '../actions';

export const dynamic = 'force-dynamic';

export default async function AdminInfluencersPage() {
  const supabase = supabaseAdmin();

  const { data: influencers } = await supabase
    .from('influencers')
    .select('*, coupons(code)')
    .order('name', { ascending: true });

  const list = influencers || [];

  return (
    <main className="admin-main">
      <div className="admin-card">
        <h3>Create New Influencer Account</h3>
        <form action={async (formData) => { 'use server'; await createInfluencer(formData); }} className="coupon-form">
          <div className="form-row">
            <div>
              <label>Influencer Name</label>
              <input name="name" required placeholder="e.g. Rahul Fitness" />
            </div>
            <div>
              <label>Email (Login ID)</label>
              <input type="email" name="email" required placeholder="rahul@example.com" />
            </div>
            <div>
              <label>Password</label>
              <input type="password" name="password" required placeholder="Set login password" />
            </div>
          </div>
          <div className="form-row">
            <div>
              <label>Commission Per Order (₹)</label>
              <input type="number" step="0.01" name="commission" required placeholder="e.g. 50" />
            </div>
            <div>
              <label>Exclusive Coupon Code</label>
              <input name="coupon_code" required placeholder="e.g. RAHUL10" style={{ textTransform: 'uppercase' }} />
            </div>
          </div>
          <button type="submit" className="btn-submit">Create Influencer</button>
        </form>
      </div>

      <div className="admin-card">
        <h3>Registered Influencers</h3>
        {list.length === 0 ? (
          <p className="empty">No influencers added yet.</p>
        ) : (
          <table className="admin-table" style={{ marginTop: '1rem' }}>
            <thead>
              <tr>
                <th>Name</th>
                <th>Email</th>
                <th>Commission / Order</th>
                <th>Assigned Coupon</th>
              </tr>
            </thead>
            <tbody>
              {list.map((inf: any) => (
                <tr key={inf.id}>
                  <td><strong>{inf.name}</strong></td>
                  <td>{inf.email}</td>
                  <td>₹{Number(inf.commission_per_order).toFixed(2)}</td>
                  <td>
                    {inf.coupons?.map((c: any) => (
                      <span key={c.code} className="badge on" style={{ marginRight: '4px' }}>
                        {c.code}
                      </span>
                    ))}
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