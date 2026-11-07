'use client';
import { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import SignOutButton from '@/components/SignOutButton';

const GROUPS = [
  {
    title: 'Sales',
    items: [
      { href: '/admin/dashboard', label: 'Orders', icon: '📦', also: ['/admin/orders'] },
      { href: '/admin/analytics', label: 'Analytics', icon: '📊', also: [] },
      { href: '/admin/invoices', label: 'Invoices', icon: '🧾', also: [] },
    ],
  },
  {
    title: 'Catalog',
    items: [
      { href: '/admin/coupons', label: 'Coupons', icon: '🏷️', also: [] },
      { href: '/admin/shipping', label: 'Shipping', icon: '🚚', also: [] },
    ],
  },
  {
    title: 'Partners',
    items: [
      { href: '/admin/influencers', label: 'Influencers', icon: '🤝', also: [] },
      { href: '/admin/payouts', label: 'Payouts', icon: '💸', also: [] },
    ],
  },
];

export default function AdminSidebar({ userName }: { userName: string }) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  const isActive = (item: { href: string; also: string[] }) =>
    [item.href, ...item.also].some((p) => pathname.startsWith(p));

  return (
    <>
      <div className="admin-mobilebar">
        <span className="brand">MONTEFLOUR</span>
        <button type="button" onClick={() => setOpen(!open)}>
          {open ? 'Close' : 'Menu'}
        </button>
      </div>

      <aside className={`admin-sidebar ${open ? 'open' : ''}`}>
        <div className="sidebar-brand">
          <div className="sidebar-brand-name">MONTEFLOUR</div>
          <div className="sidebar-brand-sub">Admin Portal</div>
        </div>

        <div className="sidebar-user">
          <div className="sidebar-avatar">{userName.charAt(0)}</div>
          <div>
            <div className="sidebar-user-name">{userName}</div>
            <div className="sidebar-user-role">ADMIN</div>
          </div>
        </div>

        <nav className="sidebar-nav">
          {GROUPS.map((group) => (
            <div key={group.title}>
              <div className="sidebar-group-title">{group.title}</div>
              {group.items.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={() => setOpen(false)}
                  className={`sidebar-link ${isActive(item) ? 'active' : ''}`}
                >
                  <span className="sidebar-icon">{item.icon}</span>
                  {item.label}
                </Link>
              ))}
            </div>
          ))}
        </nav>

        <div className="sidebar-footer">
          <SignOutButton />
        </div>
      </aside>
    </>
  );
}