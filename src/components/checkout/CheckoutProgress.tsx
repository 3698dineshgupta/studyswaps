'use client';

import { motion } from 'motion/react';
import { Check } from 'lucide-react';
import { EASE, SPRING } from '@/lib/motion';
import { cn } from '@/lib/utils';

export const CHECKOUT_STEPS = ['Cart', 'Address / Pickup', 'Payment', 'Confirmation'] as const;

/** Slim progress indicator shared by the cart and every checkout step. `current` is 0–3. */
export default function CheckoutProgress({ current }: { current: number }) {
  return (
    <ol aria-label="Checkout progress" className="mx-auto mb-8 flex max-w-2xl items-center">
      {CHECKOUT_STEPS.map((label, i) => {
        const done = i < current;
        const active = i === current;
        return (
          <li key={label} className={cn('flex items-center', i < CHECKOUT_STEPS.length - 1 && 'flex-1')} aria-current={active ? 'step' : undefined}>
            <div className="flex flex-col items-center gap-1.5">
              <motion.span
                animate={{ scale: active ? 1.1 : 1 }}
                transition={SPRING.bouncy}
                className={cn(
                  'relative flex h-8 w-8 items-center justify-center rounded-full text-xs font-bold ring-4 transition-colors duration-300',
                  done ? 'bg-green-600 text-white ring-green-100' : active ? 'bg-white text-green-700 ring-green-200 border-2 border-green-600' : 'bg-gray-100 text-gray-400 ring-transparent'
                )}
              >
                {done ? <Check className="h-4 w-4" strokeWidth={3} /> : i + 1}
                {active && <span className="absolute inset-0 animate-pulse-ring rounded-full border-2 border-green-500" />}
              </motion.span>
              <span className={cn('hidden text-xs font-semibold sm:block', active ? 'text-ink' : done ? 'text-green-700' : 'text-ink-muted')}>{label}</span>
            </div>
            {i < CHECKOUT_STEPS.length - 1 && (
              <div className="relative mx-2 mb-0 h-0.5 flex-1 overflow-hidden rounded-full bg-gray-200 sm:mb-5">
                <motion.div className="absolute inset-y-0 left-0 bg-green-500" initial={false} animate={{ width: done ? '100%' : '0%' }} transition={{ duration: 0.5, ease: EASE }} />
              </div>
            )}
          </li>
        );
      })}
    </ol>
  );
}
