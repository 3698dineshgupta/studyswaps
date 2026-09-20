'use client';

import { useRouter } from 'next/navigation';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { motion } from 'motion/react';
import { BadgeCheck, Bell, CheckCheck, CreditCard, MessageCircle, Package, Star, Tag, Truck, Wallet, type LucideIcon } from 'lucide-react';
import Header from '@/components/layout/Header';
import MobileNav from '@/components/layout/MobileNav';
import EmptyState from '@/components/ui/EmptyState';
import { Skeleton } from '@/components/ui/Skeleton';
import { getSupabase } from '@/lib/supabase/lazy';
import { useAuthState } from '@/components/auth/AuthProvider';
import { fadeUp, stagger } from '@/lib/motion';
import { cn, formatRelativeTime } from '@/lib/utils';


interface Notification {
  id: string; type: string; title: string; body: string; is_read: boolean; created_at: string; action_url: string | null;
}

const ICONS: Record<string, { Icon: LucideIcon; tint: string }> = {
  VERIFICATION_STATUS: { Icon: BadgeCheck, tint: 'bg-green-100 text-green-700' },
  ORDER_UPDATE: { Icon: Package, tint: 'bg-sky-100 text-sky-700' },
  PAYMENT_UPDATE: { Icon: CreditCard, tint: 'bg-emerald-100 text-emerald-700' },
  DELIVERY_UPDATE: { Icon: Truck, tint: 'bg-violet-100 text-violet-700' },
  NEW_MESSAGE: { Icon: MessageCircle, tint: 'bg-amber-100 text-amber-700' },
  WITHDRAWAL_UPDATE: { Icon: Wallet, tint: 'bg-teal-100 text-teal-700' },
  LISTING_STATUS: { Icon: Tag, tint: 'bg-rose-100 text-rose-700' },
  REVIEW_RECEIVED: { Icon: Star, tint: 'bg-yellow-100 text-yellow-700' },
};
const iconFor = (type: string) => ICONS[type] ?? { Icon: Bell, tint: 'bg-gray-100 text-gray-600' };

export default function NotificationsPage() {
  const router = useRouter();
  const qc = useQueryClient();
  const { profile } = useAuthState(); // known from the server-rendered page: no auth + profile lookups first

  const { data, isLoading } = useQuery({
    queryKey: ['notifications', profile?.id],
    queryFn: async () => {
      if (!profile) { router.push('/login?redirectTo=/notifications'); return { profileId: null as string | null, items: [] as Notification[] }; }
      const supabase = await getSupabase();
      const { data: items } = await supabase.from('notifications').select('id, type, title, body, is_read, created_at, action_url').eq('profile_id', profile.id).order('created_at', { ascending: false }).limit(50);
      return { profileId: profile.id as string, items: (items ?? []) as Notification[] };
    },
  });

  const markRead = useMutation({
    mutationFn: async (ids: string[]) => { await (await getSupabase()).from('notifications').update({ is_read: true, read_at: new Date().toISOString() }).in('id', ids); },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['notifications'] }),
  });

  const items = data?.items ?? [];
  const unread = items.filter((n) => !n.is_read);

  const open = (n: Notification) => {
    if (!n.is_read) markRead.mutate([n.id]);
    if (n.action_url) router.push(n.action_url);
  };

  return (
    <>
      <Header />
      <main className="pb-24 lg:pb-0">
        <div className="page-container max-w-3xl py-8 sm:py-10">
          <div className="mb-6 flex items-end justify-between gap-4">
            <div>
              <h1 className="font-display text-3xl font-extrabold tracking-tight text-ink">Notifications</h1>
              {unread.length > 0 && <p className="mt-1 text-sm text-ink-muted">{unread.length} unread</p>}
            </div>
            {unread.length > 0 && (
              <motion.button whileTap={{ scale: 0.96 }} onClick={() => markRead.mutate(unread.map((n) => n.id))} className="flex items-center gap-1.5 rounded-full border border-gray-200 bg-white px-4 py-2 text-sm font-semibold text-ink-soft transition-shadow hover:shadow-soft">
                <CheckCheck className="h-4 w-4 text-green-600" /> Mark all as read
              </motion.button>
            )}
          </div>

          {isLoading ? (
            <div className="space-y-3" role="status" aria-label="Loading notifications">{[0, 1, 2, 3].map((i) => <Skeleton key={i} className="h-20 rounded-2xl" />)}</div>
          ) : items.length === 0 ? (
            <EmptyState illustration="headphones" title="You're all caught up" text="Order updates, messages and verification results will show up here." action={{ label: 'Explore Marketplace', href: '/browse' }} />
          ) : (
            <motion.ul variants={stagger(0.05)} initial="hidden" animate="show" className="space-y-2.5">
              {items.map((n) => {
                const { Icon, tint } = iconFor(n.type);
                return (
                  <motion.li key={n.id} variants={fadeUp}>
                    <button onClick={() => open(n)} className={cn('group flex w-full items-start gap-4 rounded-2xl border p-4 text-left transition-all hover:-translate-y-0.5 hover:shadow-lift', n.is_read ? 'border-gray-200/70 bg-white' : 'border-green-200 bg-green-50/60')}>
                      <span className={cn('flex h-11 w-11 shrink-0 items-center justify-center rounded-xl', tint)}><Icon className="h-5 w-5" /></span>
                      <span className="min-w-0 flex-1">
                        <span className="flex items-start justify-between gap-3">
                          <span className="font-display font-semibold text-ink">{n.title}</span>
                          <span className="shrink-0 text-xs text-ink-muted">{formatRelativeTime(n.created_at)}</span>
                        </span>
                        <span className="mt-0.5 block text-sm leading-relaxed text-ink-soft">{n.body}</span>
                      </span>
                      {!n.is_read && <span className="mt-2 h-2.5 w-2.5 shrink-0 rounded-full bg-green-600" aria-label="Unread" />}
                    </button>
                  </motion.li>
                );
              })}
            </motion.ul>
          )}
        </div>
      </main>
      <MobileNav />
    </>
  );
}
