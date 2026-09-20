'use client';

import { motion } from 'motion/react';
import { Check } from 'lucide-react';
import { EASE, SPRING } from '@/lib/motion';
import { cn } from '@/lib/utils';

export const TRACK_STEPS = [
  { key: 'CREATED', label: 'Order Placed' },
  { key: 'PAYMENT_CONFIRMED', label: 'Payment Confirmed' },
  { key: 'SELLER_NOTIFIED', label: 'Seller Notified' },
  { key: 'SELLER_ACCEPTED', label: 'Seller Accepted' },
  { key: 'PACKING', label: 'Packing' },
  { key: 'READY_FOR_PICKUP', label: 'Ready for Pickup' },
  { key: 'PICKED_UP', label: 'Picked Up' },
  { key: 'DELIVERED', label: 'Delivered' },
] as const;

/** Maps the many database statuses onto the 8 visible steps. Returns the index of the CURRENT step. */
export function trackIndex(status: string): number {
  switch (status) {
    case 'CREATED': case 'PAYMENT_PENDING': return 0;
    case 'PAYMENT_CONFIRMED': return 1;
    case 'SELLER_NOTIFIED': return 2;
    case 'SELLER_ACCEPTED': return 3;
    case 'PACKING': return 4;
    case 'READY_FOR_PICKUP': return 5;
    case 'PICKED_UP': case 'IN_TRANSIT': case 'OUT_FOR_DELIVERY': return 6;
    case 'DELIVERED': case 'BUYER_CONFIRMED': case 'COMPLETED': return 7;
    default: return 0;
  }
}

interface OrderTrackerProps {
  status: string;
  events?: { status: string; created_at: string }[];
}

/**
 * Order progress. Horizontal on md+ (line fills on load), compact vertical timeline on mobile.
 * Current step pulses green, finished steps show a check, upcoming steps are muted.
 */
export default function OrderTracker({ status, events = [] }: OrderTrackerProps) {
  const done = ['COMPLETED', 'BUYER_CONFIRMED'].includes(status);
  const current = trackIndex(status);
  const stampFor = (key: string) => {
    const e = events.filter((ev) => ev.status === key).sort((a, b) => +new Date(a.created_at) - +new Date(b.created_at))[0];
    // Compact so it fits under each step: "Sep 20, 8:40 AM"
    return e ? new Date(e.created_at).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }) : null;
  };
  const state = (i: number): 'done' | 'current' | 'upcoming' => (done || i < current ? 'done' : i === current ? 'current' : 'upcoming');
  const progress = done ? 100 : (current / (TRACK_STEPS.length - 1)) * 100;

  const Dot = ({ s }: { s: 'done' | 'current' | 'upcoming' }) => (
    <span className="relative flex h-9 w-9 shrink-0 items-center justify-center">
      {s === 'current' && <span className="absolute inset-0 animate-pulse-ring rounded-full bg-green-500/40" />}
      <motion.span
        initial={{ scale: 0.6, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={SPRING.bouncy}
        className={cn(
          'relative flex h-9 w-9 items-center justify-center rounded-full text-xs font-bold ring-4 transition-colors',
          s === 'done' && 'bg-green-600 text-white ring-green-100',
          s === 'current' && 'border-2 border-green-600 bg-white text-green-700 ring-green-100',
          s === 'upcoming' && 'bg-gray-100 text-gray-400 ring-transparent'
        )}
      >
        {s === 'done' ? <Check className="h-4 w-4" strokeWidth={3} /> : s === 'current' ? <span className="h-2.5 w-2.5 rounded-full bg-green-600" /> : null}
      </motion.span>
    </span>
  );

  return (
    <div>
      {/* Desktop: horizontal stepper */}
      <ol className="relative hidden md:grid" style={{ gridTemplateColumns: `repeat(${TRACK_STEPS.length}, minmax(0, 1fr))` }} aria-label="Order progress">
        <div className="absolute left-[6.25%] right-[6.25%] top-[18px] h-1 rounded-full bg-gray-200">
          <motion.div className="h-full rounded-full bg-gradient-to-r from-green-500 to-emerald-500" initial={{ width: 0 }} animate={{ width: `${progress}%` }} transition={{ duration: 1.1, ease: EASE, delay: 0.2 }} />
        </div>
        {TRACK_STEPS.map((step, i) => {
          const s = state(i);
          const stamp = stampFor(step.key);
          return (
            <li key={step.key} className="relative flex flex-col items-center text-center" aria-current={s === 'current' ? 'step' : undefined}>
              <Dot s={s} />
              <span className={cn('mt-3 px-1 text-xs font-semibold leading-tight', s === 'upcoming' ? 'text-ink-muted' : 'text-ink')}>{step.label}</span>
              <span className="mt-0.5 min-h-[14px] px-1 text-[10.5px] text-ink-muted">{stamp ?? (s === 'current' ? 'In progress' : '')}</span>
            </li>
          );
        })}
      </ol>

      {/* Mobile: compact vertical timeline */}
      <ol className="md:hidden" aria-label="Order progress">
        {TRACK_STEPS.map((step, i) => {
          const s = state(i);
          const stamp = stampFor(step.key);
          const last = i === TRACK_STEPS.length - 1;
          return (
            <li key={step.key} className="relative flex gap-3.5 pb-5 last:pb-0" aria-current={s === 'current' ? 'step' : undefined}>
              {!last && (
                <span className="absolute left-[17px] top-9 h-[calc(100%-2.25rem)] w-0.5 overflow-hidden rounded bg-gray-200">
                  <motion.span className="block w-full bg-green-500" initial={{ height: 0 }} animate={{ height: s === 'done' ? '100%' : '0%' }} transition={{ duration: 0.6, ease: EASE, delay: 0.1 * i }} />
                </span>
              )}
              <Dot s={s} />
              <div className="min-w-0 pt-1.5">
                <p className={cn('text-sm font-semibold', s === 'upcoming' ? 'text-ink-muted' : 'text-ink')}>{step.label}</p>
                <p className="text-xs text-ink-muted">{stamp ?? (s === 'current' ? 'In progress' : s === 'upcoming' ? 'Upcoming' : '')}</p>
              </div>
            </li>
          );
        })}
      </ol>
    </div>
  );
}
