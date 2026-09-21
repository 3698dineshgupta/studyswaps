'use client';

import { AnimatePresence, motion } from 'motion/react';
import { AlertCircle, Home, Loader2, MapPin, Package, Route, ShieldCheck, Store } from 'lucide-react';
import AddressSearch from './AddressSearch';
import Input from '@/components/ui/Input';
import { DELIVERY, PLATFORM_FEE, type OrderPricing } from '@/lib/pricing';
import { EASE, SPRING } from '@/lib/motion';
import { formatPrice } from '@/lib/utils';
import type { DeliverySelection } from '@/lib/delivery';

export interface QuoteState {
  pricing: OrderPricing | null;
  estimated: boolean;
  loading: boolean;
  error: string | null;
}

interface DeliveryStepProps {
  value: DeliverySelection;
  onChange: (patch: Partial<DeliverySelection>) => void;
  quote: QuoteState;
}

/** Seller → StudySwaps → You, with a parcel travelling along the route. */
function MediatorFlow() {
  const nodes = [
    { icon: Store, label: 'Seller', sub: 'hands it to us' },
    { icon: ShieldCheck, label: 'StudySwaps', sub: 'checks & holds it' },
    { icon: Home, label: 'You', sub: 'at your door' },
  ];
  return (
    <div className="rounded-2xl border border-green-100 bg-gradient-to-br from-green-50 via-white to-emerald-50 p-4">
      <div className="flex items-center">
        {nodes.map((node, i) => (
          <div key={node.label} className="contents">
            <motion.div className="flex w-20 shrink-0 flex-col items-center gap-1.5 text-center sm:w-24" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 + i * 0.12, duration: 0.45, ease: EASE }}>
              <motion.div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-white text-green-600 shadow-sm ring-1 ring-green-100" animate={{ scale: [1, 1.08, 1] }} transition={{ duration: 2.4, repeat: Infinity, delay: i * 0.8, ease: 'easeInOut' }}>
                <node.icon className="h-5 w-5" />
              </motion.div>
              <p className="text-xs font-semibold text-gray-900">{node.label}</p>
              <p className="hidden text-[10px] leading-tight text-gray-500 sm:block">{node.sub}</p>
            </motion.div>
            {i < nodes.length - 1 && (
              <div className="relative mx-1 mb-6 h-px flex-1 border-t-2 border-dashed border-green-200 sm:mb-8">
                <motion.span className="absolute -top-[9px] flex h-4 w-4 items-center justify-center rounded-md bg-green-600 text-white shadow" initial={{ left: '0%', opacity: 0 }} animate={{ left: ['0%', '92%'], opacity: [0, 1, 1, 0] }} transition={{ duration: 2.2, repeat: Infinity, delay: i * 1.1, ease: 'easeInOut', repeatDelay: 1.1 }}>
                  <Package className="h-2.5 w-2.5" />
                </motion.span>
              </div>
            )}
          </div>
        ))}
      </div>
      <p className="mt-3 text-center text-xs text-gray-600">We collect the item from the seller and bring it to you — <span className="font-semibold text-green-700">you and the seller never need to meet.</span></p>
    </div>
  );
}

function DeliveryQuote({ quote, hasPlace }: { quote: QuoteState; hasPlace: boolean }) {
  return (
    <div className="rounded-2xl border border-gray-200/70 bg-white p-4 shadow-soft" aria-live="polite">
      <div className="mb-3 flex items-center gap-2 text-sm font-semibold text-ink"><Route className="h-4 w-4 text-green-600" /> Delivery fee</div>

      <AnimatePresence mode="wait" initial={false}>
        {!hasPlace ? (
          <motion.p key="none" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="text-sm text-ink-muted">Pick your address above to see your exact delivery fee.</motion.p>
        ) : quote.loading ? (
          <motion.p key="load" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="flex items-center gap-2 text-sm text-ink-muted"><Loader2 className="h-4 w-4 animate-spin" /> Calculating distance…</motion.p>
        ) : quote.error ? (
          <motion.p key="err" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="flex items-start gap-2 text-sm text-red-600"><AlertCircle className="mt-0.5 h-4 w-4 shrink-0" /> {quote.error}</motion.p>
        ) : quote.pricing ? (
          <motion.div key="ok" initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={SPRING.soft}>
            <div className="flex items-baseline justify-between">
              <p className="text-sm text-ink-soft"><span className="font-semibold text-ink">{quote.pricing.distanceKm} km</span> from the seller{quote.estimated && <span className="text-ink-muted"> (approx.)</span>}</p>
              <p className="font-display text-2xl font-extrabold text-ink">{formatPrice(quote.pricing.deliveryFee)}</p>
            </div>
            {quote.estimated && <p className="mt-1 text-xs text-ink-muted">This seller hasn&apos;t pinned an exact spot, so distance is measured from the centre of their city.</p>}
          </motion.div>
        ) : null}
      </AnimatePresence>

      <ul className="mt-3 space-y-1 border-t border-gray-100 pt-3 text-xs text-ink-muted">
        <li>• <b className="text-ink-soft">{formatPrice(DELIVERY.baseFee)}</b> flat for anywhere within {DELIVERY.baseKm} km</li>
        <li>• Beyond {DELIVERY.baseKm} km: <b className="text-ink-soft">+{formatPrice(DELIVERY.perExtraKm)}</b> for every extra km (each started km counts)</li>
        <li>• Plus a flat <b className="text-ink-soft">{formatPrice(PLATFORM_FEE)}</b> platform fee on every order · we deliver up to {DELIVERY.maxKm} km</li>
      </ul>
    </div>
  );
}

export default function DeliveryStep({ value, onChange, quote }: DeliveryStepProps) {
  return (
    <div className="space-y-6">
      <MediatorFlow />

      <div className="space-y-4 rounded-2xl border border-gray-100 bg-gray-50/60 p-4 sm:p-5">
        <div className="flex items-center gap-2 text-sm font-semibold text-ink"><MapPin className="h-4 w-4 text-green-600" /> Where should we deliver?</div>

        <AddressSearch showMap value={value.place} onChange={(place) => onChange({ place })} />

        <div className="grid gap-4 sm:grid-cols-2">
          <Input
            label="House / building & street"
            placeholder="e.g. House 23, Ward 10, Ring Road"
            value={value.address_line}
            onChange={(e) => onChange({ address_line: e.target.value })}
            required
          />
          <Input
            label="Landmark"
            placeholder="e.g. Opposite Bhat-Bhateni, blue gate"
            value={value.landmark}
            onChange={(e) => onChange({ landmark: e.target.value })}
            required
          />
        </div>
        <p className="text-xs text-ink-muted">A clear landmark helps our rider find you quickly. We&apos;ll call the number you gave in the first step if needed.</p>
      </div>

      <DeliveryQuote quote={quote} hasPlace={!!value.place} />
    </div>
  );
}
