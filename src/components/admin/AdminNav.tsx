'use client';

import { useEffect, useRef } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { LayoutDashboard, Users, ShieldCheck, Package, ShoppingBag, Banknote, AlertTriangle, ScrollText } from 'lucide-react';
import { cn } from '@/lib/utils';

const NAV_ITEMS = [
  { href: '/admin', label: 'Dashboard', icon: LayoutDashboard, exact: true },
  { href: '/admin/users', label: 'Users', icon: Users },
  { href: '/admin/verification', label: 'Verification', icon: ShieldCheck },
  { href: '/admin/listings', label: 'Listings', icon: Package },
  { href: '/admin/orders', label: 'Orders', icon: ShoppingBag },
  { href: '/admin/withdrawals', label: 'Withdrawals', icon: Banknote },
  { href: '/admin/disputes', label: 'Disputes', icon: AlertTriangle },
  { href: '/admin/audit', label: 'Activity log', icon: ScrollText },
];

/** Phones: a swipeable tab strip under the header (the active tab scrolls into view). Desktop: the left sidebar. */
export default function AdminNav() {
  const pathname = usePathname();
  const strip = useRef<HTMLElement>(null);

  useEffect(() => {
    strip.current?.querySelector<HTMLElement>('[aria-current="page"]')?.scrollIntoView({ inline: 'center', block: 'nearest' });
  }, [pathname]);

  return (
    <aside className="sticky top-14 z-30 -mx-4 border-b border-gray-100 bg-gray-50/95 backdrop-blur lg:static lg:mx-0 lg:w-56 lg:flex-shrink-0 lg:border-0 lg:bg-transparent lg:backdrop-blur-none">
      <nav ref={strip} aria-label="Admin sections" className="flex gap-2 overflow-x-auto px-4 py-2.5 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden lg:block lg:gap-0 lg:overflow-hidden lg:rounded-2xl lg:border lg:border-gray-100 lg:bg-white lg:p-0 lg:shadow-sm">
        <div className="hidden border-b border-gray-100 p-4 lg:block">
          <p className="text-xs font-semibold uppercase tracking-wider text-gray-400">Admin Panel</p>
        </div>
        {NAV_ITEMS.map((item) => {
          const active = item.exact ? pathname === item.href : pathname.startsWith(item.href);
          return (
            <Link key={item.href} href={item.href} aria-current={active ? 'page' : undefined}
              className={cn(
                'flex shrink-0 items-center gap-2 whitespace-nowrap rounded-full border px-3.5 py-2 text-sm font-semibold transition-colors lg:gap-3 lg:rounded-none lg:border-0 lg:px-4 lg:py-3 lg:font-medium',
                active ? 'border-green-600 bg-green-600 text-white lg:border-r-2 lg:bg-green-50 lg:text-green-700' : 'border-gray-200 bg-white text-gray-600 hover:bg-gray-50 lg:text-gray-600 lg:hover:text-gray-900'
              )}>
              <item.icon className={cn('h-4 w-4', active ? 'text-white lg:text-green-600' : 'text-gray-400')} />
              {item.label}
            </Link>
          );
        })}
      </nav>
    </aside>
  );
}
