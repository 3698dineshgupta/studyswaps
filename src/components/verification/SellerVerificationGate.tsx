'use client';

import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { useRouter } from 'next/navigation';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import { AlertTriangle, ShieldCheck, X } from 'lucide-react';
import VerificationFlow, { VerificationPending } from '@/components/verification/VerificationFlow';
import Button from '@/components/ui/Button';
import { DURATION, EASE, SPRING } from '@/lib/motion';

interface Props {
  /** profiles.verification_status */
  status: string;
  defaults?: { full_name?: string; college_name?: string };
}

/**
 * The "verify to start selling" popup. Buyers never see it — it opens on the Sell page for accounts that
 * aren't verified yet, walks them through verification in place, and closes back to the marketplace if dismissed.
 */
export default function SellerVerificationGate({ status, defaults }: Props) {
  const router = useRouter();
  const reduced = useReducedMotion();
  const [open, setOpen] = useState(true);
  const [submitted, setSubmitted] = useState(false);
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  const inReview = submitted || status === 'PENDING' || status === 'UNDER_REVIEW';
  const blocked = status === 'SUSPENDED';
  const retry = status === 'REJECTED' || status === 'EXPIRED';

  const leave = () => { setOpen(false); router.push('/'); };

  // Lock page scroll and support Esc while the popup is open
  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && leave();
    window.addEventListener('keydown', onKey);
    return () => { document.body.style.overflow = prev; window.removeEventListener('keydown', onKey); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  if (!mounted) return null;

  return createPortal(
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-[100] flex items-end justify-center sm:items-center sm:p-6">
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: DURATION.normal }} className="absolute inset-0 bg-ink/50 backdrop-blur-sm" onClick={leave} />
          <motion.div
            role="dialog" aria-modal="true" aria-labelledby="gate-title"
            initial={reduced ? { opacity: 0 } : { opacity: 0, y: 40, scale: 0.97 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={reduced ? { opacity: 0 } : { opacity: 0, y: 24, scale: 0.98 }}
            transition={reduced ? { duration: 0.15 } : SPRING.soft}
            className="relative flex max-h-[94svh] w-full max-w-2xl flex-col overflow-hidden rounded-t-3xl bg-canvas shadow-lift sm:rounded-3xl"
          >
            <div className="flex items-center gap-3.5 border-b border-gray-200/70 bg-white px-5 py-4 sm:px-6">
              <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-green-600 text-white shadow-[0_8px_20px_-8px_rgba(22,163,74,0.8)]"><ShieldCheck className="h-6 w-6" /></span>
              <div className="min-w-0 flex-1">
                <h1 id="gate-title" className="font-display text-lg font-extrabold leading-tight text-ink sm:text-xl">Verify your identity to start selling</h1>
                <p className="text-xs text-ink-muted sm:text-sm">A one-time step for sellers. Buying never needs it.</p>
              </div>
              <button type="button" onClick={leave} aria-label="Close" className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-gray-100 text-ink-soft transition-colors hover:bg-gray-200"><X className="h-4 w-4" /></button>
            </div>

            <div className="overflow-y-auto overscroll-contain px-5 py-5 pb-[calc(1.25rem+env(safe-area-inset-bottom))] sm:px-6">
              {blocked ? (
                <div className="space-y-3 py-6 text-center">
                  <AlertTriangle className="mx-auto h-10 w-10 text-amber-500" />
                  <p className="font-display text-lg font-bold text-ink">Your account is suspended</p>
                  <p className="text-sm text-ink-muted">You can&apos;t list items right now. Please contact StudentMarket support.</p>
                  <Button onClick={leave} variant="outline">Back to marketplace</Button>
                </div>
              ) : inReview ? (
                <VerificationPending>
                  <div className="flex justify-center gap-3 pt-2">
                    <Button onClick={leave}>Keep browsing</Button>
                  </div>
                </VerificationPending>
              ) : (
                <>
                  {retry && (
                    <motion.div initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.25, ease: EASE }} className="mb-4 flex items-start gap-2.5 rounded-xl border border-amber-200 bg-amber-50 p-3.5 text-sm text-amber-800">
                      <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                      <span>Your last verification wasn&apos;t approved. Please try again with a clear, well-lit photo where your face and ID are readable.</span>
                    </motion.div>
                  )}
                  <VerificationFlow defaults={defaults} onSubmitted={() => { setSubmitted(true); router.refresh(); }} />
                </>
              )}
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>,
    document.body,
  );
}
