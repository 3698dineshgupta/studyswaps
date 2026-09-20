'use client';

import { Suspense, useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { AnimatePresence, motion } from 'motion/react';
import { ChevronLeft, ChevronRight, Search, SlidersHorizontal, X } from 'lucide-react';
import { useProducts } from '@/hooks/useProducts';
import { useDebouncedValue } from '@/hooks/useDebouncedValue';
import ProductGrid from '@/components/marketplace/ProductGrid';
import { useCity } from '@/components/city/CityProvider';
import { cityBySlug } from '@/lib/cities';
import { CATEGORIES, PRODUCT_CONDITIONS } from '@/lib/constants';
import { DURATION, EASE, SPRING } from '@/lib/motion';
import { cn } from '@/lib/utils';

const SORT_OPTIONS = [
  { value: 'newest', label: 'Newest first' },
  { value: 'price_asc', label: 'Price: low to high' },
  { value: 'price_desc', label: 'Price: high to low' },
  { value: 'popular', label: 'Most popular' },
];

interface Filters {
  search: string; category: string; condition: string; min_price: string; max_price: string;
  negotiable: boolean; sort: string; page: number;
}

const EMPTY: Filters = { search: '', category: '', condition: '', min_price: '', max_price: '', negotiable: false, sort: 'newest', page: 1 };

export interface BrowseInitial { data: unknown; search: string; category: string; city: string | null }

function BrowseContent({ initial }: { initial?: BrowseInitial }) {
  const searchParams = useSearchParams();
  const [showFilters, setShowFilters] = useState(false);
  const cityName = cityBySlug(useCity().city)?.name;
  const [filters, setFilters] = useState<Filters>({ ...EMPTY, search: searchParams.get('q') || '', category: searchParams.get('category') || '' });

  // Keep filters in step with the URL (header search + category pills navigate within this page)
  useEffect(() => {
    setFilters((p) => ({ ...p, search: searchParams.get('q') || '', category: searchParams.get('category') || '', page: 1 }));
  }, [searchParams]);

  // One search request after the typing pauses; older requests are aborted and can never overwrite newer results
  const search = useDebouncedValue(filters.search, 300);

  // The first screen of results was rendered by the server. Use it only while the filters are still the ones it was built for.
  const { city } = useCity();
  const seeded = initial && initial.search === search && initial.category === filters.category && initial.city === city
    && !filters.condition && !filters.min_price && !filters.max_price && !filters.negotiable && filters.sort === 'newest' && filters.page === 1;

  const { data, isLoading, isFetching } = useProducts({
    search,
    category: filters.category,
    condition: filters.condition,
    min_price: filters.min_price ? Number(filters.min_price) : undefined,
    max_price: filters.max_price ? Number(filters.max_price) : undefined,
    negotiable: filters.negotiable || undefined,
    sort: filters.sort,
    page: filters.page,
    limit: 20,
  }, seeded ? initial?.data : undefined);

  const update = <K extends keyof Filters>(k: K, v: Filters[K]) => setFilters((p) => ({ ...p, [k]: v, page: k === 'page' ? (v as number) : 1 }));

  // Removable chips for everything that is currently narrowing the results
  const active: { key: keyof Filters; label: string }[] = [
    filters.category && { key: 'category' as const, label: CATEGORIES.find((c) => c.slug === filters.category)?.name ?? filters.category },
    filters.condition && { key: 'condition' as const, label: PRODUCT_CONDITIONS.find((c) => c.value === filters.condition)?.label ?? filters.condition },
    filters.min_price && { key: 'min_price' as const, label: `From Rs. ${filters.min_price}` },
    filters.max_price && { key: 'max_price' as const, label: `Up to Rs. ${filters.max_price}` },
    filters.negotiable && { key: 'negotiable' as const, label: 'Negotiable' },
  ].filter(Boolean) as { key: keyof Filters; label: string }[];

  const clear = (k: keyof Filters) => update(k, (typeof EMPTY[k] === 'boolean' ? false : '') as never);
  const totalPages: number = data?.total_pages ?? data?.totalPages ?? 1;
  const inputCls = 'h-10 w-full rounded-xl border border-gray-200 bg-white px-3 text-sm outline-none transition-shadow focus:border-green-500 focus:ring-4 focus:ring-green-500/10';

  return (
    <div className="page-container py-6 sm:py-8">
      <div className="mb-6">
        <h1 className="font-display text-3xl font-extrabold tracking-tight text-ink">
          {filters.category ? CATEGORIES.find((c) => c.slug === filters.category)?.name : filters.search ? `Results for “${filters.search}”` : 'Browse the marketplace'}
        </h1>
        <p className="mt-1 text-sm text-ink-muted" aria-live="polite">
          {isLoading ? 'Loading listings…' : `${data?.total ?? 0} ${data?.total === 1 ? 'item' : 'items'} from verified students`}
        </p>
      </div>

      {/* Toolbar */}
      <div className="sticky top-[118px] z-30 -mx-4 mb-5 flex flex-wrap items-center gap-2.5 bg-canvas/85 px-4 py-3 backdrop-blur-xl sm:mx-0 sm:rounded-2xl sm:border sm:border-gray-200/70 sm:bg-white/80 sm:px-4 sm:shadow-soft">
        <div className="relative min-w-[200px] flex-1">
          <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
          <input
            type="search"
            aria-label="Search listings"
            placeholder="Search within results…"
            value={filters.search}
            onChange={(e) => update('search', e.target.value)}
            className="h-11 w-full rounded-full border border-gray-200 bg-white pl-10 pr-10 text-sm outline-none transition-shadow focus:border-green-500 focus:ring-4 focus:ring-green-500/10"
          />
          {filters.search && (
            <button onClick={() => update('search', '')} aria-label="Clear search" className="absolute right-3 top-1/2 -translate-y-1/2 rounded-full p-1 text-gray-400 hover:bg-gray-100"><X className="h-4 w-4" /></button>
          )}
        </div>

        <select aria-label="Sort by" value={filters.sort} onChange={(e) => update('sort', e.target.value)} className="h-11 rounded-full border border-gray-200 bg-white px-4 text-sm font-medium text-ink-soft outline-none focus:border-green-500 focus:ring-4 focus:ring-green-500/10">
          {SORT_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>

        <motion.button
          whileTap={{ scale: 0.96 }}
          onClick={() => setShowFilters((v) => !v)}
          aria-expanded={showFilters}
          className={cn('flex h-11 items-center gap-2 rounded-full border px-4 text-sm font-semibold transition-colors', active.length ? 'border-green-600 bg-green-600 text-white' : 'border-gray-200 bg-white text-ink-soft hover:border-gray-300')}
        >
          <SlidersHorizontal className="h-4 w-4" /> Filters
          {active.length > 0 && <span className="flex h-5 w-5 items-center justify-center rounded-full bg-white text-xs font-bold text-green-700">{active.length}</span>}
        </motion.button>
      </div>

      {/* Filter panel (smooth height) */}
      <AnimatePresence initial={false}>
        {showFilters && (
          <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={{ duration: DURATION.normal, ease: EASE }} className="overflow-hidden">
            <div className="mb-5 rounded-2xl border border-gray-200/70 bg-white p-5 shadow-soft">
              <div className="grid gap-5 md:grid-cols-3">
                <div className="md:col-span-2">
                  <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-ink-muted">Condition</p>
                  <div className="flex flex-wrap gap-2">
                    {[{ value: '', label: 'Any' }, ...PRODUCT_CONDITIONS].map((c) => (
                      <button key={c.value} onClick={() => update('condition', c.value)} aria-pressed={filters.condition === c.value} className={cn('rounded-full border px-3.5 py-1.5 text-sm font-medium transition-all', filters.condition === c.value ? 'border-green-600 bg-green-50 text-green-800' : 'border-gray-200 text-ink-soft hover:border-gray-300')}>
                        {c.label}
                      </button>
                    ))}
                  </div>
                </div>
                <div>
                  <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-ink-muted">Price (Rs.)</p>
                  <div className="flex items-center gap-2">
                    <input type="number" inputMode="numeric" min={0} placeholder="Min" aria-label="Minimum price" value={filters.min_price} onChange={(e) => update('min_price', e.target.value)} className={inputCls} />
                    <span className="text-gray-300">–</span>
                    <input type="number" inputMode="numeric" min={0} placeholder="Max" aria-label="Maximum price" value={filters.max_price} onChange={(e) => update('max_price', e.target.value)} className={inputCls} />
                  </div>
                </div>
              </div>
              <div className="mt-5 flex items-center justify-between border-t border-gray-100 pt-4">
                <label className="flex cursor-pointer items-center gap-2.5 text-sm text-ink-soft">
                  <input type="checkbox" checked={filters.negotiable} onChange={(e) => update('negotiable', e.target.checked)} className="h-4 w-4 rounded accent-green-600" /> Negotiable only
                </label>
                {active.length > 0 && <button onClick={() => setFilters((p) => ({ ...EMPTY, search: p.search, sort: p.sort }))} className="text-sm font-semibold text-red-500 hover:text-red-600">Clear all</button>}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Active filter chips */}
      <AnimatePresence initial={false}>
        {active.length > 0 && (
          <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} className="mb-5 flex flex-wrap gap-2 overflow-hidden">
            <AnimatePresence initial={false}>
              {active.map((a) => (
                <motion.button key={a.key} layout initial={{ opacity: 0, scale: 0.85 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.85 }} transition={SPRING.snappy} onClick={() => clear(a.key)} aria-label={`Remove filter ${a.label}`} className="group flex items-center gap-1.5 rounded-full bg-green-100 py-1.5 pl-3.5 pr-2.5 text-sm font-medium text-green-800 transition-colors hover:bg-green-200">
                  {a.label} <X className="h-3.5 w-3.5 opacity-60 transition-opacity group-hover:opacity-100" />
                </motion.button>
              ))}
            </AnimatePresence>
          </motion.div>
        )}
      </AnimatePresence>

      <div className={cn('transition-opacity duration-200', isFetching && !isLoading && 'opacity-60')}>
        <ProductGrid products={data?.products || []} loading={isLoading} emptyMessage={cityName ? `No listings in ${cityName} match those filters yet. Try widening your search, or be the first to sell here.` : 'No listings match those filters. Try widening your search.'} />
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <nav aria-label="Pagination" className="mt-10 flex items-center justify-center gap-3">
          <button disabled={filters.page <= 1} onClick={() => update('page', filters.page - 1)} className="flex h-10 items-center gap-1 rounded-full border border-gray-200 bg-white px-4 text-sm font-semibold text-ink-soft transition-all hover:shadow-soft disabled:opacity-40">
            <ChevronLeft className="h-4 w-4" /> Previous
          </button>
          <span className="text-sm text-ink-muted">Page {filters.page} of {totalPages}</span>
          <button disabled={filters.page >= totalPages} onClick={() => update('page', filters.page + 1)} className="flex h-10 items-center gap-1 rounded-full border border-gray-200 bg-white px-4 text-sm font-semibold text-ink-soft transition-all hover:shadow-soft disabled:opacity-40">
            Next <ChevronRight className="h-4 w-4" />
          </button>
        </nav>
      )}
    </div>
  );
}

export default function BrowseClient({ initial }: { initial?: BrowseInitial }) {
  return (
    <Suspense fallback={<div className="page-container py-10"><div className="skeleton h-96 rounded-2xl" /></div>}>
      <BrowseContent initial={initial} />
    </Suspense>
  );
}
