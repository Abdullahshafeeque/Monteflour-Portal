import { supabaseAdmin } from '@/lib/supabaseServer';
import { revalidatePath } from 'next/cache';

export const dynamic = 'force-dynamic';

export default async function PayoutsPage() {
  const supabase = supabaseAdmin();
  
  // Fetch pending payouts with influencer details
  const { data: payouts } = await supabase
    .from('payout_requests')
    .select('*, influencers(name, email)')
    .eq('status', 'pending')
    .order('created_at', { ascending: false });

  const list = payouts || [];

  async function markAsPaid(id: number) {
    'use server';
    const adminClient = supabaseAdmin();
    await adminClient.from('payout_requests').update({ status: 'paid' }).eq('id', id);
    revalidatePath('/admin/payouts');
  }

  return (
    <main className="admin-main">
      <div className="admin-card">
        <h3>Pending Influencer Payouts</h3>
        {list.length === 0 ? (
          <p className="empty">No pending payouts at the moment.</p>
        ) : (
          <table className="admin-table" style={{ marginTop: '1rem' }}>
            <thead>
              <tr>
                <th>Influencer</th>
                <th>Email</th>
                <th>Amount</th>
                <th>Requested On</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              {list.map((p: any) => (
                <tr key={p.id}>
                  <td><strong>{p.influencers?.name}</strong></td>
                  <td>{p.influencers?.email}</td>
                  <td>₹{Number(p.amount).toFixed(2)}</td>
                  <td>{new Date(p.created_at).toLocaleDateString('en-IN')}</td>
                  <td>
                    <form action={markAsPaid.bind(null, p.id)}>
                      <button className="btn-submit" style={{ padding: '0.35rem 0.8rem', fontSize: '0.75rem' }}>Mark Paid</button>
                    </form>
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