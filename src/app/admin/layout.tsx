import AdminSidebar from '@/components/AdminSidebar';
import { supabaseServerClient } from '@/lib/supabaseServer';
import { isAdmin, displayName } from '@/lib/roles';
import { redirect } from 'next/navigation';

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const supabase = supabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!isAdmin(user)) {
    redirect('/influencer/dashboard');
  }

  return (
    <div className="admin-shell">
      <AdminSidebar userName={displayName(user)} />
      <div className="admin-content">{children}</div>
    </div>
  );
}