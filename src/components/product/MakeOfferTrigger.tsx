'use client';

import { useState } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { motion } from 'motion/react';
import toast from 'react-hot-toast';
import { Tag } from 'lucide-react';
import Modal from '@/components/ui/Modal';
import Button from '@/components/ui/Button';
import { useAuthState } from '@/components/auth/AuthProvider';
import { checkOfferAmount, MIN_OFFER_FRACTION, MAX_OFFER_FRACTION } from '@/lib/offers';
import { formatPrice } from '@/lib/utils';

const AMOUNT_ERROR_HINT: Record<string, (min: number) => string> = {
  TOO_LOW: (min) => `Your offer must be at least ${formatPrice(min)}.`,
  TOO_HIGH: () => `An offer can't be more than the asking price — use Buy Now instead.`,
};

/**
 * "Make an offer" — shown next to the Negotiable badge on the product page. Visible to guests too (so the page
 * layout doesn't shift on login state) but clicking while logged out sends them to /login first, same as the
 * existing Buy Now button. Hidden entirely for the seller's own listing.
 */
export default function MakeOfferTrigger({ productId, sellerId, price }: { productId: string; sellerId: string; price: number }) {
  const router = useRouter();
  const pathname = usePathname();
  const { isLoggedIn, profile } = useAuthState();
  const [open, setOpen] = useState(false);
  const [amount, setAmount] = useState('');
  const [message, setMessage] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [sent, setSent] = useState(false);

  // Never shown to the seller of their own listing
  if (profile?.id === sellerId) return null;

  const minAmount = Math.ceil(price * MIN_OFFER_FRACTION);
  const maxAmount = price * MAX_OFFER_FRACTION;

  const openModal = () => {
    if (!isLoggedIn) {
      toast('Log in to make an offer');
      router.push(`/login?redirectTo=${encodeURIComponent(pathname || `/product/${productId}`)}`);
      return;
    }
    setOpen(true);
  };

  const submit = async () => {
    const amt = Number(amount);
    if (!amount || Number.isNaN(amt) || amt <= 0) { toast.error('Enter an offer amount'); return; }
    const err = checkOfferAmount(amt, price);
    if (err) { toast.error(AMOUNT_ERROR_HINT[err](minAmount)); return; }

    setSubmitting(true);
    try {
      const res = await fetch('/api/offers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ productId, amount: amt, message: message.trim() || undefined }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || 'Could not send your offer');
      toast.success('Offer sent!');
      setSent(true);
      setOpen(false);
      setAmount('');
      setMessage('');
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <>
      <motion.button
        type="button"
        onClick={openModal}
        disabled={sent}
        whileHover={sent ? undefined : { y: -1 }}
        whileTap={sent ? undefined : { scale: 0.96 }}
        animate={sent ? undefined : { boxShadow: ['0 0 0 0 rgba(22,163,74,0.35)', '0 0 0 6px rgba(22,163,74,0)', '0 0 0 0 rgba(22,163,74,0)'] }}
        transition={sent ? undefined : { boxShadow: { duration: 2.2, repeat: Infinity, repeatDelay: 1.2 } }}
        className="inline-flex items-center gap-1.5 rounded-full bg-green-600 px-3.5 py-1.5 text-xs font-bold text-white shadow-[0_6px_16px_-6px_rgba(22,163,74,0.7)] transition-colors hover:bg-green-700 disabled:cursor-default disabled:bg-green-100 disabled:text-green-700 disabled:shadow-none"
      >
        <Tag className="h-3.5 w-3.5" /> {sent ? 'Offer sent ✓' : 'Make an offer'}
      </motion.button>

      <Modal isOpen={open} onClose={() => setOpen(false)} title="Make an offer" size="sm">
        <div className="space-y-4">
          <div className="rounded-xl bg-gray-50 p-3 text-sm text-gray-600">
            Asking price: <span className="font-semibold text-gray-900">{formatPrice(price)}</span>
          </div>

          <div className="flex flex-col gap-1.5">
            <label htmlFor="offer-amount" className="text-sm font-medium text-gray-700">Your offer (Rs.)</label>
            <input
              id="offer-amount"
              type="number"
              inputMode="decimal"
              min={minAmount}
              max={maxAmount}
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder={`Between ${minAmount.toLocaleString()} and ${maxAmount.toLocaleString()}`}
              className="h-11 w-full rounded-xl border border-gray-200 bg-white px-4 text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-green-500"
            />
            <p className="text-xs text-gray-500">Between {formatPrice(minAmount)} and {formatPrice(maxAmount)} (10%–100% of the asking price).</p>
          </div>

          <div className="flex flex-col gap-1.5">
            <label htmlFor="offer-message" className="text-sm font-medium text-gray-700">Message (optional)</label>
            <textarea
              id="offer-message"
              value={message}
              onChange={(e) => setMessage(e.target.value.slice(0, 300))}
              maxLength={300}
              rows={3}
              placeholder="Add a short note for the seller"
              className="w-full rounded-xl border border-gray-200 bg-white p-3 text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-green-500"
            />
            <p className="text-right text-[11px] text-gray-400">{message.length}/300</p>
          </div>

          <div className="flex gap-3">
            <Button variant="outline" onClick={() => setOpen(false)} className="flex-1">Cancel</Button>
            <Button onClick={submit} loading={submitting} className="flex-1">Send offer</Button>
          </div>
        </div>
      </Modal>
    </>
  );
}
