'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { AnimatePresence, MotionConfig, motion } from 'motion/react';
import { CreditCard, Lock, MapPin, Package, ShoppingBag } from 'lucide-react';
import toast from 'react-hot-toast';
import { useCart } from '@/hooks/useCart';
import Button from '@/components/ui/Button';
import Input from '@/components/ui/Input';
import AnimatedNumber from '@/components/ui/AnimatedNumber';
import DeliveryStep, { type QuoteState } from '@/components/checkout/DeliveryStep';
import CheckoutProgress from '@/components/checkout/CheckoutProgress';
import { formatPrice } from '@/lib/utils';
import { startEsewaPayment } from '@/lib/esewa/client';
import { PLATFORM_FEE, DELIVERY } from '@/lib/pricing';
import { describeDelivery, initialDelivery, validateDelivery, type DeliverySelection } from '@/lib/delivery';

const EASE = [0.22, 1, 0.36, 1] as const;

export default function CheckoutPage() {
  const router = useRouter();
  const { items, total, isLoading } = useCart();
  const [step, setStep] = useState(0);
  const [loading, setLoading] = useState(false);
  const [contact, setContact] = useState({ full_name: '', phone: '' });
  const [delivery, setDelivery] = useState<DeliverySelection>(initialDelivery);
  const [quote, setQuote] = useState<QuoteState>({ pricing: null, estimated: false, loading: false, error: null });

  const patchDelivery = (patch: Partial<DeliverySelection>) => setDelivery((p) => ({ ...p, ...patch }));

  // Price the cart as soon as an address is chosen (the server recomputes again when the order is placed)
  const place = delivery.place;
  useEffect(() => {
    if (!place) { setQuote({ pricing: null, estimated: false, loading: false, error: null }); return; }
    let cancelled = false;
    setQuote((q) => ({ ...q, loading: true, error: null }));
    fetch('/api/delivery/quote', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ place }) })
      .then(async (res) => {
        const json = await res.json().catch(() => ({}));
        if (cancelled) return;
        if (!res.ok) setQuote({ pricing: null, estimated: false, loading: false, error: json.error || 'Could not calculate delivery' });
        else setQuote({ pricing: json.pricing, estimated: !!json.estimated, loading: false, error: null });
      })
      .catch(() => !cancelled && setQuote({ pricing: null, estimated: false, loading: false, error: 'Network error — please try again' }));
    return () => { cancelled = true; };
  }, [place]);

  const p = quote.pricing;
  const deliveryFee = p?.deliveryFee ?? 0;
  const grandTotal = p ? p.total : total + PLATFORM_FEE;
  const details = describeDelivery(delivery);

  const goDelivery = () => {
    if (!contact.full_name.trim() || !contact.phone.trim()) { toast.error('Please enter your name and phone number'); return; }
    setStep(1);
  };

  const goPayment = () => {
    const problem = validateDelivery(delivery);
    if (problem) { toast.error(problem); return; }
    if (quote.loading) { toast('Calculating your delivery fee…'); return; }
    if (quote.error || !quote.pricing) { toast.error(quote.error || 'We could not price this address'); return; }
    setStep(2);
  };

  const handlePlaceOrder = async () => {
    const problem = validateDelivery(delivery);
    if (problem || !delivery.place) { toast.error(problem || 'Choose your address'); setStep(1); return; }

    setLoading(true);
    try {
      const res = await fetch('/api/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          delivery: { place: delivery.place, address_line: delivery.address_line.trim(), landmark: delivery.landmark.trim() },
          payment_method: 'esewa',
          contact,
        }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || 'Failed to place order');
      }
      const data = await res.json();

      try {
        await startEsewaPayment(data.order_id); // navigates the browser to eSewa
        return;
      } catch (payErr) {
        toast.error((payErr as Error).message);
        router.push(`/orders/${data.order_id}`);
      }
    } catch (err: unknown) {
      toast.error((err as Error).message);
    } finally {
      setLoading(false);
    }
  };

  if (!isLoading && items.length === 0) {
    return (
      <div className="mx-auto max-w-md px-4 py-20 text-center">
        <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-green-50"><ShoppingBag className="h-8 w-8 text-green-600" /></div>
        <h1 className="text-xl font-bold text-gray-900">Your cart is empty</h1>
        <p className="mt-1 text-sm text-gray-500">Add something you like to continue to checkout.</p>
        <Link href="/browse" className="mt-5 inline-block"><Button>Browse listings</Button></Link>
      </div>
    );
  }

  return (
    <MotionConfig reducedMotion="user">
      <div className="mx-auto max-w-4xl px-4 py-6">
        <h1 className="mb-6 font-display text-2xl font-bold text-gray-900">Checkout</h1>
        <CheckoutProgress current={step <= 1 ? 1 : step} />

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
          <div className="lg:col-span-2">
            <AnimatePresence mode="wait" initial={false}>
              <motion.div key={step} initial={{ opacity: 0, x: 28 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} transition={{ duration: 0.28, ease: EASE }} className="space-y-5 rounded-2xl border border-gray-200 bg-white p-6">
                {step === 0 && (
                  <>
                    <h2 className="flex items-center gap-2 font-bold text-gray-900"><Package className="h-5 w-5 text-green-600" /> Contact information</h2>
                    <Input label="Full name" placeholder="Your full name" value={contact.full_name} onChange={(e) => setContact((c) => ({ ...c, full_name: e.target.value }))} required />
                    <Input label="Phone number" type="tel" placeholder="98XXXXXXXX" value={contact.phone} onChange={(e) => setContact((c) => ({ ...c, phone: e.target.value }))} required />
                    <Button onClick={goDelivery} fullWidth size="lg">Continue to delivery</Button>
                  </>
                )}

                {step === 1 && (
                  <>
                    <h2 className="flex items-center gap-2 font-bold text-gray-900"><MapPin className="h-5 w-5 text-green-600" /> Delivery address</h2>
                    <DeliveryStep value={delivery} onChange={patchDelivery} quote={quote} />
                    <div className="flex gap-3">
                      <Button variant="outline" onClick={() => setStep(0)} className="flex-1">Back</Button>
                      <Button onClick={goPayment} className="flex-1" size="lg">Continue</Button>
                    </div>
                  </>
                )}

                {step === 2 && (
                  <>
                    <h2 className="flex items-center gap-2 font-bold text-gray-900"><CreditCard className="h-5 w-5 text-green-600" /> Payment</h2>
                    <div className="flex items-center gap-4 rounded-xl border-2 border-green-500 bg-green-50 p-4">
                      <span className="text-3xl">💚</span>
                      <div>
                        <p className="font-semibold text-gray-900">Pay with eSewa</p>
                        <p className="text-xs text-gray-600">You&apos;ll be taken to eSewa to pay <b>{formatPrice(grandTotal)}</b> securely, then brought straight back here.</p>
                      </div>
                    </div>
                    <p className="flex items-center gap-1.5 text-xs text-gray-500"><Lock className="h-3.5 w-3.5 text-green-600" /> eSewa is our only payment method. We never see your eSewa PIN.</p>
                    <div className="flex gap-3">
                      <Button variant="outline" onClick={() => setStep(1)} className="flex-1">Back</Button>
                      <Button onClick={() => setStep(3)} className="flex-1" size="lg">Review order</Button>
                    </div>
                  </>
                )}

                {step === 3 && (
                  <>
                    <h2 className="font-bold text-gray-900">Review your order</h2>
                    <div className="space-y-2 text-sm">
                      {[['Name', contact.full_name], ['Phone', contact.phone], ['Deliver to', details.detail], ['Payment', 'eSewa']].map(([k, v]) => (
                        <div key={k} className="flex justify-between gap-4 border-b border-gray-100 py-2 last:border-0">
                          <span className="shrink-0 text-gray-500">{k}</span>
                          <span className="text-right font-medium text-gray-900">{v}</span>
                        </div>
                      ))}
                    </div>
                    <p className="rounded-xl bg-green-50 p-3 text-xs text-green-800">StudySwaps collects your item from the seller and delivers it to you — no meeting required.</p>
                    <p className="text-center text-[11px] leading-relaxed text-ink-muted">
                      By paying you agree to our <Link href="/policies#terms" target="_blank" className="font-medium text-green-700 underline-offset-2 hover:underline">Terms</Link>,{' '}
                      <Link href="/policies#delivery" target="_blank" className="font-medium text-green-700 underline-offset-2 hover:underline">Delivery</Link> and{' '}
                      <Link href="/policies#refunds" target="_blank" className="font-medium text-green-700 underline-offset-2 hover:underline">Refund policy</Link>.
                    </p>
                    <div className="flex flex-col-reverse gap-3 sm:flex-row">
                      <Button variant="outline" onClick={() => setStep(2)} className="sm:flex-1">Back</Button>
                      <Button onClick={handlePlaceOrder} loading={loading} className="w-full whitespace-nowrap sm:flex-[2]" size="lg">Pay {formatPrice(grandTotal)} with eSewa</Button>
                    </div>
                  </>
                )}
              </motion.div>
            </AnimatePresence>
          </div>

          {/* Order summary */}
          <aside className="h-fit rounded-2xl border border-gray-200 bg-white p-5 lg:sticky lg:top-32">
            <h3 className="mb-4 font-display font-bold text-gray-900">Order summary</h3>
            <dl className="space-y-2.5 text-sm">
              <div className="flex justify-between"><dt className="text-gray-500">Items ({items.length})</dt><dd><AnimatedNumber value={total} format={formatPrice} /></dd></div>
              <div className="flex justify-between">
                <dt className="text-gray-500">Delivery{p && <span className="text-xs text-gray-400"> · {p.distanceKm} km</span>}</dt>
                <dd>{p ? <AnimatedNumber value={deliveryFee} format={formatPrice} /> : <span className="text-xs text-gray-400">from {formatPrice(DELIVERY.baseFee)}</span>}</dd>
              </div>
              <div className="flex justify-between"><dt className="text-gray-500">Platform fee</dt><dd>{formatPrice(PLATFORM_FEE)}</dd></div>
              <div className="flex justify-between border-t pt-3 text-base font-bold">
                <dt>Total</dt>
                <dd className="text-green-600">{p ? <AnimatedNumber value={grandTotal} format={formatPrice} /> : <span>{formatPrice(total + PLATFORM_FEE)}<span className="text-xs font-normal text-gray-400"> + delivery</span></span>}</dd>
              </div>
            </dl>
            <p className="mt-3 text-[11px] leading-relaxed text-gray-400">The platform fee is a flat {formatPrice(PLATFORM_FEE)} per order. Delivery is priced by distance from the seller.</p>
          </aside>
        </div>
      </div>
    </MotionConfig>
  );
}
