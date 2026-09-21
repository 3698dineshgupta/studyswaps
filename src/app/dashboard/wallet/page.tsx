'use client';

import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { motion } from 'motion/react';
import toast from 'react-hot-toast';
import { ArrowDownToLine, BadgeCheck, CalendarClock, CheckCircle2, AlertCircle, Hourglass, Lock, Wallet } from 'lucide-react';
import Modal from '@/components/ui/Modal';
import Button from '@/components/ui/Button';
import AnimatedNumber from '@/components/ui/AnimatedNumber';
import { Skeleton } from '@/components/ui/Skeleton';
import { RevealGroup, RevealItem } from '@/components/ui/Reveal';
import { PLATFORM_FEE, SELLER_COMMISSION_RATE, WITHDRAWAL } from '@/lib/pricing';
import { cn, formatDate, formatPrice, isValidNepalPhone } from '@/lib/utils';

/* eslint-disable @typescript-eslint/no-explicit-any */

const LEDGER_LABELS: Record<string, { label: string; sign: 1 | -1 | 0 }> = {
  SALE_PENDING: { label: 'Sale — held', sign: 0 },
  SALE_RELEASED: { label: 'Sale — now withdrawable', sign: 1 },
  REFUND: { label: 'Refund', sign: -1 },
  WITHDRAWAL_REQUESTED: { label: 'Withdrawal requested', sign: -1 },
  WITHDRAWAL_COMPLETED: { label: 'Withdrawal paid', sign: 0 },
  WITHDRAWAL_FAILED: { label: 'Withdrawal returned', sign: 1 },
  ADJUSTMENT: { label: 'Adjustment', sign: 0 },
  FEE: { label: 'Fee', sign: -1 },
};
const W_STATUS: Record<string, string> = { REQUESTED: 'bg-amber-100 text-amber-800', PROCESSING: 'bg-sky-100 text-sky-800', COMPLETED: 'bg-green-100 text-green-800', FAILED: 'bg-red-100 text-red-700', CANCELLED: 'bg-gray-100 text-gray-600' };

const STEPS = [
  { Icon: Wallet, title: 'Buyer pays', text: `You earn the item price minus the ${SELLER_COMMISSION_RATE * 100}% StudySwaps fee. It's held safely as “Held”.` },
  { Icon: Hourglass, title: 'We deliver', text: 'We collect from you and deliver to the buyer. Delivery and the buyer’s platform fee are never taken from you.' },
  { Icon: BadgeCheck, title: 'Delivered', text: 'The moment we mark the order delivered, your earnings become “Available” to withdraw.' },
  { Icon: ArrowDownToLine, title: 'You withdraw', text: `Send Available earnings to your eSewa. Paid ${WITHDRAWAL.processingText}.` },
];

export default function DashboardWalletPage() {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [amount, setAmount] = useState('');
  const [esewa, setEsewa] = useState('');

  const { data, isLoading } = useQuery({
    queryKey: ['wallet'],
    queryFn: async () => {
      const res = await fetch('/api/wallet');
      if (!res.ok) throw new Error('Could not load your wallet');
      return res.json();
    },
  });

  const withdraw = useMutation({
    mutationFn: async () => {
      const res = await fetch('/api/wallet/withdraw', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ amount: Number(amount), esewaId: esewa }) });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json.error || 'Withdrawal failed');
      return json;
    },
    onSuccess: (r) => {
      toast.success(`Withdrawal of ${formatPrice(r.amount)} requested`);
      setOpen(false); setAmount(''); setEsewa('');
      qc.invalidateQueries({ queryKey: ['wallet'] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const available = Number(data?.wallet?.available_balance ?? 0);
  const pending = Number(data?.wallet?.pending_balance ?? 0);
  const amt = Number(amount);
  const amountError = amount && (amt < WITHDRAWAL.minAmount ? `Minimum is ${formatPrice(WITHDRAWAL.minAmount)}` : amt > WITHDRAWAL.maxAmount ? `Maximum per request is ${formatPrice(WITHDRAWAL.maxAmount)}` : amt > available ? `You only have ${formatPrice(available)} available` : '');
  const esewaError = esewa && !isValidNepalPhone(esewa) ? 'Enter the mobile number linked to your eSewa (98XXXXXXXX)' : '';
  const canSubmit = amt >= WITHDRAWAL.minAmount && !amountError && isValidNepalPhone(esewa);

  return (
    <div className="space-y-8">
      <div>
        <h1 className="font-display text-3xl font-extrabold tracking-tight text-ink">Wallet</h1>
        <p className="mt-1 text-sm text-ink-muted">Your earnings, and exactly when you can withdraw them.</p>
      </div>

      {/* Balances */}
      {isLoading ? <Skeleton className="h-44 rounded-3xl" /> : (
        <section className="rounded-3xl bg-ink p-6 text-white shadow-lift sm:p-8">
          <div className="grid gap-6 sm:grid-cols-3">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-gray-400">Available to withdraw</p>
              <p className="mt-1 font-display text-4xl font-extrabold text-green-400"><AnimatedNumber value={available} format={formatPrice} /></p>
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-gray-400">Held (pending)</p>
              <p className="mt-1 font-display text-2xl font-bold"><AnimatedNumber value={pending} format={formatPrice} /></p>
              <p className="text-xs text-gray-400">Not withdrawable yet</p>
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-gray-400">Total earned</p>
              <p className="mt-1 font-display text-2xl font-bold">{formatPrice(Number(data?.wallet?.total_earned ?? 0))}</p>
            </div>
          </div>
          <div className="mt-6 flex flex-wrap items-center justify-between gap-3 border-t border-white/10 pt-5">
            <p className="text-xs text-gray-300">{data?.canWithdraw ? 'You can withdraw right now.' : 'Withdrawal is unavailable — see “Can I withdraw?” below.'}</p>
            <motion.button whileTap={{ scale: 0.97 }} disabled={!data?.canWithdraw} onClick={() => setOpen(true)} className="inline-flex items-center gap-2 rounded-full bg-green-500 px-6 py-2.5 text-sm font-bold text-ink transition-colors hover:bg-green-400 disabled:cursor-not-allowed disabled:opacity-40">
              <ArrowDownToLine className="h-4 w-4" /> Withdraw to eSewa
            </motion.button>
          </div>
        </section>
      )}

      {/* Can I withdraw? */}
      {data && (
        <section className={cn('rounded-2xl border p-5', data.canWithdraw ? 'border-green-200 bg-green-50' : 'border-amber-200 bg-amber-50')} aria-live="polite">
          <h2 className="mb-3 flex items-center gap-2 font-display font-bold text-ink">
            {data.canWithdraw ? <><CheckCircle2 className="h-5 w-5 text-green-600" /> Can I withdraw? Yes</> : <><AlertCircle className="h-5 w-5 text-amber-600" /> Can I withdraw? Not yet</>}
          </h2>
          {data.canWithdraw ? (
            <p className="text-sm text-green-900">You have {formatPrice(available)} available. Up to {formatPrice(Math.min(available, WITHDRAWAL.maxAmount))} can be requested now.</p>
          ) : (
            <ul className="space-y-1.5 text-sm text-amber-900">{data.blockers.map((b: string) => <li key={b} className="flex gap-2"><span>•</span>{b}</li>)}</ul>
          )}
        </section>
      )}

      {/* How it works */}
      <section aria-labelledby="how-h">
        <h2 id="how-h" className="mb-4 font-display text-xl font-bold text-ink">How you get paid</h2>
        <RevealGroup className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {STEPS.map(({ Icon, title, text }, i) => (
            <RevealItem key={title}>
              <div className="card h-full p-4">
                <div className="mb-3 flex items-center gap-2"><span className="flex h-8 w-8 items-center justify-center rounded-full bg-green-100 text-green-700"><Icon className="h-4 w-4" /></span><span className="text-xs font-bold text-ink-muted">STEP {i + 1}</span></div>
                <p className="font-display font-semibold text-ink">{title}</p>
                <p className="mt-1 text-xs leading-relaxed text-ink-muted">{text}</p>
              </div>
            </RevealItem>
          ))}
        </RevealGroup>
      </section>

      {/* Rules */}
      <section className="grid gap-5 lg:grid-cols-2">
        <div className="card p-5">
          <h2 className="mb-3 font-display font-bold text-ink">Fees</h2>
          <dl className="divide-y divide-gray-100 text-sm">
            <div className="flex justify-between gap-4 py-2.5"><dt className="text-ink-muted">StudySwaps fee on each sale</dt><dd className="font-semibold text-ink">{SELLER_COMMISSION_RATE * 100}% of the item price</dd></div>
            <div className="flex justify-between gap-4 py-2.5"><dt className="text-ink-muted">Listing an item</dt><dd className="font-semibold text-ink">Free</dd></div>
            <div className="flex justify-between gap-4 py-2.5"><dt className="text-ink-muted">Delivery</dt><dd className="text-right font-semibold text-ink">Paid by the buyer</dd></div>
            <div className="flex justify-between gap-4 py-2.5"><dt className="text-ink-muted">Buyer platform fee ({formatPrice(PLATFORM_FEE)})</dt><dd className="text-right font-semibold text-ink">Paid by the buyer</dd></div>
            <div className="flex justify-between gap-4 py-2.5"><dt className="text-ink-muted">Example: item sold for Rs. 1,000</dt><dd className="font-semibold text-ink">You receive Rs. {1000 - 1000 * SELLER_COMMISSION_RATE}</dd></div>
          </dl>
        </div>
        <div className="card p-5">
          <h2 className="mb-3 flex items-center gap-2 font-display font-bold text-ink"><Lock className="h-4 w-4 text-green-600" /> Withdrawal requirements</h2>
          <ul className="space-y-2 text-sm text-ink-soft">
            <li className="flex gap-2"><CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-green-600" /> <span>Your student identity must be <b>verified</b> and your account active.</span></li>
            <li className="flex gap-2"><CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-green-600" /> <span>Only <b>Available</b> earnings can be withdrawn — not Held ones.</span></li>
            <li className="flex gap-2"><CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-green-600" /> <span>Minimum {formatPrice(WITHDRAWAL.minAmount)}, maximum {formatPrice(WITHDRAWAL.maxAmount)} per request.</span></li>
            <li className="flex gap-2"><CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-green-600" /> <span>Payout is to <b>eSewa only</b>, using the mobile number linked to your eSewa.</span></li>
            <li className="flex gap-2"><CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-green-600" /> <span>One withdrawal at a time; paid {WITHDRAWAL.processingText}.</span></li>
          </ul>
        </div>
      </section>

      {/* Held earnings */}
      {data?.held?.length > 0 && (
        <section>
          <h2 className="mb-3 flex items-center gap-2 font-display text-xl font-bold text-ink"><CalendarClock className="h-5 w-5 text-green-600" /> Earnings on the way</h2>
          <ul className="space-y-2.5">
            {data.held.map((h: any) => (
              <li key={h.id} className="card flex flex-wrap items-center justify-between gap-3 p-4">
                <div className="min-w-0">
                  <p className="truncate font-medium text-ink">{h.title} <span className="font-mono text-xs text-ink-muted">#{h.orderNumber}</span></p>
                  <p className="text-xs text-ink-muted">
                    {h.stage === 'awaiting_delivery' ? 'Waiting for delivery' : 'Withdrawable as soon as it is delivered'}
                  </p>
                </div>
                <div className="text-right text-sm"><p className="font-display font-bold text-ink">{formatPrice(h.net)}</p><p className="text-xs text-ink-muted">{formatPrice(h.gross)} − {formatPrice(h.commission)} fee</p></div>
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* Withdrawals + ledger */}
      <div className="grid gap-5 lg:grid-cols-2">
        <section className="card">
          <h2 className="border-b border-gray-100 p-4 font-display font-bold text-ink">Withdrawals</h2>
          {data?.withdrawals?.length ? (
            <ul className="divide-y divide-gray-100">
              {data.withdrawals.map((w: any) => (
                <li key={w.id} className="flex items-center justify-between gap-3 p-4 text-sm">
                  <div><p className="font-semibold text-ink">{formatPrice(Number(w.amount))}</p><p className="text-xs text-ink-muted">eSewa {w.payout_details?.esewa_id} · {formatDate(w.created_at)}</p>{w.failure_reason && <p className="text-xs text-red-600">{w.failure_reason}</p>}</div>
                  <span className={cn('rounded-full px-2.5 py-1 text-xs font-semibold', W_STATUS[w.status] ?? 'bg-gray-100')}>{w.status.charAt(0) + w.status.slice(1).toLowerCase()}</span>
                </li>
              ))}
            </ul>
          ) : <p className="p-6 text-center text-sm text-ink-muted">No withdrawals yet.</p>}
        </section>

        <section className="card">
          <h2 className="border-b border-gray-100 p-4 font-display font-bold text-ink">Activity</h2>
          {data?.ledger?.length ? (
            <ul className="divide-y divide-gray-100">
              {data.ledger.map((l: any) => {
                const meta = LEDGER_LABELS[l.transaction_type] ?? { label: l.transaction_type, sign: 0 };
                return (
                  <li key={l.id} className="flex items-start justify-between gap-3 p-4 text-sm">
                    <div className="min-w-0"><p className="font-medium text-ink">{meta.label}</p><p className="text-xs text-ink-muted">{l.description || l.reference || ''}</p><p className="text-[11px] text-gray-400">{formatDate(l.created_at)}</p></div>
                    <p className={cn('shrink-0 font-display font-bold', meta.sign > 0 ? 'text-green-700' : meta.sign < 0 ? 'text-red-600' : 'text-ink-muted')}>{meta.sign < 0 ? '−' : meta.sign > 0 ? '+' : ''}{formatPrice(Number(l.amount))}</p>
                  </li>
                );
              })}
            </ul>
          ) : <p className="p-6 text-center text-sm text-ink-muted">Sales and payouts will appear here.</p>}
        </section>
      </div>

      <Modal isOpen={open} onClose={() => setOpen(false)} title="Withdraw to eSewa">
        <div className="space-y-4">
          <p className="rounded-xl bg-gray-50 p-3 text-sm text-ink-soft">Available now: <b>{formatPrice(available)}</b>. Held earnings can&apos;t be withdrawn until they unlock.</p>
          <div>
            <label className="mb-1.5 block text-sm font-semibold text-ink-soft" htmlFor="wa">Amount (Rs.)</label>
            <input id="wa" type="number" inputMode="numeric" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder={`${WITHDRAWAL.minAmount} – ${Math.min(available, WITHDRAWAL.maxAmount)}`} className="h-12 w-full rounded-xl border border-gray-200 px-4 text-lg font-bold outline-none focus:border-green-500 focus:ring-4 focus:ring-green-500/10" />
            {amountError && <p className="mt-1 text-xs text-red-600">{amountError}</p>}
            <button type="button" onClick={() => setAmount(String(Math.min(available, WITHDRAWAL.maxAmount)))} className="mt-1.5 text-xs font-semibold text-green-700 hover:underline">Withdraw maximum ({formatPrice(Math.min(available, WITHDRAWAL.maxAmount))})</button>
          </div>
          <div>
            <label className="mb-1.5 block text-sm font-semibold text-ink-soft" htmlFor="we">eSewa number</label>
            <input id="we" type="tel" inputMode="numeric" value={esewa} onChange={(e) => setEsewa(e.target.value)} placeholder="98XXXXXXXX" className="h-12 w-full rounded-xl border border-gray-200 px-4 outline-none focus:border-green-500 focus:ring-4 focus:ring-green-500/10" />
            {esewaError && <p className="mt-1 text-xs text-red-600">{esewaError}</p>}
            <p className="mt-1 text-xs text-ink-muted">The mobile number linked to your eSewa account. Double-check it — payouts can&apos;t be redirected.</p>
          </div>
          <div className="flex gap-3">
            <Button variant="outline" onClick={() => setOpen(false)} className="flex-1">Cancel</Button>
            <Button onClick={() => withdraw.mutate()} loading={withdraw.isPending} disabled={!canSubmit} className="flex-1">Request withdrawal</Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
