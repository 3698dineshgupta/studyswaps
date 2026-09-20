'use client';

import { useState } from 'react';
import { ActionDialog, Empty, Loading, PageTitle, Pager, Pill, TabBar, adminAction, statusTone, useAdminData } from '@/components/admin/kit';
import { formatPrice, formatRelativeTime } from '@/lib/utils';

/* eslint-disable @typescript-eslint/no-explicit-any */

const TABS = [
  { id: 'OPEN', label: 'Open' }, { id: 'UNDER_REVIEW', label: 'In review' }, { id: 'RESOLVED', label: 'Resolved' }, { id: 'REFUNDED', label: 'Refunded' }, { id: 'REJECTED', label: 'Rejected' },
];
const nice = (s: string) => s.replace(/_/g, ' ').toLowerCase().replace(/^\w/, (c) => c.toUpperCase());

export default function AdminDisputesPage() {
  const [status, setStatus] = useState('OPEN');
  const [page, setPage] = useState(1);
  const { data, loading, error, reload } = useAdminData<{ disputes: any[]; total: number; counts: Record<string, number> }>('/api/admin/disputes', { status, page });
  const [dialog, setDialog] = useState<{ d: any; action: 'resolve' | 'reject' | 'refund' } | null>(null);

  const review = async (d: any) => { if (await adminAction('/api/admin/disputes', { id: d.id, action: 'review' }, 'Dispute is now in review')) reload(); };
  const run = async (note: string) => {
    if (!dialog) return;
    if (await adminAction('/api/admin/disputes', { id: dialog.d.id, action: dialog.action, resolution: note }, 'Decision recorded — both people were notified')) { setDialog(null); reload(); }
  };

  return (
    <div>
      <PageTitle title="Disputes" hint="Problems reported on an order. You are the mediator: read, decide, and both sides are told." />
      <TabBar tabs={TABS.map((t) => ({ ...t, count: data?.counts?.[t.id] }))} value={status} onChange={(s) => { setStatus(s); setPage(1); }} />

      {loading ? <Loading /> : error ? <Empty text={error} /> : !data?.disputes.length ? <Empty text="No disputes here." /> : (
        <ul className="space-y-3">
          {data.disputes.map((d) => {
            const order = Array.isArray(d.orders) ? d.orders[0] : d.orders;
            const closed = ['RESOLVED', 'REJECTED', 'REFUNDED'].includes(d.status);
            return (
              <li key={d.id} className="rounded-2xl border border-gray-200 bg-white p-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-mono text-sm font-bold">#{order?.order_number}</span>
                    <Pill tone={statusTone(d.status)}>{nice(d.status)}</Pill>
                    <Pill tone="violet">{nice(d.reason)}</Pill>
                    <span className="text-xs text-gray-400">opened by {d.opener?.full_name} · {formatRelativeTime(d.created_at)}</span>
                  </div>
                  <span className="font-display font-extrabold">{formatPrice(Number(order?.total ?? 0))}</span>
                </div>
                <p className="mt-2 whitespace-pre-line rounded-xl bg-gray-50 p-3 text-sm text-gray-700">{d.description}</p>
                {d.resolution && <p className="mt-2 text-sm text-gray-600"><b>Decision:</b> {d.resolution}{d.refund_amount ? ` · refunded ${formatPrice(Number(d.refund_amount))}` : ''}</p>}
                {!closed && (
                  <div className="mt-3 flex flex-wrap justify-end gap-2 border-t border-gray-100 pt-3">
                    {d.status === 'OPEN' && <button onClick={() => review(d)} className="rounded-full border border-gray-200 px-4 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50">Start review</button>}
                    <button onClick={() => setDialog({ d, action: 'reject' })} className="rounded-full border border-gray-200 px-4 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50">Reject dispute</button>
                    <button onClick={() => setDialog({ d, action: 'resolve' })} className="rounded-full bg-green-600 px-4 py-2 text-sm font-bold text-white hover:bg-green-700">Resolve (no refund)</button>
                    <button onClick={() => setDialog({ d, action: 'refund' })} className="rounded-full border border-red-200 px-4 py-2 text-sm font-bold text-red-600 hover:bg-red-50">Refund buyer</button>
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}
      <Pager page={page} total={data?.total ?? 0} size={15} onChange={setPage} />

      <ActionDialog
        open={!!dialog}
        title={dialog?.action === 'refund' ? 'Refund the buyer?' : dialog?.action === 'resolve' ? 'Resolve this dispute' : 'Reject this dispute'}
        text={dialog?.action === 'refund' ? 'The order is marked refunded, the seller’s earnings for it are taken back, the item goes back on sale, and a refund alert goes to Telegram. You send the eSewa refund yourself.' : 'Both the buyer and the seller are notified of your decision.'}
        confirmLabel={dialog?.action === 'refund' ? 'Refund' : 'Save decision'}
        tone={dialog?.action === 'refund' ? 'red' : 'green'}
        field={{ label: 'Your decision (both people will read this)', required: true, min: 5, placeholder: 'Explain what you decided and why' }}
        onClose={() => setDialog(null)}
        onConfirm={run}
      />
    </div>
  );
}
