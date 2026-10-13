'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import toast from 'react-hot-toast';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Handshake } from 'lucide-react';
import Tabs from '@/components/ui/Tabs';
import EmptyState from '@/components/ui/EmptyState';
import Button from '@/components/ui/Button';
import { Skeleton } from '@/components/ui/Skeleton';
import { useAuthState } from '@/components/auth/AuthProvider';
import { cn, formatPrice, formatRelativeTime, getSupabaseImageUrl, isCloudinaryUrl } from '@/lib/utils';

/* eslint-disable @typescript-eslint/no-explicit-any */

type Tab = 'sent' | 'received';
type OfferRow = any;

const STATUS_TONE: Record<string, string> = {
  PENDING: 'bg-amber-100 text-amber-800',
  COUNTERED: 'bg-sky-100 text-sky-800',
  ACCEPTED: 'bg-green-100 text-green-800',
  REJECTED: 'bg-red-100 text-red-700',
  EXPIRED: 'bg-gray-100 text-gray-500',
  WITHDRAWN: 'bg-gray-100 text-gray-500',
  FULFILLED: 'bg-violet-100 text-violet-800',
};
const STATUS_LABEL: Record<string, string> = {
  PENDING: 'Pending', COUNTERED: 'Countered', ACCEPTED: 'Accepted', REJECTED: 'Declined',
  EXPIRED: 'Expired', WITHDRAWN: 'Withdrawn', FULFILLED: 'Fulfilled',
};

async function fetchOffers(tab: Tab): Promise<{ offers: OfferRow[]; myProfileId: string }> {
  const res = await fetch(`/api/offers?role=${tab === 'sent' ? 'buyer' : 'seller'}`);
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || 'Could not load offers');
  return data;
}

async function fetchTelegramStatus() {
  const res = await fetch('/api/telegram/link');
  if (!res.ok) return { connected: true, configured: false }; // fail quiet — never nag on an error
  return res.json();
}

function Thumb({ product }: { product: any }) {
  const img = product?.product_images?.find((i: any) => i.is_primary) ?? product?.product_images?.[0];
  const src = img ? getSupabaseImageUrl(img.storage_path, 160) : null;
  return (
    <Link href={`/product/${product?.id}`} className="relative h-16 w-16 shrink-0 overflow-hidden rounded-xl bg-gray-100 sm:h-20 sm:w-20">
      {src && <Image src={src} alt={product.title} fill sizes="80px" unoptimized={isCloudinaryUrl(src)} className="object-cover" />}
    </Link>
  );
}

function OfferCard({ offer, tab, busy, onRespond, onAddToCart }: {
  offer: OfferRow; tab: Tab; busy: boolean;
  onRespond: (id: string, body: { action: string; amount?: number; message?: string }) => void;
  onAddToCart: (id: string) => void;
}) {
  const [showReject, setShowReject] = useState(false);
  const [showCounter, setShowCounter] = useState(false);
  const [reason, setReason] = useState('');
  const [counterAmount, setCounterAmount] = useState('');
  const [counterMessage, setCounterMessage] = useState('');

  const product = offer.product ?? {};
  const otherParty = tab === 'sent' ? offer.seller : offer.buyer;
  const expired = offer.expires_at ? new Date(offer.expires_at).getTime() < Date.now() : false;

  const doCounter = () => {
    const amt = Number(counterAmount);
    if (!counterAmount || Number.isNaN(amt) || amt <= 0) { toast.error('Enter a counter amount'); return; }
    onRespond(offer.id, { action: 'counter', amount: amt, message: counterMessage.trim() || undefined });
    setShowCounter(false); setCounterAmount(''); setCounterMessage('');
  };

  const doReject = () => {
    onRespond(offer.id, { action: 'reject', message: reason.trim() || undefined });
    setShowReject(false); setReason('');
  };

  return (
    <li className="card flex flex-col gap-3 p-4">
      <div className="flex min-w-0 gap-3">
        <Thumb product={product} />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-start justify-between gap-2">
            <Link href={`/product/${product.id}`} className="line-clamp-2 min-w-0 font-display font-semibold leading-snug text-ink hover:text-green-700">{product.title ?? 'Listing'}</Link>
            <span className={cn('shrink-0 rounded-full px-2.5 py-0.5 text-[11px] font-semibold', STATUS_TONE[offer.status] ?? 'bg-gray-100 text-gray-600')}>{STATUS_LABEL[offer.status] ?? offer.status}</span>
          </div>
          <p className="mt-0.5 truncate text-xs text-ink-muted">{tab === 'sent' ? 'Seller' : 'Buyer'}: {otherParty?.full_name ?? 'Unknown'}</p>
          <div className="mt-1.5 flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
            <span className="font-display text-lg font-bold text-ink">{formatPrice(Number(offer.amount))}</span>
            {offer.status === 'COUNTERED' && offer.counter_amount != null && (
              <span className="text-xs font-medium text-sky-700">
                {tab === 'sent' ? `Seller offered ${formatPrice(Number(offer.counter_amount))} instead` : `You offered ${formatPrice(Number(offer.counter_amount))} instead`}
              </span>
            )}
          </div>
          {offer.message && <p className="mt-1 line-clamp-2 text-xs italic text-ink-muted">&quot;{offer.message}&quot;</p>}
          <p className="mt-1 text-[11px] text-ink-muted">{formatRelativeTime(offer.created_at)}</p>
        </div>
      </div>

      {/* Received, PENDING: accept / reject / counter */}
      {tab === 'received' && offer.status === 'PENDING' && (
        <div className="flex flex-col gap-2 border-t border-gray-100 pt-3">
          {!showReject && !showCounter && (
            <div className="flex flex-wrap gap-2">
              <Button size="sm" onClick={() => onRespond(offer.id, { action: 'accept' })} disabled={busy} className="min-w-[90px] flex-1">Accept</Button>
              <Button size="sm" variant="outline" onClick={() => setShowReject(true)} disabled={busy} className="min-w-[90px] flex-1">Reject</Button>
              <Button size="sm" variant="secondary" onClick={() => setShowCounter(true)} disabled={busy} className="min-w-[90px] flex-1">Counter</Button>
            </div>
          )}
          {showReject && (
            <div className="space-y-2">
              <textarea value={reason} onChange={(e) => setReason(e.target.value.slice(0, 300))} rows={2} placeholder="Reason (optional)" className="w-full rounded-xl border border-gray-200 p-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-green-500" />
              <div className="flex gap-2">
                <Button size="sm" variant="outline" onClick={() => setShowReject(false)} className="flex-1">Cancel</Button>
                <Button size="sm" variant="danger" onClick={doReject} loading={busy} className="flex-1">Confirm reject</Button>
              </div>
            </div>
          )}
          {showCounter && (
            <div className="space-y-2">
              <input
                type="number" inputMode="decimal" value={counterAmount} onChange={(e) => setCounterAmount(e.target.value)}
                placeholder={`Counter amount (asking ${formatPrice(Number(product.price ?? 0))})`}
                className="w-full min-w-0 rounded-xl border border-gray-200 p-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
              />
              <textarea value={counterMessage} onChange={(e) => setCounterMessage(e.target.value.slice(0, 300))} rows={2} placeholder="Message (optional)" className="w-full rounded-xl border border-gray-200 p-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-green-500" />
              <div className="flex gap-2">
                <Button size="sm" variant="outline" onClick={() => setShowCounter(false)} className="flex-1">Cancel</Button>
                <Button size="sm" onClick={doCounter} loading={busy} className="flex-1">Send counter</Button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Sent, COUNTERED: accept / decline the seller's counter */}
      {tab === 'sent' && offer.status === 'COUNTERED' && (
        <div className="flex gap-2 border-t border-gray-100 pt-3">
          <Button size="sm" onClick={() => onRespond(offer.id, { action: 'accept' })} disabled={busy} className="flex-1">Accept counter</Button>
          <Button size="sm" variant="outline" onClick={() => onRespond(offer.id, { action: 'reject' })} disabled={busy} className="flex-1">Decline</Button>
        </div>
      )}

      {/* Sent, PENDING or COUNTERED: withdraw */}
      {tab === 'sent' && (offer.status === 'PENDING' || offer.status === 'COUNTERED') && (
        <div className="border-t border-gray-100 pt-3">
          <button type="button" onClick={() => onRespond(offer.id, { action: 'withdraw' })} disabled={busy} className="text-xs font-semibold text-ink-muted underline-offset-2 hover:text-red-600 hover:underline disabled:opacity-50">
            Withdraw offer
          </button>
        </div>
      )}

      {/* Sent, ACCEPTED and unexpired: add to cart at the negotiated price */}
      {tab === 'sent' && offer.status === 'ACCEPTED' && !expired && (
        <div className="border-t border-gray-100 pt-3">
          <Button size="sm" onClick={() => onAddToCart(offer.id)} disabled={busy} loading={busy} fullWidth>
            Add to cart at {formatPrice(Number(offer.amount))}
          </Button>
          <p className="mt-1.5 text-center text-[11px] text-ink-muted">Expires {formatRelativeTime(offer.expires_at)}</p>
        </div>
      )}
      {tab === 'sent' && offer.status === 'ACCEPTED' && expired && (
        <p className="border-t border-gray-100 pt-3 text-center text-xs text-ink-muted">This offer window has expired.</p>
      )}
    </li>
  );
}

export default function OffersPage() {
  const router = useRouter();
  const { isLoggedIn } = useAuthState();
  const queryClient = useQueryClient();
  const [tab, setTab] = useState<Tab>('sent');
  const [busyId, setBusyId] = useState<string | null>(null);

  useEffect(() => {
    if (!isLoggedIn) router.replace('/login?redirectTo=/offers');
  }, [isLoggedIn, router]);

  const { data, isLoading } = useQuery({
    queryKey: ['offers', tab],
    queryFn: () => fetchOffers(tab),
    enabled: isLoggedIn,
  });

  const { data: telegramStatus } = useQuery({
    queryKey: ['telegram-status'],
    queryFn: fetchTelegramStatus,
    enabled: isLoggedIn,
    staleTime: 60_000,
  });

  const respond = async (id: string, body: { action: string; amount?: number; message?: string }) => {
    setBusyId(id);
    try {
      const res = await fetch(`/api/offers/${id}/respond`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json.error || 'Could not update this offer');
      toast.success(body.action === 'accept' ? 'Offer accepted' : body.action === 'reject' ? 'Offer declined' : body.action === 'counter' ? 'Counter sent' : 'Offer withdrawn');
      queryClient.invalidateQueries({ queryKey: ['offers'] });
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusyId(null);
    }
  };

  const addToCart = async (id: string) => {
    setBusyId(id);
    try {
      const res = await fetch(`/api/offers/${id}/cart`, { method: 'POST' });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json.error || 'Could not add this to your cart');
      toast.success('Added to your cart at the agreed price');
      queryClient.invalidateQueries({ queryKey: ['cart'] });
      queryClient.invalidateQueries({ queryKey: ['offers'] });
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusyId(null);
    }
  };

  if (!isLoggedIn) return null;

  const offers: OfferRow[] = data?.offers ?? [];
  const showTelegramNudge = tab === 'received' && telegramStatus?.configured && !telegramStatus?.connected;

  return (
    <div className="page-container max-w-3xl py-8 sm:py-10">
      <div className="mb-6 flex items-center gap-3">
        <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-green-100 text-green-700"><Handshake className="h-6 w-6" /></span>
        <div>
          <h1 className="font-display text-2xl font-extrabold tracking-tight text-ink sm:text-3xl">Offers</h1>
          <p className="text-sm text-ink-muted">Negotiate prices with buyers and sellers.</p>
        </div>
      </div>

      <Tabs<Tab> value={tab} onChange={setTab} tabs={[{ id: 'sent', label: 'Sent' }, { id: 'received', label: 'Received' }]} />

      {showTelegramNudge && (
        <p className="mt-4 rounded-xl bg-green-50 px-3.5 py-2.5 text-xs text-green-800">
          Get these instantly — <Link href="/profile?tab=notifications" className="font-semibold underline-offset-2 hover:underline">connect Telegram</Link>
        </p>
      )}

      <div className="pt-6">
        {isLoading ? (
          <ul className="space-y-3">
            {[0, 1].map((i) => <li key={i} className="card p-4"><Skeleton className="h-20 w-full rounded-xl" /></li>)}
          </ul>
        ) : offers.length === 0 ? (
          <EmptyState
            illustration="productCard"
            title={tab === 'sent' ? 'No offers sent yet' : 'No offers received yet'}
            text={tab === 'sent' ? 'Found something you like? Make an offer right from the product page.' : 'Offers from buyers on your listings will show up here.'}
            action={tab === 'sent' ? { label: 'Browse Marketplace', href: '/browse' } : { label: 'View your listings', href: '/profile' }}
          />
        ) : (
          <ul className="space-y-3">
            {offers.map((o) => (
              <OfferCard key={o.id} offer={o} tab={tab} busy={busyId === o.id} onRespond={respond} onAddToCart={addToCart} />
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
