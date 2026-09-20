'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { useParams, useSearchParams } from 'next/navigation';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { motion } from 'motion/react';
import toast from 'react-hot-toast';
import { AlertCircle, ArrowLeft, CheckCircle2, Copy, CreditCard, LifeBuoy, MapPin, MessageCircle, Store, Truck } from 'lucide-react';
import OrderTracker from '@/components/orders/OrderTracker';
import Button from '@/components/ui/Button';
import EmptyState from '@/components/ui/EmptyState';
import { Skeleton } from '@/components/ui/Skeleton';
import SellerBadge from '@/components/shared/SellerBadge';
import LocationBadge from '@/components/ui/LocationBadge';
import { Reveal, RevealGroup, RevealItem } from '@/components/ui/Reveal';
import { startEsewaPayment } from '@/lib/esewa/client';
import { PRODUCT_CONDITIONS, ORDER_STATUS_LABELS, supportWhatsAppUrl } from '@/lib/constants';
import { cn, formatDate, formatPrice, getSupabaseImageUrl, isCloudinaryUrl } from '@/lib/utils';

/* eslint-disable @typescript-eslint/no-explicit-any */

const STATUS_STYLE: Record<string, string> = {
  COMPLETED: 'bg-green-100 text-green-800', BUYER_CONFIRMED: 'bg-green-100 text-green-800', DELIVERED: 'bg-green-100 text-green-800',
  CANCELLED: 'bg-red-100 text-red-700', REFUNDED: 'bg-red-100 text-red-700', RETURNED: 'bg-red-100 text-red-700', DISPUTED: 'bg-red-100 text-red-700',
  CREATED: 'bg-gray-100 text-gray-700', PAYMENT_PENDING: 'bg-amber-100 text-amber-800',
};
const INACTIVE = ['COMPLETED', 'BUYER_CONFIRMED', 'CANCELLED', 'REFUNDED', 'RETURNED', 'DISPUTED', 'DELIVERED'];

function OrderSkeleton() {
  return (
    <div className="space-y-5" role="status" aria-label="Loading order">
      <Skeleton className="h-40 rounded-3xl" />
      <Skeleton className="h-36 rounded-2xl" />
      <div className="grid gap-5 lg:grid-cols-3"><Skeleton className="h-64 rounded-2xl lg:col-span-2" /><Skeleton className="h-64 rounded-2xl" /></div>
    </div>
  );
}

function InfoRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-4 py-2 text-sm">
      <dt className="shrink-0 text-ink-muted">{label}</dt>
      <dd className="text-right font-medium text-ink">{children}</dd>
    </div>
  );
}

export default function OrderDetailPage() {
  const { id } = useParams<{ id: string }>();
  const paymentResult = useSearchParams().get('payment');
  const qc = useQueryClient();
  // Paid → the bought items just left the cart; cancelled → the cart still has them. Either way, show the truth.
  useEffect(() => { if (paymentResult) qc.invalidateQueries({ queryKey: ['cart'] }); }, [paymentResult, qc]);
  const [paying, setPaying] = useState(false);

  const { data: order, isLoading } = useQuery({
    queryKey: ['order', id],
    queryFn: async () => {
      const res = await fetch(`/api/orders/${id}`);
      if (!res.ok) throw new Error('Order not found');
      return (await res.json()).order;
    },
  });

  const handlePayNow = async () => {
    setPaying(true);
    try { await startEsewaPayment(id); } catch (err) { toast.error((err as Error).message); setPaying(false); }
  };

  const copyNumber = async () => {
    try { await navigator.clipboard.writeText(order.order_number); toast.success('Order number copied'); } catch { toast.error('Could not copy'); }
  };

  if (isLoading) return <div className="page-container max-w-5xl py-8"><OrderSkeleton /></div>;

  if (!order) {
    return <EmptyState illustration="productCard" title="Order not found" text="This order may not exist, or it belongs to another account." action={{ label: 'View my orders', href: '/orders' }} />;
  }

  const items: any[] = order.order_items ?? [];
  const first = items[0];
  const more = items.length - 1;
  const events = order.delivery?.delivery_events ?? [];
  const needsPayment = ['CREATED', 'PAYMENT_PENDING'].includes(order.status);
  const problem = ['CANCELLED', 'REFUNDED', 'RETURNED', 'DISPUTED'].includes(order.status);
  const isHome = order.delivery_address?.type === 'home';
  const active = !INACTIVE.includes(order.status);
  const subtotal = items.reduce((s, it) => s + it.unit_price * it.quantity, 0);

  return (
    <div className="page-container max-w-5xl py-6 sm:py-8">
      <Link href="/orders" className="group mb-5 inline-flex items-center gap-2 text-sm font-medium text-ink-muted transition-colors hover:text-ink">
        <ArrowLeft className="h-4 w-4 transition-transform group-hover:-translate-x-0.5" /> My orders
      </Link>

      {/* Payment banners */}
      {paymentResult === 'success' && (
        <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} className="mb-5 flex items-center gap-3 rounded-2xl border border-green-200 bg-green-50 p-4 text-sm font-medium text-green-800">
          <CheckCircle2 className="h-5 w-5 shrink-0" /> Payment received via eSewa. The seller has been notified.
        </motion.div>
      )}
      {paymentResult === 'failed' && order.status !== 'PAYMENT_CONFIRMED' && (
        <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} className="mb-5 flex items-center gap-3 rounded-2xl border border-red-200 bg-red-50 p-4 text-sm font-medium text-red-800">
          <AlertCircle className="h-5 w-5 shrink-0" /> Your eSewa payment was not completed. You have not been charged — your items are still in your cart, and you can try again below.
        </motion.div>
      )}

      {/* Order hero */}
      <Reveal>
        <section className="relative overflow-hidden rounded-3xl border border-gray-200/70 bg-white p-5 shadow-soft sm:p-7">
          <div className="pointer-events-none absolute -right-16 -top-16 h-56 w-56 rounded-full bg-green-100/70 blur-3xl" />
          <div className="relative flex flex-wrap items-start justify-between gap-5">
            <div className="flex min-w-0 items-center gap-4">
              <div className="relative h-20 w-20 shrink-0 overflow-hidden rounded-2xl bg-gray-100 sm:h-24 sm:w-24">
                {first?.product?.product_images?.[0] && (() => {
                  const src = getSupabaseImageUrl(first.product.product_images[0].storage_path, 240);
                  return <Image src={src} alt={first.product.title} fill sizes="96px" unoptimized={isCloudinaryUrl(src)} className="object-cover" />;
                })()}
              </div>
              <div className="min-w-0">
                <button onClick={copyNumber} className="group inline-flex items-center gap-1.5 font-mono text-xs font-semibold text-ink-muted transition-colors hover:text-ink" aria-label="Copy order number">
                  Order #{order.order_number} <Copy className="h-3 w-3 opacity-0 transition-opacity group-hover:opacity-100" />
                </button>
                <h1 className="mt-1 line-clamp-2 font-display text-xl font-extrabold leading-tight tracking-tight text-ink sm:text-2xl">
                  {first?.product?.title}{more > 0 && <span className="text-ink-muted"> +{more} more</span>}
                </h1>
                <p className="mt-1 font-display text-2xl font-extrabold text-green-700">{formatPrice(order.total_amount)}</p>
              </div>
            </div>

            <div className="flex flex-col items-start gap-2 sm:items-end">
              <span className={cn('inline-flex items-center gap-2 rounded-full px-3.5 py-1.5 text-sm font-semibold', STATUS_STYLE[order.status] ?? 'bg-green-100 text-green-800')}>
                {active && (
                  <span className="relative flex h-2.5 w-2.5">
                    <span className="absolute inline-flex h-full w-full animate-pulse-ring rounded-full bg-current opacity-60" />
                    <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-current" />
                  </span>
                )}
                {ORDER_STATUS_LABELS[order.status] ?? order.status.replace(/_/g, ' ')}
              </span>
              <p className="text-sm text-ink-muted">Order placed · {formatDate(order.created_at)}</p>
            </div>
          </div>

          {needsPayment && (
            <div className="relative mt-5 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-amber-200 bg-amber-50 p-4">
              <p className="text-sm font-medium text-amber-900">This order is waiting for payment.</p>
              <Button onClick={handlePayNow} loading={paying} size="sm"><CreditCard className="h-4 w-4" /> Pay {formatPrice(order.total_amount)} with eSewa</Button>
            </div>
          )}
        </section>
      </Reveal>

      {/* Tracking */}
      <Reveal delay={0.05}>
        <section className="mt-5 rounded-2xl border border-gray-200/70 bg-white p-5 shadow-soft sm:p-7" aria-labelledby="track-heading">
          <div className="mb-6 flex items-center justify-between">
            <h2 id="track-heading" className="font-display text-lg font-bold text-ink">Order tracking</h2>
            {!problem && active && <span className="text-xs font-medium text-green-700">Updates automatically</span>}
          </div>
          {problem ? (
            <div className="rounded-xl bg-red-50 p-4 text-sm text-red-800">This order is {ORDER_STATUS_LABELS[order.status]?.toLowerCase() ?? order.status.toLowerCase()}. If you have questions, message the seller from this page.</div>
          ) : (
            <OrderTracker status={order.status} events={events} />
          )}
        </section>
      </Reveal>

      {/* Details */}
      <RevealGroup className="mt-5 grid items-start gap-5 lg:grid-cols-3">
        <div className="space-y-5 lg:col-span-2">
          {/* Product(s) */}
          <RevealItem>
            <section className="rounded-2xl border border-gray-200/70 bg-white p-5 shadow-soft sm:p-6">
              <h2 className="mb-4 font-display text-lg font-bold text-ink">Your {items.length > 1 ? 'items' : 'item'}</h2>
              <ul className="divide-y divide-gray-100">
                {items.map((it) => {
                  const p = it.product;
                  const img = p.product_images?.find((i: any) => i.is_primary) ?? p.product_images?.[0];
                  const src = img ? getSupabaseImageUrl(img.storage_path, 300) : null;
                  const cond = PRODUCT_CONDITIONS.find((c) => c.value === p.condition);
                  return (
                    <li key={it.id} className="flex gap-4 py-4 first:pt-0 last:pb-0">
                      <Link href={`/product/${p.id}`} className="relative h-24 w-24 shrink-0 overflow-hidden rounded-xl bg-gray-100">
                        {src && <Image src={src} alt={p.title} fill sizes="96px" unoptimized={isCloudinaryUrl(src)} className="object-cover transition-transform duration-500 hover:scale-105" />}
                      </Link>
                      <div className="flex min-w-0 flex-1 flex-col">
                        <Link href={`/product/${p.id}`} className="line-clamp-2 font-display font-semibold leading-snug text-ink hover:text-green-700">{p.title}</Link>
                        <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-ink-muted">
                          {cond && <span className="rounded-full bg-gray-100 px-2 py-0.5 font-medium text-ink-soft">{cond.label}</span>}
                          <span>Qty {it.quantity}</span>
                          <LocationBadge location={p.location} />
                        </div>
                        <div className="mt-auto flex items-center justify-between gap-3 pt-3">
                          <span className="font-display text-lg font-bold text-ink">{formatPrice(it.unit_price * it.quantity)}</span>
                          <Link href={`/product/${p.id}`} className="text-sm font-semibold text-green-700 hover:text-green-800">View product →</Link>
                        </div>
                      </div>
                    </li>
                  );
                })}
              </ul>
            </section>
          </RevealItem>

          {/* Delivery */}
          <RevealItem>
            <section className="rounded-2xl border border-gray-200/70 bg-white p-5 shadow-soft sm:p-6">
              <h2 className="mb-1 flex items-center gap-2 font-display text-lg font-bold text-ink">
                {isHome ? <Truck className="h-5 w-5 text-green-600" /> : <Store className="h-5 w-5 text-green-600" />} {isHome ? 'Home delivery' : 'Pickup point'}
              </h2>
              <dl className="divide-y divide-gray-100">
                <InfoRow label={isHome ? 'Deliver to' : 'Pick up at'}>
                  <span className="inline-flex items-start gap-1.5"><MapPin className="mt-0.5 h-4 w-4 shrink-0 text-green-600" /> {order.meeting_location || '—'}</span>
                </InfoRow>
                {!isHome && order.delivery_address?.hours && <InfoRow label="Open hours">{order.delivery_address.hours}</InfoRow>}
                {isHome && order.delivery_address?.landmark && <InfoRow label="Landmark">{order.delivery_address.landmark}</InfoRow>}
                {isHome && order.delivery_address?.distance_km != null && <InfoRow label="Distance">{order.delivery_address.distance_km} km from the seller</InfoRow>}
                <InfoRow label="Delivery fee">{formatPrice(order.delivery_fee)}</InfoRow>
              </dl>
              <p className="mt-3 rounded-xl bg-green-50 p-3 text-xs leading-relaxed text-green-800">StudentMarket collects the item from the seller and brings it to you — you two never need to meet.</p>
            </section>
          </RevealItem>
        </div>

        <div className="space-y-5">
          {/* Payment */}
          <RevealItem>
            <section className="rounded-2xl border border-gray-200/70 bg-white p-5 shadow-soft">
              <h2 className="mb-2 font-display text-lg font-bold text-ink">Payment</h2>
              <dl className="divide-y divide-gray-100">
                <InfoRow label="Items">{formatPrice(subtotal)}</InfoRow>
                <InfoRow label="Delivery">{formatPrice(order.delivery_fee)}</InfoRow>
                <InfoRow label="Platform fee">{formatPrice(Number(order.platform_fee ?? 0))}</InfoRow>
                <div className="flex items-baseline justify-between py-3">
                  <dt className="font-semibold text-ink">Total</dt>
                  <dd className="font-display text-xl font-extrabold text-ink">{formatPrice(order.total_amount)}</dd>
                </div>
              </dl>
              <div className="mt-1 flex items-center justify-between rounded-xl bg-gray-50 px-3 py-2.5 text-xs">
                <span className="text-ink-muted">eSewa</span>
                <span className={cn('rounded-full px-2 py-0.5 font-semibold', order.payment_status === 'CONFIRMED' ? 'bg-green-100 text-green-700' : order.payment_status === 'FAILED' ? 'bg-red-100 text-red-700' : 'bg-amber-100 text-amber-800')}>
                  {order.payment_status ? order.payment_status.charAt(0) + order.payment_status.slice(1).toLowerCase() : 'Pending'}
                </span>
              </div>
            </section>
          </RevealItem>

          {/* Seller */}
          <RevealItem>
            <section className="rounded-2xl border border-gray-200/70 bg-white p-5 shadow-soft">
              <h2 className="mb-3 font-display text-lg font-bold text-ink">Seller</h2>
              <SellerBadge name={order.seller?.full_name} photo={order.seller?.profile_photo} verified={order.seller?.verification_status === 'VERIFIED'} rating={order.seller?.seller_rating} reviews={order.seller?.seller_review_count} size="md" />
              <LocationBadge location={order.seller?.location} className="mt-2" />
              <a href={supportWhatsAppUrl(`Hi StudentMarket support, I need help with order #${order.order_number}`)} target="_blank" rel="noopener noreferrer" className="btn-secondary mt-4 flex w-full text-sm">
                <MessageCircle className="h-4 w-4" /> Contact support
              </a>
            </section>
          </RevealItem>

          {/* Support */}
          <RevealItem>
            <section className="rounded-2xl border border-gray-200/70 bg-white p-5 shadow-soft">
              <h2 className="mb-1 flex items-center gap-2 font-display text-lg font-bold text-ink"><LifeBuoy className="h-5 w-5 text-green-600" /> Need help?</h2>
              <p className="text-sm text-ink-muted">Quote your order number if you contact us or the seller.</p>
              <button onClick={copyNumber} className="mt-3 flex w-full items-center justify-between rounded-xl border border-dashed border-gray-300 bg-gray-50 px-3 py-2.5 font-mono text-sm font-semibold text-ink transition-colors hover:border-green-400 hover:bg-green-50">
                #{order.order_number} <Copy className="h-4 w-4 text-ink-muted" />
              </button>
            </section>
          </RevealItem>
        </div>
      </RevealGroup>
    </div>
  );
}
