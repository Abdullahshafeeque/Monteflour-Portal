import AnalyticsSection from '@/components/AnalyticsSection';
import { supabaseAdmin } from '@/lib/supabaseServer';

export const dynamic = 'force-dynamic';

export default async function AnalyticsPage() {
  const supabase = supabaseAdmin();

  const { data: orders } = await supabase
    .from('orders')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(1000);

  return (
    <main className="admin-main">
      <AnalyticsSection orders={orders || []} />
    </main>
  );
}