'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { LayoutGroup, motion } from 'motion/react';
import { LayoutDashboard, Package, ShoppingBag, Wallet } from 'lucide-react';
import { SPRING } from '@/lib/motion';
import { cn } from '@/lib/utils';

const NAV_ITEMS = [
  { href: '/dashboard', label: 'Overview', Icon: LayoutDashboard, exact: true },
  { href: '/dashboard/listings', label: 'Listings', Icon: Package },
  { href: '/dashboard/orders', label: 'Orders', Icon: ShoppingBag },
  { href: '/dashboard/wallet', label: 'Wallet', Icon: Wallet },
];

/** Seller dashboard tabs with a sliding active pill. */
export default function DashboardNav() {
  const pathname = usePathname();
  return (
    <LayoutGroup id="dashboard-nav">
      <nav aria-label="Seller dashboard" className="no-scrollbar mb-8 flex gap-1 overflow-x-auto rounded-2xl border border-gray-200/70 bg-white p-1.5 shadow-soft">
        {NAV_ITEMS.map(({ href, label, Icon, exact }) => {
          const active = exact ? pathname === href : pathname.startsWith(href);
          return (
            <Link key={href} href={href} aria-current={active ? 'page' : undefined} className={cn('relative flex shrink-0 items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold transition-colors', active ? 'text-green-800' : 'text-ink-muted hover:text-ink')}>
              {active && <motion.span layoutId="dash-pill" transition={SPRING.snappy} className="absolute inset-0 rounded-xl bg-green-100" />}
              <Icon className="relative h-4 w-4" />
              <span className="relative">{label}</span>
            </Link>
          );
        })}
      </nav>
    </LayoutGroup>
  );
}
