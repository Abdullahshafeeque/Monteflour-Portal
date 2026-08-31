import Link from 'next/link';
import SignOutButton from '@/components/SignOutButton';

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <div>
      <nav className="admin-nav">
        <span className="brand">Monteflour Admin</span>
        <div className="nav-links">
          <Link href="/admin/dashboard">Orders</Link>
          <Link href="/admin/coupons">Coupons</Link>
          <SignOutButton />
        </div>
      </nav>
      {children}
    </div>
  );
}
