'use client';

import { useState } from 'react';
import { MapPin, Phone, Search } from 'lucide-react';
import { ActionDialog, Empty, Loading, PageTitle, Pager, Pill, adminAction, statusTone, useAdminData } from '@/components/admin/kit';
import { formatPrice, formatRelativeTime } from '@/lib/utils';

/* eslint-disable @typescript-eslint/no-explicit-any */

const FILTERS = ['', 'PAYMENT_PENDING', 'PAYMENT_CONFIRMED', 'SELLER_ACCEPTED', 'READY_FOR_PICKUP', 'PICKED_UP', 'IN_TRANSIT', 'OUT_FOR_DELIVERY', 'DELIVERED', 'COMPLETED', 'CANCELLED', 'REFUNDED', 'DISPUTED'];
const NEXT_STEPS: Record<string, string[]> = {
  PAYMENT_CONFIRMED: ['SELLER_ACCEPTED', 'CANCELLED'],
  SELLER_NOTIFIED: ['SELLER_ACCEPTED', 'CANCELLED'],
  SELLER_ACCEPTED: ['PACKING', 'READY_FOR_PICKUP', 'CANCELLED'],
  PACKING: ['READY_FOR_PICKUP', 'CANCELLED'],
  READY_FOR_PICKUP: ['PICKED_UP', 'CANCELLED'],
  PICKED_UP: ['IN_TRANSIT', 'OUT_FOR_DELIVERY', 'CANCELLED'],
  IN_TRANSIT: ['OUT_FOR_DELIVERY', 'DELIVERED'],
  OUT_FOR_DELIVERY: ['DELIVERED', 'CANCELLED'],
  DELIVERED: ['BUYER_CONFIRMED', 'RETURN_REQUESTED', 'REFUNDED'],
  BUYER_CONFIRMED: ['COMPLETED', 'REFUNDED'],
  RETURN_REQUESTED: ['RETURN_APPROVED', 'DELIVERED'],
  RETURN_APPROVED: ['RETURNED'],
  RETURNED: ['REFUNDED'],
  DISPUTED: ['REFUNDED', 'COMPLETED', 'CANCELLED'],
  COMPLETED: ['REFUNDED'],
};
const nice = (s: string) => s.replace(/_/g, ' ').toLowerCase().replace(/^\w/, (c) => c.toUpperCase());

export default function AdminOrdersPage() {
  const [status, setStatus] = useState('');
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [q, setQ] = useState('');
  const { data, loading, error, reload } = useAdminData<{ orders: any[]; total: number }>('/api/admin/orders', { status, page, search: q });
  const [dialog, setDialog] = useState<{ order: any; to: string } | null>(null);

  const money = ['CANCELLED', 'REFUNDED', 'RETURNED'];
  const run = async (note: string) => {
    if (!dialog) return;
    const ok = await adminAction('/api/admin/orders', { id: dialog.order.id, status: dialog.to, note: note || undefined }, `Order moved to ${nice(dialog.to)}`);
    if (ok) { setDialog(null); reload(); }
  };

  return (
    <div>
      <PageTitle title="Orders" hint="Every order, with the delivery details our team needs. Buyers and sellers never see each other's details." />
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <select value={status} onChange={(e) => { setStatus(e.target.value); setPage(1); }} className="h-10 rounded-full border border-gray-200 bg-white px-4 text-sm font-medium">
          {FILTERS.map((s) => <option key={s} value={s}>{s ? nice(s) : 'All started orders'}</option>)}
        </select>
        <form onSubmit={(e) => { e.preventDefault(); setQ(search); setPage(1); }} className="flex items-center gap-2 rounded-full border border-gray-200 bg-white px-4">
          <Search className="h-4 w-4 text-gray-400" />
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Order number" className="h-10 w-44 bg-transparent text-sm outline-none" />
        </form>
      </div>

      {loading ? <Loading /> : error ? <Empty text={error} /> : !data?.orders.length ? <Empty text="No orders match." /> : (
        <ul className="space-y-3">
          {data.orders.map((o) => {
            const addr = o.delivery_address ?? {};
            const paid = (o.payments ?? []).some((p: any) => p.status === 'CONFIRMED');
            const steps = NEXT_STEPS[o.status] ?? [];
            return (
              <li key={o.id} className="rounded-2xl border border-gray-200 bg-white p-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-mono text-sm font-bold text-gray-900">#{o.order_number}</span>
                    <Pill tone={statusTone(o.status)}>{nice(o.status)}</Pill>
                    {paid ? <Pill tone="green">Paid</Pill> : <Pill tone="gray">Unpaid</Pill>}
                    <span className="text-xs text-gray-400">{formatRelativeTime(o.created_at)}</span>
                  </div>
                  <p className="font-display text-lg font-extrabold text-gray-900">{formatPrice(Number(o.total))}</p>
                </div>

                <p className="mt-1.5 text-sm text-gray-700">{(o.order_items ?? []).map((i: any) => `${i.title} ×${i.quantity}`).join(', ')}</p>
                <p className="text-xs text-gray-500">Items {formatPrice(Number(o.subtotal))} · Delivery {formatPrice(Number(o.delivery_charge ?? 0))} · Platform fee {formatPrice(Number(o.platform_fee ?? 0))}</p>

                <div className="mt-3 grid gap-3 text-sm sm:grid-cols-3">
                  <div className="rounded-xl bg-gray-50 p-3"><p className="text-xs font-semibold uppercase text-gray-400">Seller (pick up)</p><p className="font-semibold">{o.seller?.full_name}</p><p className="flex items-center gap-1 text-xs text-gray-500"><Phone className="h-3 w-3" />{o.seller?.phone ?? '—'}</p></div>
                  <div className="rounded-xl bg-gray-50 p-3"><p className="text-xs font-semibold uppercase text-gray-400">Buyer (deliver to)</p><p className="font-semibold">{addr.contact?.full_name ?? o.buyer?.full_name}</p><p className="flex items-center gap-1 text-xs text-gray-500"><Phone className="h-3 w-3" />{addr.contact?.phone ?? o.buyer?.phone ?? '—'}</p></div>
                  <div className="rounded-xl bg-gray-50 p-3"><p className="text-xs font-semibold uppercase text-gray-400">Address</p><p className="flex items-start gap-1 text-xs text-gray-700"><MapPin className="mt-0.5 h-3 w-3 shrink-0" /><span>{o.meeting_location ?? '—'}{addr.distance_km != null ? ` · ${addr.distance_km} km` : ''}</span></p></div>
                </div>

                {steps.length > 0 && (
                  <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-gray-100 pt-3">
                    <span className="text-xs font-semibold text-gray-500">Move to:</span>
                    {steps.map((s) => (
                      <button key={s} onClick={() => setDialog({ order: o, to: s })} className={`rounded-full border px-3.5 py-1.5 text-xs font-bold ${money.includes(s) ? 'border-red-200 text-red-600 hover:bg-red-50' : 'border-green-200 text-green-700 hover:bg-green-50'}`}>{nice(s)}</button>
                    ))}
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
        title={dialog ? `Move order #${dialog.order.order_number} to “${nice(dialog.to)}”?` : ''}
        text={dialog && money.includes(dialog.to) && (dialog.order.payments ?? []).some((p: any) => p.status === 'CONFIRMED') ? 'The buyer has paid. The seller’s earnings for this order are taken back, the item goes back on sale, and a refund alert is sent to Telegram — you still send the eSewa refund yourself.' : 'The buyer and the seller are both notified.'}
        confirmLabel="Confirm"
        tone={dialog && money.includes(dialog.to) ? 'red' : 'green'}
        field={{ label: 'Note (shown on the delivery timeline)', placeholder: 'Optional' }}
        onClose={() => setDialog(null)}
        onConfirm={run}
      />
    </div>
  );
}
