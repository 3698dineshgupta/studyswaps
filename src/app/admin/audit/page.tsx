'use client';

import { useState } from 'react';
import { Search } from 'lucide-react';
import { Empty, Loading, PageTitle, Pager, useAdminData } from '@/components/admin/kit';

/* eslint-disable @typescript-eslint/no-explicit-any */

export default function AdminAuditPage() {
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [q, setQ] = useState('');
  const { data, loading, error } = useAdminData<{ logs: any[]; total: number }>('/api/admin/audit', { page, search: q });

  return (
    <div>
      <PageTitle title="Activity log" hint="Who did what, and when — payments, listings, orders, withdrawals and every admin action." />
      <form onSubmit={(e) => { e.preventDefault(); setQ(search); setPage(1); }} className="mb-4 flex max-w-md items-center gap-2 rounded-full border border-gray-200 bg-white px-4">
        <Search className="h-4 w-4 text-gray-400" />
        <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search action, email or type" className="h-10 flex-1 bg-transparent text-sm outline-none" />
      </form>
      {loading ? <Loading /> : error ? <Empty text={error} /> : !data?.logs.length ? <Empty text="No activity yet." /> : (
        <div className="overflow-x-auto rounded-2xl border border-gray-200 bg-white">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-gray-100 bg-gray-50 text-xs uppercase tracking-wide text-gray-500">
              <tr><th className="px-4 py-3">When</th><th className="px-4 py-3">Action</th><th className="px-4 py-3">By</th><th className="px-4 py-3">Item</th><th className="px-4 py-3">Details</th></tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {data.logs.map((l) => (
                <tr key={l.id} className="align-top">
                  <td className="whitespace-nowrap px-4 py-2.5 text-xs text-gray-500">{new Date(l.created_at).toLocaleString()}</td>
                  <td className="px-4 py-2.5 font-semibold text-gray-900">{l.action}</td>
                  <td className="px-4 py-2.5 text-xs text-gray-600">{l.actor_email ?? 'system'}{l.actor_role ? ` (${l.actor_role})` : ''}</td>
                  <td className="px-4 py-2.5 text-xs text-gray-600">{l.entity_type}<span className="block font-mono text-[10px] text-gray-400">{String(l.entity_id ?? '').slice(0, 8)}</span></td>
                  <td className="max-w-xs px-4 py-2.5 text-xs text-gray-500"><span className="line-clamp-2 break-all">{l.new_data ? JSON.stringify(l.new_data) : ''}</span></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <Pager page={page} total={data?.total ?? 0} size={30} onChange={setPage} />
    </div>
  );
}
