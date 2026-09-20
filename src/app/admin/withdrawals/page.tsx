'use client';

import { useState } from 'react';
import { Check, Copy, Phone } from 'lucide-react';
import toast from 'react-hot-toast';
import { ActionDialog, Empty, Loading, PageTitle, Pager, Pill, TabBar, adminAction, statusTone, useAdminData } from '@/components/admin/kit';
import { formatPrice, formatRelativeTime } from '@/lib/utils';

/* eslint-disable @typescript-eslint/no-explicit-any */

const TABS = [
  { id: 'REQUESTED', label: 'Requested' },
  { id: 'PROCESSING', label: 'Processing' },
  { id: 'COMPLETED', label: 'Paid' },
  { id: 'FAILED', label: 'Rejected' },
];

export default function AdminWithdrawalsPage() {
  const [status, setStatus] = useState('REQUESTED');
  const [page, setPage] = useState(1);
  const { data, loading, error, reload } = useAdminData<{ withdrawals: any[]; total: number; counts: Record<string, number> }>('/api/admin/withdrawals', { status, page });
  const [dialog, setDialog] = useState<{ w: any; action: 'paid' | 'reject' } | null>(null);

  const start = async (w: any) => { if (await adminAction('/api/admin/withdrawals', { id: w.id, action: 'processing' }, 'Marked as processing')) reload(); };
  const run = async (note: string) => {
    if (!dialog) return;
    const body = dialog.action === 'paid' ? { id: dialog.w.id, action: 'paid', reference: note } : { id: dialog.w.id, action: 'reject', reason: note };
    if (await adminAction('/api/admin/withdrawals', body, dialog.action === 'paid' ? 'Marked as paid — the seller was notified' : 'Rejected — money returned to the seller')) { setDialog(null); reload(); }
  };

  return (
    <div>
      <PageTitle title="Withdrawals" hint="Sellers ask to be paid to eSewa. Send the money in your eSewa app, then record the reference here." />
      <TabBar tabs={TABS.map((t) => ({ ...t, count: t.id === 'REQUESTED' || t.id === 'PROCESSING' ? data?.counts?.[t.id] : undefined }))} value={status} onChange={(s) => { setStatus(s); setPage(1); }} />

      {loading ? <Loading /> : error ? <Empty text={error} /> : !data?.withdrawals.length ? <Empty text="Nothing here." /> : (
        <ul className="space-y-3">
          {data.withdrawals.map((w) => {
            const esewa = w.payout_details?.esewa_id;
            return (
              <li key={w.id} className="rounded-2xl border border-gray-200 bg-white p-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <p className="font-display text-xl font-extrabold text-gray-900">{formatPrice(Number(w.amount))}</p>
                    <p className="text-sm text-gray-700">{w.seller?.full_name} <span className="text-gray-400">· {formatRelativeTime(w.created_at)}</span></p>
                  </div>
                  <Pill tone={statusTone(w.status)}>{w.status === 'COMPLETED' ? 'Paid' : w.status === 'FAILED' ? 'Rejected' : w.status.toLowerCase()}</Pill>
                </div>
                <div className="mt-3 flex flex-wrap items-center gap-3 rounded-xl bg-green-50 p-3 text-sm">
                  <span className="font-semibold text-green-900">Send to eSewa:</span>
                  <span className="font-mono text-base font-bold text-green-900">{esewa ?? '—'}</span>
                  {esewa && <button onClick={() => { navigator.clipboard?.writeText(String(esewa)); toast.success('Number copied'); }} className="flex items-center gap-1 rounded-full bg-white px-2.5 py-1 text-xs font-semibold text-green-800"><Copy className="h-3 w-3" /> Copy</button>}
                  <span className="flex items-center gap-1 text-xs text-green-800"><Phone className="h-3 w-3" />{w.seller?.phone}</span>
                </div>
                {(w.admin_notes || w.failure_reason) && <p className="mt-2 text-xs text-gray-500">{w.status === 'COMPLETED' ? `eSewa reference: ${w.admin_notes}` : `Reason: ${w.failure_reason}`}</p>}

                {(w.status === 'REQUESTED' || w.status === 'PROCESSING') && (
                  <div className="mt-3 flex flex-wrap justify-end gap-2 border-t border-gray-100 pt-3">
                    {w.status === 'REQUESTED' && <button onClick={() => start(w)} className="rounded-full border border-gray-200 px-4 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50">Start processing</button>}
                    <button onClick={() => setDialog({ w, action: 'reject' })} className="rounded-full border border-red-200 px-4 py-2 text-sm font-semibold text-red-600 hover:bg-red-50">Reject</button>
                    <button onClick={() => setDialog({ w, action: 'paid' })} className="flex items-center gap-1.5 rounded-full bg-green-600 px-5 py-2 text-sm font-bold text-white hover:bg-green-700"><Check className="h-4 w-4" /> Mark as paid</button>
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}
      <Pager page={page} total={data?.total ?? 0} size={20} onChange={setPage} />

      <ActionDialog
        open={!!dialog}
        title={dialog?.action === 'paid' ? `Confirm you sent ${dialog ? formatPrice(Number(dialog.w.amount)) : ''}` : 'Reject this withdrawal'}
        text={dialog?.action === 'paid' ? 'Only mark it paid after the money has left your eSewa. The seller is notified.' : 'The full amount goes back to the seller’s available balance.'}
        confirmLabel={dialog?.action === 'paid' ? 'Mark as paid' : 'Reject & return money'}
        tone={dialog?.action === 'paid' ? 'green' : 'red'}
        field={dialog?.action === 'paid' ? { label: 'eSewa transaction reference', required: true, min: 3, placeholder: 'e.g. 0002ABC' } : { label: 'Reason for the seller', required: true, min: 3, placeholder: 'e.g. The eSewa number is not registered' }}
        onClose={() => setDialog(null)}
        onConfirm={run}
      />
    </div>
  );
}
