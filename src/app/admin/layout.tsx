import Link from 'next/link';
import SignOutButton from '@/components/SignOutButton';
import { supabaseAdmin } from '@/lib/supabaseServer';
import { redirect } from 'next/navigation';

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const supabase = supabaseAdmin();
  
  // 1. Get the logged-in user
  const { data: { user } } = await supabase.auth.getUser();

  // 2. Define your master admin email here!
  const myAdminEmail = "abdullahshafeeque@gmail.com"; // <-- CHANGE THIS TO YOUR ACTUAL ADMIN LOGIN EMAIL

  // 3. Block unauthorized access
  if (!user || user.email !== myAdminEmail) {
    // If they aren't logged in, or if their email doesn't match the admin email, kick them out
    redirect('/influencer/dashboard');
  }

  return (
    <div>
      <nav className="admin-nav">
        <span className="brand">Monteflour Admin</span>
        <div className="nav-links">
          <Link href="/admin/dashboard">Orders</Link>
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