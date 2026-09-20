'use client';

import { useCallback, useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import toast from 'react-hot-toast';
import { Loader2, X } from 'lucide-react';
import { cn } from '@/lib/utils';

/** Fetch a JSON admin endpoint; reload() re-runs it (after an action). */
export function useAdminData<T>(path: string, params: Record<string, string | number>) {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const qs = new URLSearchParams(Object.entries(params).map(([k, v]) => [k, String(v)])).toString();

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const res = await fetch(`${path}?${qs}`);
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json.error || 'Could not load');
      setData(json as T);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }, [path, qs]);

  useEffect(() => { load(); }, [load]);
  return { data, loading, error, reload: load };
}

/** POST an admin action and show the outcome. Returns true on success. */
export async function adminAction(path: string, body: object, success = 'Done'): Promise<boolean> {
  try {
    const res = await fetch(path, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
    const json = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(json.error || 'Action failed');
    toast.success(success);
    return true;
  } catch (e) {
    toast.error((e as Error).message);
    return false;
  }
}

export function PageTitle({ title, hint, right }: { title: string; hint?: string; right?: React.ReactNode }) {
  return (
    <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
      <div>
        <h1 className="font-display text-2xl font-extrabold tracking-tight text-gray-900">{title}</h1>
        {hint && <p className="mt-0.5 text-sm text-gray-500">{hint}</p>}
      </div>
      {right}
    </div>
  );
}

export function TabBar({ tabs, value, onChange }: { tabs: { id: string; label: string; count?: number }[]; value: string; onChange: (id: string) => void }) {
  return (
    <div className="mb-4 flex flex-wrap gap-2" role="tablist">
      {tabs.map((t) => (
        <button key={t.id} role="tab" aria-selected={value === t.id} onClick={() => onChange(t.id)} className={cn('flex items-center gap-2 rounded-full border px-4 py-2 text-sm font-semibold transition-colors', value === t.id ? 'border-green-600 bg-green-600 text-white' : 'border-gray-200 bg-white text-gray-600 hover:border-gray-300')}>
          {t.label}
          {t.count !== undefined && <span className={cn('rounded-full px-1.5 text-xs', value === t.id ? 'bg-white/25 text-white' : t.count > 0 ? 'bg-amber-100 text-amber-800' : 'bg-gray-100 text-gray-500')}>{t.count}</span>}
        </button>
      ))}
    </div>
  );
}

const TONES: Record<string, string> = {
  green: 'bg-green-100 text-green-800', amber: 'bg-amber-100 text-amber-800', red: 'bg-red-100 text-red-700', blue: 'bg-sky-100 text-sky-800', gray: 'bg-gray-100 text-gray-700', violet: 'bg-violet-100 text-violet-800',
};
export function Pill({ children, tone = 'gray' }: { children: React.ReactNode; tone?: keyof typeof TONES }) {
  return <span className={cn('inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold', TONES[tone])}>{children}</span>;
}

export function statusTone(s: string): keyof typeof TONES {
  if (['ACTIVE', 'COMPLETED', 'BUYER_CONFIRMED', 'DELIVERED', 'RESOLVED', 'VERIFIED', 'CONFIRMED'].includes(s)) return 'green';
  if (['PENDING_REVIEW', 'REQUESTED', 'OPEN', 'PAYMENT_PENDING', 'RETURN_REQUESTED'].includes(s)) return 'amber';
  if (['REJECTED', 'CANCELLED', 'SUSPENDED', 'FAILED', 'BANNED', 'REFUNDED', 'DISPUTED'].includes(s)) return 'red';
  if (['PAYMENT_CONFIRMED', 'PROCESSING', 'UNDER_REVIEW', 'IN_TRANSIT', 'OUT_FOR_DELIVERY', 'PICKED_UP'].includes(s)) return 'blue';
  return 'gray';
}

export function Pager({ page, total, size, onChange }: { page: number; total: number; size: number; onChange: (p: number) => void }) {
  const pages = Math.max(1, Math.ceil(total / size));
  if (pages <= 1) return null;
  return (
    <div className="mt-5 flex items-center justify-between text-sm text-gray-500">
      <span>Page {page} of {pages} · {total} total</span>
      <div className="flex gap-2">
        <button disabled={page <= 1} onClick={() => onChange(page - 1)} className="rounded-full border border-gray-200 bg-white px-4 py-1.5 font-semibold disabled:opacity-40">Previous</button>
        <button disabled={page >= pages} onClick={() => onChange(page + 1)} className="rounded-full border border-gray-200 bg-white px-4 py-1.5 font-semibold disabled:opacity-40">Next</button>
      </div>
    </div>
  );
}

export function Empty({ text }: { text: string }) {
  return <div className="rounded-2xl border border-dashed border-gray-300 bg-white p-10 text-center text-sm text-gray-500">{text}</div>;
}

export function Loading() {
  return <div className="flex justify-center py-16 text-gray-400"><Loader2 className="h-6 w-6 animate-spin" /></div>;
}

/** Confirmation dialog with an optional (or required) note box. */
export function ActionDialog({ open, title, text, confirmLabel, tone = 'green', field, onClose, onConfirm }: {
  open: boolean; title: string; text?: string; confirmLabel: string; tone?: 'green' | 'red';
  field?: { label: string; required?: boolean; placeholder?: string; min?: number };
  onClose: () => void; onConfirm: (note: string) => Promise<void>;
}) {
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  useEffect(() => { if (open) setNote(''); }, [open]);
  const tooShort = !!field?.required && note.trim().length < (field.min ?? 3);

  return (
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-[90] flex items-center justify-center p-4">
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="absolute inset-0 bg-black/40" onClick={onClose} />
          <motion.div role="dialog" aria-modal="true" aria-label={title} initial={{ opacity: 0, y: 14, scale: 0.97 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.18 }} className="relative w-full max-w-md rounded-2xl bg-white p-6 shadow-xl">
            <button onClick={onClose} aria-label="Close" className="absolute right-4 top-4 rounded-full p-1 text-gray-400 hover:bg-gray-100"><X className="h-4 w-4" /></button>
            <h2 className="pr-8 font-display text-lg font-bold text-gray-900">{title}</h2>
            {text && <p className="mt-1.5 text-sm text-gray-600">{text}</p>}
            {field && (
              <label className="mt-4 block text-sm font-semibold text-gray-700">
                {field.label}{field.required ? ' *' : ' (optional)'}
                <textarea value={note} onChange={(e) => setNote(e.target.value)} rows={3} maxLength={500} placeholder={field.placeholder} className="mt-1.5 w-full rounded-xl border border-gray-200 p-3 text-sm font-normal outline-none focus:border-green-500 focus:ring-4 focus:ring-green-500/10" />
              </label>
            )}
            <div className="mt-5 flex justify-end gap-2">
              <button onClick={onClose} className="rounded-full border border-gray-200 px-5 py-2 text-sm font-semibold text-gray-600 hover:bg-gray-50">Cancel</button>
              <button
                disabled={busy || tooShort}
                onClick={async () => { setBusy(true); try { await onConfirm(note.trim()); } finally { setBusy(false); } }}
                className={cn('flex items-center gap-2 rounded-full px-5 py-2 text-sm font-bold text-white disabled:opacity-50', tone === 'red' ? 'bg-red-600 hover:bg-red-700' : 'bg-green-600 hover:bg-green-700')}
              >
                {busy && <Loader2 className="h-4 w-4 animate-spin" />} {confirmLabel}
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
