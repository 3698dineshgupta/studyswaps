'use client';

import Link from 'next/link';
import { AlertTriangle, ArrowRight, Banknote, Package, ShieldCheck, ShoppingBag, Truck, Users } from 'lucide-react';
import { Empty, Loading, PageTitle, useAdminData } from '@/components/admin/kit';
import { formatPrice, formatRelativeTime } from '@/lib/utils';

/* eslint-disable @typescript-eslint/no-explicit-any */

export default function AdminDashboardPage() {
  const { data, loading, error } = useAdminData<any>('/api/admin/stats', {});
  if (loading) return <Loading />;
  if (error || !data) return <Empty text={error || 'Could not load the dashboard'} />;
  const a = data.attention, t = data.totals;

  const todo = [
    { label: 'Listings waiting for approval', n: a.pendingListings, href: '/admin/listings', Icon: Package },
    { label: 'Identity checks to review', n: a.pendingVerifications, href: '/admin/verification', Icon: ShieldCheck },
    { label: 'Withdrawals to pay', n: a.pendingWithdrawals, href: '/admin/withdrawals', Icon: Banknote },
    { label: 'Open disputes', n: a.openDisputes, href: '/admin/disputes', Icon: AlertTriangle },
    { label: 'Orders in progress', n: a.ordersInProgress, href: '/admin/orders', Icon: Truck },
  ];

  return (
    <div>
      <PageTitle title="Dashboard" hint="What needs you right now, and how StudySwaps is doing." />

      <section aria-label="Needs attention" className="mb-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {todo.map(({ label, n, href, Icon }) => (
          <Link key={label} href={href} className={`group flex items-center gap-4 rounded-2xl border p-4 transition-shadow hover:shadow-md ${n > 0 && label !== 'Orders in progress' ? 'border-amber-200 bg-amber-50' : 'border-gray-200 bg-white'}`}>
            <span className={`flex h-11 w-11 items-center justify-center rounded-xl ${n > 0 && label !== 'Orders in progress' ? 'bg-amber-100 text-amber-700' : 'bg-gray-100 text-gray-500'}`}><Icon className="h-5 w-5" /></span>
            <span className="flex-1"><span className="block font-display text-2xl font-extrabold text-gray-900">{n}</span><span className="text-sm text-gray-600">{label}</span></span>
            <ArrowRight className="h-4 w-4 text-gray-400 transition-transform group-hover:translate-x-1" />
          </Link>
        ))}
      </section>

      <section aria-label="Business" className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
        {[
          { label: 'Live listings', v: t.activeListings, Icon: Package },
          { label: 'Members', v: `${t.users} (+${t.newUsers7d} this week)`, Icon: Users },
          { label: 'Orders today', v: t.ordersToday, Icon: ShoppingBag },
          { label: 'Sales, last 30 days', v: formatPrice(t.gross30d), Icon: Banknote },
        ].map(({ label, v, Icon }) => (
          <div key={label} className="rounded-2xl border border-gray-200 bg-white p-4"><Icon className="mb-2 h-5 w-5 text-green-600" /><p className="font-display text-xl font-extrabold text-gray-900">{v}</p><p className="text-xs text-gray-500">{label}</p></div>
        ))}
        <div className="col-span-2 rounded-2xl bg-ink p-4 text-white lg:col-span-4">
          <p className="text-xs font-semibold uppercase tracking-wider text-gray-400">StudySwaps earned (30 days)</p>
          <p className="font-display text-3xl font-extrabold text-green-400">{formatPrice(t.platformShare30d)}</p>
          <p className="text-xs text-gray-400">Delivery fees + platform fees + 5% seller commission on paid orders.</p>
        </div>
      </section>

      <section aria-label="Recent activity" className="rounded-2xl border border-gray-200 bg-white">
        <div className="flex items-center justify-between border-b border-gray-100 p-4"><h2 className="font-display font-bold text-gray-900">Recent activity</h2><Link href="/admin/audit" className="text-sm font-semibold text-green-700">See all</Link></div>
        <ul className="divide-y divide-gray-100">
          {data.recent.length === 0 && <li className="p-6 text-center text-sm text-gray-500">Nothing yet.</li>}
          {data.recent.map((r: any) => (
            <li key={r.id} className="flex items-center justify-between gap-3 px-4 py-3 text-sm"><span className="font-semibold text-gray-800">{r.action}</span><span className="truncate text-xs text-gray-500">{r.actor_email ?? 'system'} · {formatRelativeTime(r.created_at)}</span></li>
          ))}
        </ul>
      </section>
    </div>
  );
}
