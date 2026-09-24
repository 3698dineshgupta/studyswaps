'use client';

import { useState } from 'react';
import { BadgeCheck, Check, ExternalLink, MapPin, Search, X } from 'lucide-react';
import { ActionDialog, Empty, Loading, PageTitle, Pager, Pill, TabBar, adminAction, statusTone, useAdminData } from '@/components/admin/kit';
import { formatPrice, formatRelativeTime, getSupabaseImageUrl } from '@/lib/utils';

/* eslint-disable @typescript-eslint/no-explicit-any, @next/next/no-img-element */

const TABS = [
  { id: 'PENDING_REVIEW', label: 'Waiting for approval' },
  { id: 'ACTIVE', label: 'Live' },
  { id: 'REJECTED', label: 'Rejected' },
  { id: 'SUSPENDED', label: 'Suspended' },
  { id: 'SOLD', label: 'Sold' },
];

export default function AdminListingsPage() {
  const [status, setStatus] = useState('PENDING_REVIEW');
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [q, setQ] = useState('');
  const { data, loading, error, reload } = useAdminData<{ listings: any[]; total: number; counts: Record<string, number> }>('/api/admin/listings', { status, page, search: q });
  const [dialog, setDialog] = useState<{ item: any; action: 'reject' | 'suspend' | 'approve' | 'restore' | 'archive' } | null>(null);

  const run = async (note: string) => {
    if (!dialog) return;
    const ok = await adminAction('/api/admin/listings', { id: dialog.item.id, action: dialog.action, reason: note || undefined }, dialog.action === 'approve' ? 'Listing approved — it is live now' : 'Done');
    if (ok) { setDialog(null); reload(); }
  };

  return (
    <div>
      <PageTitle title="Listings" hint="New listings wait here until you approve them. Approved listings appear on the marketplace straight away." />
      <TabBar tabs={TABS.map((t) => ({ ...t, count: data?.counts?.[t.id] }))} value={status} onChange={(s) => { setStatus(s); setPage(1); }} />

      <form onSubmit={(e) => { e.preventDefault(); setQ(search); setPage(1); }} className="mb-5 flex max-w-md items-center gap-2 rounded-full border border-gray-200 bg-white px-4">
        <Search className="h-4 w-4 text-gray-400" />
        <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search title or listing number" className="h-10 flex-1 bg-transparent text-sm outline-none" />
      </form>

      {loading ? <Loading /> : error ? <Empty text={error} /> : !data?.listings.length ? <Empty text={status === 'PENDING_REVIEW' ? 'Nothing is waiting for approval. 🎉' : 'No listings here.'} /> : (
        <ul className="space-y-4">
          {data.listings.map((l) => {
            const imgs = [...(l.product_images ?? [])].sort((a: any, b: any) => (b.is_primary ? 1 : 0) - (a.is_primary ? 1 : 0) || a.sort_order - b.sort_order);
            const seller = l.profiles;
            return (
              <li key={l.id} className="overflow-hidden rounded-2xl border border-gray-200 bg-white">
                <div className="grid gap-4 p-4 md:grid-cols-[minmax(0,260px)_1fr]">
                  <div>
                    <a href={imgs[0] ? getSupabaseImageUrl(imgs[0].storage_path, 1200) : '#'} target="_blank" rel="noopener noreferrer" className="block aspect-[4/3] overflow-hidden rounded-xl bg-gray-100">
                      {imgs[0] && <img src={getSupabaseImageUrl(imgs[0].storage_path, 600)} alt={l.title} className="h-full w-full object-cover" />}
                    </a>
                    <div className="mt-2 flex gap-1.5 overflow-x-auto">
                      {imgs.slice(1).map((im: any, i: number) => (
                        <a key={i} href={getSupabaseImageUrl(im.storage_path, 1200)} target="_blank" rel="noopener noreferrer" className="h-12 w-12 shrink-0 overflow-hidden rounded-lg bg-gray-100">
                          <img src={getSupabaseImageUrl(im.storage_path, 120)} alt="" className="h-full w-full object-cover" />
                        </a>
                      ))}
                    </div>
                    <p className={`mt-1.5 text-xs font-medium ${imgs.length < 1 ? 'text-red-600' : 'text-gray-500'}`}>{imgs.length} photo{imgs.length === 1 ? '' : 's'}{imgs.length < 1 ? ' — no photo' : ''}</p>
                  </div>

                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <h2 className="font-display text-lg font-bold text-gray-900">{l.title}</h2>
                      <Pill tone={statusTone(l.status)}>{l.status.replace('_', ' ')}</Pill>
                      <span className="font-mono text-xs text-gray-400">{l.listing_number}</span>
                    </div>
                    <p className="mt-1 font-display text-xl font-extrabold text-gray-900">{formatPrice(Number(l.price))} {l.original_price && <span className="text-sm font-normal text-gray-400 line-through">{formatPrice(Number(l.original_price))}</span>}</p>
                    <p className="mt-1 flex flex-wrap items-center gap-x-3 text-xs text-gray-500"><span>{l.categories?.name}</span><span>{String(l.condition).replace('_', ' ')}</span><span className="flex items-center gap-1"><MapPin className="h-3 w-3" />{l.location}</span><span>Qty {l.quantity}</span><span>{formatRelativeTime(l.created_at)}</span></p>
                    <p className="mt-2 line-clamp-4 whitespace-pre-line text-sm text-gray-700">{l.description}</p>
                    <div className="mt-3 flex flex-wrap items-center gap-2 rounded-xl bg-gray-50 p-3 text-xs text-gray-600">
                      <span className="font-semibold text-gray-800">{seller?.full_name}</span>
                      {seller?.verification_status === 'VERIFIED' ? <span className="flex items-center gap-1 text-green-700"><BadgeCheck className="h-3.5 w-3.5" /> Verified</span> : <Pill tone="red">Not verified</Pill>}
                      <span>{seller?.college_name}</span><span>{seller?.phone}</span><span>{seller?.total_sales ?? 0} sales</span>
                    </div>
                  </div>
                </div>

                <div className="flex flex-wrap justify-end gap-2 border-t border-gray-100 bg-gray-50/60 px-4 py-3">
                  {l.status === 'ACTIVE' && <a href={`/product/${l.id}`} target="_blank" rel="noopener noreferrer" className="mr-auto flex items-center gap-1 text-sm font-semibold text-green-700"><ExternalLink className="h-4 w-4" /> View on site</a>}
                  {(l.status === 'PENDING_REVIEW' || l.status === 'REJECTED' || l.status === 'SUSPENDED') && <button onClick={() => setDialog({ item: l, action: 'approve' })} className="flex items-center gap-1.5 rounded-full bg-green-600 px-5 py-2 text-sm font-bold text-white hover:bg-green-700"><Check className="h-4 w-4" /> Approve</button>}
                  {(l.status === 'PENDING_REVIEW' || l.status === 'ACTIVE') && <button onClick={() => setDialog({ item: l, action: l.status === 'ACTIVE' ? 'suspend' : 'reject' })} className="flex items-center gap-1.5 rounded-full border border-red-200 bg-white px-5 py-2 text-sm font-bold text-red-600 hover:bg-red-50"><X className="h-4 w-4" /> {l.status === 'ACTIVE' ? 'Take down' : 'Reject'}</button>}
                  {l.status === 'SUSPENDED' && <button onClick={() => setDialog({ item: l, action: 'archive' })} className="rounded-full border border-gray-200 bg-white px-5 py-2 text-sm font-semibold text-gray-600">Archive</button>}
                </div>
              </li>
            );
          })}
        </ul>
      )}
      <Pager page={page} total={data?.total ?? 0} size={12} onChange={setPage} />

      <ActionDialog
        open={!!dialog}
        title={dialog?.action === 'approve' ? 'Approve this listing?' : dialog?.action === 'reject' ? 'Reject this listing' : dialog?.action === 'suspend' ? 'Take this listing down' : 'Archive this listing'}
        text={dialog?.action === 'approve' ? `"${dialog.item.title}" will go live for buyers in ${''}its city immediately, and the seller is notified.` : 'The seller is told why, so be clear and kind.'}
        confirmLabel={dialog?.action === 'approve' ? 'Approve & publish' : dialog?.action === 'reject' ? 'Reject' : dialog?.action === 'suspend' ? 'Take down' : 'Archive'}
        tone={dialog?.action === 'approve' ? 'green' : 'red'}
        field={dialog?.action === 'reject' || dialog?.action === 'suspend' ? { label: 'Reason for the seller', required: true, min: 5, placeholder: 'e.g. Photos are blurry — please retake them' } : undefined}
        onClose={() => setDialog(null)}
        onConfirm={run}
      />
    </div>
  );
}
