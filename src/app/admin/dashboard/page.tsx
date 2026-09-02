import OrdersTable from '@/components/OrdersTable';
import { supabaseAdmin } from '@/lib/supabaseServer';

export const dynamic = 'force-dynamic';

export default async function DashboardPage() {
  const supabase = supabaseAdmin();

  const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();
  const { data: stalePending } = await supabase
    .from('orders')
    .select('id, phone, created_at')
    .eq('payment_status', 'pending')
    .lt('created_at', oneHourAgo);

  for (const stale of stalePending || []) {
    const staleTime = new Date(stale.created_at).getTime();
    const windowStart = new Date(staleTime - 60 * 60 * 1000).toISOString();
    const windowEnd = new Date(staleTime + 60 * 60 * 1000).toISOString();

    const { data: match } = await supabase
      .from('orders')
      .select('id')
      .eq('phone', stale.phone)
      .eq('payment_status', 'paid')
      .gte('created_at', windowStart)
      .lte('created_at', windowEnd)
      .limit(1)
      .maybeSingle();

    if (match) {
      await supabase.from('orders').delete().eq('id', stale.id);
    } else {
      await supabase
        .from('orders')
        .update({ payment_status: 'failed', fulfillment_status: 'cancelled' })
        .eq('id', stale.id);
    }
  }

  const { data: orders } = await supabase
    .from('orders')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(1000);

  const list = orders || [];
  const paid = list.filter((o: any) => o.payment_status === 'paid' && o.fulfillment_status !== 'cancelled');
  const revenue = paid.reduce((sum: number, o: any) => sum + Number(o.total_amount), 0);
  const pendingCount = list.filter((o: any) => o.payment_status === 'pending').length;

  return (
    <main className="admin-main">
      <div className="stats">
        <div className="stat">
          <div className="val">₹{revenue.toLocaleString('en-IN')}</div>
          <div className="label">Revenue (Paid)</div>
        </div>
        <div className="stat">
          <div className="val">{paid.length}</div>
          <div className="label">Paid Orders</div>
        </div>
        <div className="stat">
          <div className="val">{pendingCount}</div>
          <div className="label">Pending / Abandoned</div>
        </div>
      </div>

      <OrdersTable orders={list} />
    </main>
  );
}
