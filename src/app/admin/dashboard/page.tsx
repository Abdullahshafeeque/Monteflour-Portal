import OrdersTable from '@/components/OrdersTable';
import AnalyticsSection from '@/components/AnalyticsSection';
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

  // Collapse repeated failed payment attempts from the same phone number on the
  // same day into one representative row (highest quantity wins; ties go to the
  // most recent attempt), so retried failed payments don't clutter the dashboard.
  // Nothing is deleted from the database — the other attempts are just not shown.
  const IST_OFFSET_MS = 5.5 * 60 * 60 * 1000;
  const toISTDateKey = (dateInput: string) => {
    const ist = new Date(new Date(dateInput).getTime() + IST_OFFSET_MS);
    return `${ist.getUTCFullYear()}-${String(ist.getUTCMonth() + 1).padStart(2, '0')}-${String(ist.getUTCDate()).padStart(2, '0')}`;
  };

  const failedGroups = new Map<string, any[]>();
  const nonFailed: any[] = [];
  for (const o of list) {
    if (o.payment_status !== 'failed') {
      nonFailed.push(o);
      continue;
    }
    const key = `${o.phone}_${toISTDateKey(o.created_at)}`;
    if (!failedGroups.has(key)) failedGroups.set(key, []);
    failedGroups.get(key)!.push(o);
  }

  const dedupedFailed = Array.from(failedGroups.values()).map((group) => {
    const sorted = [...group].sort((a, b) => {
      if (b.quantity !== a.quantity) return b.quantity - a.quantity;
      return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
    });
    return { ...sorted[0], attempt_count: group.length };
  });

  const displayList = [...nonFailed, ...dedupedFailed].sort(
    (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
  );

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

               <AnalyticsSection orders={list} />
      <OrdersTable orders={displayList} />
    </main>
  );
}
