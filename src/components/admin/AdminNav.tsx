'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { LayoutDashboard, Users, ShieldCheck, Package, ShoppingBag, Banknote, AlertTriangle, ScrollText } from 'lucide-react';
import { cn } from '@/lib/utils';

const NAV_ITEMS = [
  { href: '/admin', label: 'Dashboard', icon: LayoutDashboard, exact: true },
  { href: '/admin/users', label: 'Users', icon: Users },
  { href: '/admin/verification', label: 'Verification', icon: ShieldCheck },
  { href: '/admin/listings', label: 'Listings (approve)', icon: Package },
  { href: '/admin/orders', label: 'Orders', icon: ShoppingBag },
  { href: '/admin/withdrawals', label: 'Withdrawals', icon: Banknote },
  { href: '/admin/disputes', label: 'Disputes', icon: AlertTriangle },
  { href: '/admin/audit', label: 'Activity log', icon: ScrollText },
];

export default function AdminNav() {
  const pathname = usePathname();

  return (
    <aside className="w-56 flex-shrink-0">
      <nav className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="p-4 border-b border-gray-100">
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Admin Panel</p>
        </div>
        {NAV_ITEMS.map(item => {
          const active = item.exact ? pathname === item.href : pathname.startsWith(item.href);
          return (
            <Link key={item.href} href={item.href}
              className={cn(
                'flex items-center gap-3 px-4 py-3 text-sm font-medium transition-colors',
                active ? 'bg-green-50 text-green-700 border-r-2 border-green-600' : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
              )}>
              <item.icon className={cn('w-4 h-4', active ? 'text-green-600' : 'text-gray-400')} />
              {item.label}
            </Link>
          );
        })}
      </nav>
    </aside>
  );
}
