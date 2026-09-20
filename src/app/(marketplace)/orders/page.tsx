'use client';

import { useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { useQuery } from '@tanstack/react-query';
import { motion } from 'motion/react';
import { ChevronRight } from 'lucide-react';
import Tabs from '@/components/ui/Tabs';
import EmptyState from '@/components/ui/EmptyState';
import { Skeleton } from '@/components/ui/Skeleton';
import { TRACK_STEPS, trackIndex } from '@/components/orders/OrderTracker';
import { ORDER_STATUS_LABELS } from '@/lib/constants';
import { fadeUp, stagger, EASE } from '@/lib/motion';
import { cn, formatPrice, formatRelativeTime, getSupabaseImageUrl, isCloudinaryUrl } from '@/lib/utils';

/* eslint-disable @typescript-eslint/no-explicit-any */
type Tab = 'ongoing' | 'completed';

const PILL: Record<string, string> = {
  COMPLETED: 'bg-green-100 text-green-800', BUYER_CONFIRMED: 'bg-green-100 text-green-800', DELIVERED: 'bg-green-100 text-green-800',
  CANCELLED: 'bg-red-100 text-red-700', REFUNDED: 'bg-red-100 text-red-700', RETURNED: 'bg-red-100 text-red-700',
  PAYMENT_PENDING: 'bg-amber-100 text-amber-800', CREATED: 'bg-gray-100 text-gray-700',
};

export default function OrdersPage() {
  const [tab, setTab] = useState<Tab>('ongoing');

  const { data, isLoading } = useQuery({
    queryKey: ['orders', tab],
    queryFn: async () => {
      const res = await fetch(`/api/orders?status=${tab}`);
      if (!res.ok) throw new Error('Failed to fetch orders');
      return res.json();
    },
  });
  const orders: any[] = data?.orders ?? [];

  return (
    <div className="page-container max-w-4xl py-8 sm:py-10">
      <div className="mb-6">
        <h1 className="font-display text-3xl font-extrabold tracking-tight text-ink">My purchases</h1>
        <p className="mt-1 text-sm text-ink-muted">Track what&apos;s on its way and revisit what you&apos;ve bought.</p>
      </div>

      <Tabs<Tab> tabs={[{ id: 'ongoing', label: 'Ongoing' }, { id: 'completed', label: 'Completed' }]} value={tab} onChange={setTab} className="mb-6" />

      {isLoading ? (
        <div className="space-y-3" role="status" aria-label="Loading orders">
          {[0, 1, 2].map((i) => <Skeleton key={i} className="h-32 rounded-2xl" />)}
        </div>
      ) : orders.length === 0 ? (
        <EmptyState
          illustration={tab === 'ongoing' ? 'backpack' : 'bookStack'}
          title={tab === 'ongoing' ? 'No orders yet.' : 'Nothing completed yet'}
          text={tab === 'ongoing' ? 'Your next campus find is waiting.' : 'Finished orders will show up here.'}
          action={{ label: 'Explore Marketplace', href: '/browse' }}
        />
      ) : (
        <motion.ul key={tab} variants={stagger(0.06)} initial="hidden" animate="show" className="space-y-3">
          {orders.map((order) => {
            const first = order.order_items?.[0];
            const more = (order.order_items?.length ?? 0) - 1;
            const img = first?.product?.product_images?.[0];
            const src = img ? getSupabaseImageUrl(img.storage_path, 240) : null;
            const step = trackIndex(order.status);
            const pct = ['COMPLETED', 'BUYER_CONFIRMED'].includes(order.status) ? 100 : (step / (TRACK_STEPS.length - 1)) * 100;
            const finished = tab === 'completed';
            return (
              <motion.li key={order.id} variants={fadeUp}>
                <Link href={`/orders/${order.id}`} className="card-hover group flex gap-4 p-4 sm:p-5">
                  <div className="relative h-20 w-20 shrink-0 overflow-hidden rounded-xl bg-gray-100 sm:h-24 sm:w-24">
                    {src && <Image src={src} alt={first.product.title} fill sizes="96px" unoptimized={isCloudinaryUrl(src)} className="object-cover transition-transform duration-500 group-hover:scale-105" />}
                  </div>
                  <div className="flex min-w-0 flex-1 flex-col">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="font-mono text-[11px] font-semibold text-ink-muted">#{order.order_number}</p>
                        <h2 className="line-clamp-1 font-display text-base font-semibold text-ink">
                          {first?.product?.title}{more > 0 && <span className="text-ink-muted"> +{more} more</span>}
                        </h2>
                      </div>
                      <span className={cn('shrink-0 rounded-full px-2.5 py-1 text-xs font-semibold', PILL[order.status] ?? 'bg-green-100 text-green-800')}>
                        {ORDER_STATUS_LABELS[order.status] ?? order.status}
                      </span>
                    </div>

                    {!finished && (
                      <div className="mt-3" aria-hidden>
                        <div className="h-1.5 overflow-hidden rounded-full bg-gray-100">
                          <motion.div className="h-full rounded-full bg-gradient-to-r from-green-500 to-emerald-500" initial={{ width: 0 }} animate={{ width: `${Math.max(pct, 6)}%` }} transition={{ duration: 0.9, ease: EASE, delay: 0.2 }} />
                        </div>
                        <p className="mt-1 text-[11px] text-ink-muted">Step {Math.min(step + 1, TRACK_STEPS.length)} of {TRACK_STEPS.length} · {TRACK_STEPS[Math.min(step, TRACK_STEPS.length - 1)].label}</p>
                      </div>
                    )}

                    <div className="mt-auto flex items-center justify-between pt-3">
                      <span className="text-xs text-ink-muted">{formatRelativeTime(order.created_at)}</span>
                      <span className="flex items-center gap-1 font-display font-bold text-ink">
                        {formatPrice(order.total_amount)}
                        <ChevronRight className="h-4 w-4 text-gray-300 transition-transform group-hover:translate-x-0.5 group-hover:text-green-600" />
                      </span>
                    </div>
                  </div>
                </Link>
              </motion.li>
            );
          })}
        </motion.ul>
      )}
    </div>
  );
}
