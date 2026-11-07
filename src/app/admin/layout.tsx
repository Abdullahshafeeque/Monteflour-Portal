import AdminSidebar from '@/components/AdminSidebar';
import { supabaseServerClient } from '@/lib/supabaseServer';
import { redirect } from 'next/navigation';

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const supabase = supabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();

  const myAdminEmail = "abdshafeeque@gmail.com";

  if (!user || user.email !== myAdminEmail) {
    redirect('/influencer/dashboard');
  }

  return (
    <div className="admin-shell">
      <AdminSidebar userName="Abdullah Shafeeque" />
      <div className="admin-content">{children}</div>
    </div>
  );
}