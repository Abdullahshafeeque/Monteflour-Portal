import Link from 'next/link';
import SignOutButton from '@/components/SignOutButton';
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
    <div>
      <nav className="admin-nav">
        <span className="brand">Monteflour Admin</span>
        <div className="nav-links">
          <Link href="/admin/dashboard">Orders</Link>
          <Link href="/admin/analytics">Analytics</Link>
          <Link href="/admin/coupons">Coupons</Link>
          <Link href="/admin/influencers">Influencers</Link>
          <Link href="/admin/payouts">Payouts</Link>
          <SignOutButton />
        </div>
      </nav>
      {children}
    </div>
  );
}