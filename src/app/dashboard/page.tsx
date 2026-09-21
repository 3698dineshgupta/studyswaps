import { redirect } from 'next/navigation';
import Link from 'next/link';
import { Metadata } from 'next';
import { ArrowRight, Clock, Eye, Info, Package, Plus, ShoppingBag, Wallet } from 'lucide-react';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { releaseDueFunds } from '@/lib/wallet/release';
import { RevealGroup, RevealItem } from '@/components/ui/Reveal';
import { ORDER_STATUS_LABELS } from '@/lib/constants';
import { SELLER_COMMISSION_RATE, WITHDRAWAL } from '@/lib/pricing';
import { formatPrice, formatRelativeTime } from '@/lib/utils';

export const metadata: Metadata = { title: 'Seller dashboard — StudySwaps' };
export const dynamic = 'force-dynamic';

// NOTE: the layout already renders the site header, dashboard tabs and mobile nav.
export default async function DashboardPage() {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login?redirectTo=/dashboard');

  const { data: profile } = await supabase.from('profiles').select('id, full_name').eq('auth_user_id', user.id).single();
  if (!profile) redirect('/login');

  // Delivered orders unlock their earnings before the balances are read
  await releaseDueFunds(createAdminClient(), profile.id).catch(() => 0);

  const [wallet, listings, orders, active, review] = await Promise.all([
    supabase.from('wallets').select('available_balance, pending_balance, total_earned').eq('seller_id', profile.id).maybeSingle(),
    supabase.from('products').select('id, title, price, status, view_count, created_at').eq('seller_id', profile.id).order('created_at', { ascending: false }).limit(5),
    supabase.from('orders').select('id, order_number, status, subtotal, created_at').eq('seller_id', profile.id).order('created_at', { ascending: false }).limit(5),
    supabase.from('products').select('id', { count: 'exact', head: true }).eq('seller_id', profile.id).eq('status', 'ACTIVE'),
    supabase.from('products').select('id', { count: 'exact', head: true }).eq('seller_id', profile.id).eq('status', 'PENDING_REVIEW'),
  ]);

  const w = wallet.data;
  const views = (listings.data ?? []).reduce((s, l) => s + (l.view_count || 0), 0);
  const stats = [
    { label: 'Active listings', value: active.count ?? 0, Icon: Package, tint: 'bg-sky-50 text-sky-600' },
    { label: 'Awaiting approval', value: review.count ?? 0, Icon: Clock, tint: 'bg-amber-50 text-amber-600' },
    { label: 'Orders', value: orders.data?.length ?? 0, Icon: ShoppingBag, tint: 'bg-violet-50 text-violet-600' },
    { label: 'Views (recent)', value: views, Icon: Eye, tint: 'bg-orange-50 text-orange-600' },
  ];

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-3xl font-extrabold tracking-tight text-ink">Hi {profile.full_name?.split(' ')[0]} 👋</h1>
          <p className="mt-1 text-sm text-ink-muted">Here&apos;s how your selling is going.</p>
        </div>
        <Link href="/sell" className="btn-primary px-5 py-2.5 text-sm"><Plus className="h-4 w-4" /> New listing</Link>
      </div>

      {/* Earnings */}
      <section className="overflow-hidden rounded-3xl bg-ink p-6 text-white shadow-lift sm:p-8">
        <div className="grid gap-6 sm:grid-cols-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-gray-400">Available to withdraw</p>
            <p className="mt-1 font-display text-4xl font-extrabold text-green-400">{formatPrice(Number(w?.available_balance ?? 0))}</p>
          </div>
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-gray-400">Held (pending)</p>
            <p className="mt-1 font-display text-2xl font-bold">{formatPrice(Number(w?.pending_balance ?? 0))}</p>
            <p className="text-xs text-gray-400">Unlocks when delivery is confirmed</p>
          </div>
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-gray-400">Total earned</p>
            <p className="mt-1 font-display text-2xl font-bold">{formatPrice(Number(w?.total_earned ?? 0))}</p>
          </div>
        </div>
        <div className="mt-6 flex flex-wrap items-center justify-between gap-3 border-t border-white/10 pt-5">
          <p className="flex items-center gap-2 text-xs text-gray-300"><Info className="h-4 w-4 shrink-0 text-green-400" /> {SELLER_COMMISSION_RATE * 100}% fee on each sale · withdraw to eSewa from {formatPrice(WITHDRAWAL.minAmount)}</p>
          <Link href="/dashboard/wallet" className="group inline-flex items-center gap-2 rounded-full bg-green-500 px-5 py-2 text-sm font-bold text-ink transition-colors hover:bg-green-400">
            <Wallet className="h-4 w-4" /> Wallet & payout rules <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
          </Link>
        </div>
      </section>

      <RevealGroup className="grid grid-cols-2 gap-3 md:grid-cols-4">
        {stats.map(({ label, value, Icon, tint }) => (
          <RevealItem key={label}>
            <div className="card p-4">
              <span className={`mb-3 flex h-10 w-10 items-center justify-center rounded-xl ${tint}`}><Icon className="h-5 w-5" /></span>
              <p className="font-display text-2xl font-extrabold text-ink">{value}</p>
              <p className="text-xs text-ink-muted">{label}</p>
            </div>
          </RevealItem>
        ))}
      </RevealGroup>

      <div className="grid gap-5 lg:grid-cols-2">
        <section className="card">
          <div className="flex items-center justify-between border-b border-gray-100 p-4">
            <h2 className="font-display font-bold text-ink">Recent listings</h2>
            <Link href="/dashboard/listings" className="text-sm font-semibold text-green-700 hover:text-green-800">View all</Link>
          </div>
          {listings.data?.length ? (
            <ul className="divide-y divide-gray-100">
              {listings.data.map((l) => (
                <li key={l.id}>
                  <Link href={`/product/${l.id}`} className="flex items-center gap-3 p-4 transition-colors hover:bg-gray-50">
                    <div className="min-w-0 flex-1"><p className="truncate text-sm font-medium text-ink">{l.title}</p><p className="text-xs text-ink-muted">{formatRelativeTime(l.created_at)}</p></div>
                    <div className="text-right"><p className="text-sm font-bold text-ink">{formatPrice(l.price)}</p>
                      <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${l.status === 'ACTIVE' ? 'bg-green-100 text-green-700' : l.status === 'SOLD' ? 'bg-gray-100 text-gray-600' : 'bg-amber-100 text-amber-700'}`}>{l.status.replace('_', ' ')}</span></div>
                  </Link>
                </li>
              ))}
            </ul>
          ) : (
            <div className="p-8 text-center"><p className="text-sm text-ink-muted">No listings yet</p><Link href="/sell" className="mt-1 inline-block text-sm font-semibold text-green-700">Create your first listing →</Link></div>
          )}
        </section>

        <section className="card">
          <div className="flex items-center justify-between border-b border-gray-100 p-4">
            <h2 className="font-display font-bold text-ink">Recent orders</h2>
            <Link href="/dashboard/orders" className="text-sm font-semibold text-green-700 hover:text-green-800">View all</Link>
          </div>
          {orders.data?.length ? (
            <ul className="divide-y divide-gray-100">
              {orders.data.map((o) => (
                <li key={o.id}>
                  <Link href="/dashboard/orders" className="flex items-center justify-between gap-3 p-4 transition-colors hover:bg-gray-50">
                    <div><p className="font-mono text-sm font-medium text-ink">#{o.order_number}</p><p className="text-xs text-ink-muted">{formatRelativeTime(o.created_at)}</p></div>
                    <div className="text-right"><p className="text-sm font-bold text-ink">{formatPrice(Number(o.subtotal))}</p><p className="text-xs text-ink-muted">{ORDER_STATUS_LABELS[o.status] ?? o.status}</p></div>
                  </Link>
                </li>
              ))}
            </ul>
          ) : (
            <div className="p-8 text-center text-sm text-ink-muted">No orders yet</div>
          )}
        </section>
      </div>
    </div>
  );
}
