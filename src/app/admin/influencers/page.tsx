import { supabaseAdmin } from '@/lib/supabaseServer';
import CreateInfluencerForm from './CreateInfluencerForm';

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
        <CreateInfluencerForm />
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