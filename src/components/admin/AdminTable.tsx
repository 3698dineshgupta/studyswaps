import { ReactNode } from 'react';
import { cn } from '@/lib/utils';

interface Column<T> {
  key: string;
  label: string;
  render?: (item: T) => ReactNode;
  className?: string;
}

interface AdminTableProps<T extends { id: string }> {
  columns: Column<T>[];
  data: T[];
  loading?: boolean;
  emptyMessage?: string;
  page?: number;
  pageSize?: number;
  total?: number;
  onPageChange?: (page: number) => void;
}

export default function AdminTable<T extends { id: string }>({ columns, data, loading, emptyMessage = 'No data found', page, pageSize, total, onPageChange }: AdminTableProps<T>) {
  if (loading) {
    return (
      <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
        {[...Array(5)].map((_, i) => (
          <div key={i} className="h-14 border-b border-gray-50 animate-pulse bg-gray-50" />
        ))}
      </div>
    );
  }

  if (data.length === 0) {
    return (
      <div className="bg-white rounded-2xl border border-gray-100 p-12 text-center">
        <p className="text-gray-400 text-sm">{emptyMessage}</p>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden shadow-sm">
      {/* Phones: one card per row (name first, details as label/value pairs, actions last) */}
      <ul className="divide-y divide-gray-100 md:hidden">
        {data.map((row) => {
          const [first, ...rest] = columns;
          const cell = (col: Column<T>) => (col.render ? col.render(row) : String((row as Record<string, unknown>)[col.key] ?? '—'));
          const actions = rest.filter((c) => c.key === 'actions');
          const details = rest.filter((c) => c.key !== 'actions');
          return (
            <li key={row.id} className="space-y-2.5 p-4">
              <div className="min-w-0 text-sm">{cell(first)}</div>
              <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
                {details.map((col) => (
                  <div key={col.key} className="min-w-0"><dt className="text-[11px] font-semibold uppercase tracking-wider text-gray-400">{col.label}</dt><dd className="mt-0.5 break-words text-gray-800">{cell(col)}</dd></div>
                ))}
              </dl>
              {actions.map((col) => <div key={col.key} className="border-t border-gray-100 pt-2.5 text-sm">{cell(col)}</div>)}
            </li>
          );
        })}
      </ul>
      <div className="hidden overflow-x-auto md:block">
        <table className="w-full">
          <thead>
            <tr className="bg-gray-50 border-b border-gray-100">
              {columns.map(col => (
                <th key={col.key} className={cn('text-left text-xs font-semibold text-gray-500 uppercase tracking-wider px-4 py-3', col.className)}>
                  {col.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {data.map(row => (
              <tr key={row.id} className="hover:bg-gray-50/50 transition-colors">
                {columns.map(col => (
                  <td key={col.key} className={cn('px-4 py-3 text-sm', col.className)}>
                    {col.render ? col.render(row) : String((row as Record<string, unknown>)[col.key] ?? '—')}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {page !== undefined && pageSize && total !== undefined && onPageChange && (
        <div className="flex flex-wrap items-center justify-between gap-2 px-4 py-3 border-t border-gray-100 text-sm text-gray-500">
          <span>
            {Math.min((page - 1) * pageSize + 1, total)}–{Math.min(page * pageSize, total)} of {total}
          </span>
          <div className="flex gap-2">
            <button
              className="px-3 py-1 rounded-lg border border-gray-200 disabled:opacity-40"
              disabled={page <= 1}
              onClick={() => onPageChange(page - 1)}
            >
              Previous
            </button>
            <button
              className="px-3 py-1 rounded-lg border border-gray-200 disabled:opacity-40"
              disabled={page * pageSize >= total}
              onClick={() => onPageChange(page + 1)}
            >
              Next
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
