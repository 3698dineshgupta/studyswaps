'use client';

import Link from 'next/link';
import Image from 'next/image';
import { AnimatePresence, motion } from 'motion/react';
import { ArrowRight, BadgeCheck, Lock, Minus, Plus, Store, Trash2 } from 'lucide-react';
import { useCart } from '@/hooks/useCart';
import CheckoutProgress from '@/components/checkout/CheckoutProgress';
import EmptyState from '@/components/ui/EmptyState';
import AnimatedNumber from '@/components/ui/AnimatedNumber';
import Price from '@/components/ui/Price';
import LocationBadge from '@/components/ui/LocationBadge';
import SellerBadge from '@/components/shared/SellerBadge';
import { Skeleton } from '@/components/ui/Skeleton';
import { DELIVERY, PLATFORM_FEE } from '@/lib/pricing';
import { listItem, SPRING } from '@/lib/motion';
import { formatPrice, getSupabaseImageUrl, isCloudinaryUrl } from '@/lib/utils';

/* eslint-disable @typescript-eslint/no-explicit-any */
type CartItem = any;

/** Second-hand items are one-of-a-kind, so the maximum quantity is 1 (enforced by the API too). */
function QuantityStepper({ quantity }: { quantity: number }) {
  const max = 1;
  return (
    <div className="inline-flex items-center rounded-full border border-gray-200 bg-white text-sm" title="One-of-a-kind item — only one available">
      <button disabled aria-label="Decrease quantity" className="flex h-8 w-8 items-center justify-center rounded-full text-gray-300"><Minus className="h-3.5 w-3.5" /></button>
      <span className="w-6 text-center font-semibold tabular-nums" aria-live="polite">{quantity}</span>
      <button disabled={quantity >= max} aria-label="Increase quantity" className="flex h-8 w-8 items-center justify-center rounded-full text-gray-300"><Plus className="h-3.5 w-3.5" /></button>
    </div>
  );
}

function CartSkeleton() {
  return (
    <div className="grid gap-6 lg:grid-cols-3" role="status" aria-label="Loading your cart">
      <div className="space-y-3 lg:col-span-2">
        {[0, 1].map((i) => (
          <div key={i} className="card flex gap-4 p-4">
            <Skeleton className="h-28 w-28 shrink-0 rounded-xl" />
            <div className="flex-1 space-y-3"><Skeleton className="h-4 w-3/4" /><Skeleton className="h-3 w-1/3" /><Skeleton className="h-6 w-1/4" /></div>
          </div>
        ))}
      </div>
      <Skeleton className="h-64 rounded-2xl" />
    </div>
  );
}

export default function CartPage() {
  const { items, total, isLoading, removeFromCart, isRemoving } = useCart();

  const savings = (items as CartItem[]).reduce((sum, it) => {
    const p = it.product;
    return sum + (p?.original_price && p.original_price > p.price ? (p.original_price - p.price) * it.quantity : 0);
  }, 0);
  const minDelivery = DELIVERY.baseFee;

  return (
    <div className="page-container max-w-6xl py-8 sm:py-10">
      <CheckoutProgress current={0} />

      <div className="mb-6 flex items-end justify-between">
        <h1 className="font-display text-3xl font-extrabold tracking-tight text-ink">Your cart</h1>
        {items.length > 0 && <p className="text-sm text-ink-muted">{items.length} {items.length === 1 ? 'item' : 'items'}</p>}
      </div>

      {isLoading ? (
        <CartSkeleton />
      ) : items.length === 0 ? (
        <EmptyState illustration="backpack" title="Your cart is empty" text="Save a few finds and they'll be waiting here. Your next campus bargain is one tap away." action={{ label: 'Explore Marketplace', href: '/browse' }} />
      ) : (
        <div className="grid items-start gap-6 lg:grid-cols-3">
          <ul className="space-y-3 lg:col-span-2">
            <AnimatePresence initial={false} mode="popLayout">
              {(items as CartItem[]).map((item) => {
                const p = item.product;
                const img = p.product_images?.find((i: any) => i.is_primary) ?? p.product_images?.[0];
                const src = img ? getSupabaseImageUrl(img.storage_path, 300) : null;
                return (
                  <motion.li key={item.id} layout transition={SPRING.soft} {...listItem} className="card flex gap-4 p-3.5 sm:p-4">
                    <Link href={`/product/${p.id}`} className="relative h-24 w-24 shrink-0 overflow-hidden rounded-xl bg-gray-100 sm:h-28 sm:w-28">
                      {src && <Image src={src} alt={p.title} fill sizes="112px" unoptimized={isCloudinaryUrl(src)} className="object-cover transition-transform duration-500 hover:scale-105" />}
                    </Link>

                    <div className="flex min-w-0 flex-1 flex-col">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <Link href={`/product/${p.id}`} className="line-clamp-2 font-display font-semibold leading-snug text-ink transition-colors hover:text-green-700">{p.title}</Link>
                          <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1">
                            <SellerBadge name={p.seller?.full_name} verified={p.seller?.verification_status === 'VERIFIED'} />
                            <LocationBadge location={p.location} />
                          </div>
                        </div>
                        <motion.button
                          whileTap={{ scale: 0.85 }}
                          onClick={() => removeFromCart(item.id)}
                          disabled={isRemoving}
                          aria-label={`Remove ${p.title} from cart`}
                          className="rounded-full p-2 text-gray-400 transition-colors hover:bg-red-50 hover:text-red-500 disabled:opacity-50"
                        >
                          <Trash2 className="h-4 w-4" />
                        </motion.button>
                      </div>

                      <div className="mt-auto flex items-end justify-between pt-3">
                        <QuantityStepper quantity={item.quantity} />
                        <Price value={p.price * item.quantity} original={p.original_price ? p.original_price * item.quantity : null} size="md" />
                      </div>
                    </div>
                  </motion.li>
                );
              })}
            </AnimatePresence>
          </ul>

          {/* Summary */}
          <aside className="lg:sticky lg:top-32">
            <div className="card p-5 sm:p-6">
              <h2 className="mb-4 font-display text-lg font-bold text-ink">Order summary</h2>
              <dl className="space-y-3 text-sm">
                <div className="flex justify-between"><dt className="text-ink-muted">Subtotal</dt><dd className="font-semibold"><AnimatedNumber value={total} format={formatPrice} /></dd></div>
                <div className="flex justify-between"><dt className="text-ink-muted">Delivery</dt><dd className="text-right font-medium text-ink-soft">from {formatPrice(minDelivery)}<span className="block text-[11px] font-normal text-ink-muted">set by distance at checkout</span></dd></div>
                <div className="flex justify-between"><dt className="text-ink-muted">Platform fee</dt><dd className="font-medium text-ink-soft">{formatPrice(PLATFORM_FEE)}</dd></div>
                <div className="flex justify-between"><dt className="text-ink-muted">Discount</dt><dd className={savings > 0 ? 'font-semibold text-green-700' : 'text-ink-muted'}>{savings > 0 ? `You save ${formatPrice(savings)}` : '—'}</dd></div>
                <div className="flex items-baseline justify-between border-t border-gray-100 pt-4">
                  <dt className="font-semibold text-ink">Total</dt>
                  <dd className="font-display text-2xl font-extrabold text-ink"><AnimatedNumber value={total + PLATFORM_FEE} format={formatPrice} /></dd>
                </div>
                <p className="text-[11px] text-ink-muted">Before delivery. Your delivery fee is confirmed once you enter your address.</p>
              </dl>

              <motion.div whileHover={{ y: -1 }} whileTap={{ scale: 0.98 }} className="mt-5">
                <Link href="/checkout" className="btn-primary flex w-full py-3.5 text-base">
                  Proceed to Checkout <ArrowRight className="h-4 w-4" />
                </Link>
              </motion.div>
              <Link href="/browse" className="mt-3 block text-center text-sm font-medium text-ink-muted transition-colors hover:text-ink">Continue shopping</Link>

              <ul className="mt-5 space-y-2.5 border-t border-gray-100 pt-5 text-xs text-ink-muted">
                <li className="flex items-center gap-2"><Lock className="h-3.5 w-3.5 text-green-600" /> Secure eSewa payment</li>
                <li className="flex items-center gap-2"><Store className="h-3.5 w-3.5 text-green-600" /> Pickup hubs inside your city</li>
                <li className="flex items-center gap-2"><BadgeCheck className="h-3.5 w-3.5 text-green-600" /> Verified student sellers</li>
              </ul>
            </div>
          </aside>
        </div>
      )}
    </div>
  );
}
