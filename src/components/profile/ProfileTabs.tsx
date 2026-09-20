'use client';

import { useState } from 'react';
import Link from 'next/link';
import { AnimatePresence, motion } from 'motion/react';
import Tabs from '@/components/ui/Tabs';
import ProductGrid from '@/components/marketplace/ProductGrid';
import type { CardProduct } from '@/components/marketplace/ProductCard';
import EmptyState from '@/components/ui/EmptyState';
import Rating from '@/components/ui/Rating';
import { ORDER_STATUS_LABELS } from '@/lib/constants';
import { DURATION, EASE } from '@/lib/motion';
import { formatDate, formatPrice } from '@/lib/utils';

type TabId = 'listings' | 'orders' | 'reviews' | 'saved';

interface OrderRow { id: string; order_number: string; status: string; total: number; created_at: string; title: string }
interface ReviewRow { id: string; rating: number; title: string | null; content: string | null; created_at: string }

interface Props { listings: CardProduct[]; orders: OrderRow[]; reviews: ReviewRow[]; saved: CardProduct[] }

export default function ProfileTabs({ listings, orders, reviews, saved }: Props) {
  const [tab, setTab] = useState<TabId>('listings');

  return (
    <div>
      <Tabs<TabId>
        value={tab}
        onChange={setTab}
        tabs={[
          { id: 'listings', label: 'Listings', count: listings.length },
          { id: 'orders', label: 'Orders', count: orders.length },
          { id: 'reviews', label: 'Reviews', count: reviews.length },
          { id: 'saved', label: 'Saved', count: saved.length },
        ]}
      />

      <AnimatePresence mode="wait" initial={false}>
        <motion.div key={tab} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }} transition={{ duration: DURATION.normal, ease: EASE }} className="pt-6">
          {tab === 'listings' && (listings.length ? <ProductGrid products={listings} /> : <EmptyState illustration="bookStack" title="Ready to sell something?" text="List a book, gadget or hostel item and reach students near you." action={{ label: 'Start Selling', href: '/sell' }} />)}

          {tab === 'orders' && (orders.length ? (
            <ul className="space-y-3">
              {orders.map((o) => (
                <li key={o.id}>
                  <Link href={`/orders/${o.id}`} className="card-hover flex items-center justify-between gap-4 p-4">
                    <div className="min-w-0">
                      <p className="font-mono text-[11px] font-semibold text-ink-muted">#{o.order_number}</p>
                      <p className="truncate font-display font-semibold text-ink">{o.title}</p>
                      <p className="text-xs text-ink-muted">{formatDate(o.created_at)}</p>
                    </div>
                    <div className="shrink-0 text-right">
                      <p className="font-display font-bold text-ink">{formatPrice(o.total)}</p>
                      <p className="text-xs font-medium text-green-700">{ORDER_STATUS_LABELS[o.status] ?? o.status}</p>
                    </div>
                  </Link>
                </li>
              ))}
            </ul>
          ) : <EmptyState illustration="backpack" title="No orders yet." text="Your next campus find is waiting." action={{ label: 'Explore Marketplace', href: '/browse' }} />)}

          {tab === 'reviews' && (reviews.length ? (
            <ul className="space-y-3">
              {reviews.map((r) => (
                <li key={r.id} className="card p-5">
                  <Rating value={r.rating} />
                  {r.title && <p className="mt-1.5 font-display font-semibold text-ink">{r.title}</p>}
                  {r.content && <p className="mt-1 text-sm text-ink-soft">{r.content}</p>}
                  <p className="mt-2 text-xs text-ink-muted">{formatDate(r.created_at)}</p>
                </li>
              ))}
            </ul>
          ) : <EmptyState illustration="productCard" title="No reviews yet" text="Reviews from buyers appear here after your first completed sale." />)}

          {tab === 'saved' && (saved.length ? <ProductGrid products={saved} /> : <EmptyState illustration="productCard" title="Your wishlist is waiting." text="Save products you want to keep an eye on." action={{ label: 'Explore Marketplace', href: '/browse' }} />)}
        </motion.div>
      </AnimatePresence>
    </div>
  );
}
