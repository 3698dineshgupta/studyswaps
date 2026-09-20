'use client';

import { useEffect, useId, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import dynamic from 'next/dynamic';
import { ExternalLink, Loader2, Map as MapIcon, MapPin, Search, X } from 'lucide-react';
import { useCity } from '@/components/city/CityProvider';
import { popover } from '@/lib/motion';
import { cn } from '@/lib/utils';
import type { PlaceSelection } from '@/lib/delivery';

// Leaflet touches `window`, so the map only loads in the browser, and only when opened
const MapPicker = dynamic(() => import('./MapPicker'), { ssr: false, loading: () => <div className="mt-3 h-64 animate-pulse rounded-2xl bg-gray-100 sm:h-72" /> });

interface AddressSearchProps {
  value: PlaceSelection | null;
  onChange: (place: PlaceSelection | null) => void;
  label?: string;
  placeholder?: string;
  error?: boolean;
  /** Offer a "pick on the map" pin (Kathmandu / Butwal) */
  showMap?: boolean;
}

/**
 * Address search with live suggestions. Results come from our own /api/geocode (signed places),
 * so the chosen location can't be tampered with before it's priced.
 */
export default function AddressSearch({ value, onChange, label = 'Search your area', placeholder, error, showMap = false }: AddressSearchProps) {
  const { city } = useCity();
  const [mapOpen, setMapOpen] = useState(false);
  const id = useId();
  const [query, setQuery] = useState(value?.label ?? '');
  const [results, setResults] = useState<PlaceSelection[]>([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [failed, setFailed] = useState<string | null>(null);
  const [active, setActive] = useState(-1);
  const box = useRef<HTMLDivElement>(null);
  const seq = useRef(0);

  // Debounced search; stale responses are ignored
  useEffect(() => {
    if (value && query === value.label) return;
    const q = query.trim();
    if (q.length < 2) { setResults([]); setFailed(null); return; }
    const mine = ++seq.current;
    const t = setTimeout(async () => {
      setLoading(true);
      setFailed(null);
      try {
        const res = await fetch(`/api/geocode?q=${encodeURIComponent(q)}${city ? `&city=${city}` : ''}`);
        const json = await res.json().catch(() => ({}));
        if (mine !== seq.current) return;
        if (!res.ok) throw new Error(json.error || 'Search failed');
        setResults(json.places ?? []);
        setOpen(true);
        setActive(-1);
      } catch (e) {
        if (mine === seq.current) setFailed((e as Error).message);
      } finally {
        if (mine === seq.current) setLoading(false);
      }
    }, 300);
    return () => clearTimeout(t);
  }, [query, value, city]);

  useEffect(() => {
    const onDown = (e: MouseEvent) => { if (box.current && !box.current.contains(e.target as Node)) setOpen(false); };
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, []);

  const pick = (p: PlaceSelection) => { onChange(p); setQuery(p.label); setOpen(false); setResults([]); };
  // A pin dropped on the map fills the box too
  const pinned = (p: PlaceSelection) => { onChange(p); setQuery(p.label); setResults([]); };
  const clear = () => { onChange(null); setQuery(''); setResults([]); };

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (!open || !results.length) return;
    if (e.key === 'ArrowDown') { e.preventDefault(); setActive((a) => Math.min(a + 1, results.length - 1)); }
    if (e.key === 'ArrowUp') { e.preventDefault(); setActive((a) => Math.max(a - 1, 0)); }
    if (e.key === 'Enter' && active >= 0) { e.preventDefault(); pick(results[active]); }
    if (e.key === 'Escape') setOpen(false);
  };

  return (
    <div ref={box} className="relative">
      <label htmlFor={id} className="mb-1.5 block text-sm font-semibold text-ink-soft">{label}</label>
      <div className="relative">
        <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
        <input
          id={id}
          role="combobox"
          aria-expanded={open}
          aria-controls={`${id}-list`}
          aria-autocomplete="list"
          autoComplete="off"
          value={query}
          onChange={(e) => { setQuery(e.target.value); if (value) onChange(null); }}
          onFocus={() => results.length && setOpen(true)}
          onKeyDown={onKeyDown}
          placeholder={placeholder ?? (city === 'butwal' ? 'e.g. Traffic Chowk, Butwal' : 'e.g. Baneshwor, Kathmandu')}
          className={cn(
            'h-12 w-full rounded-xl border bg-white pl-10 pr-10 text-sm outline-none transition-shadow placeholder:text-gray-400 focus:ring-4',
            error ? 'border-red-300 focus:border-red-400 focus:ring-red-500/10' : value ? 'border-green-500 focus:ring-green-500/10' : 'border-gray-200 focus:border-green-500 focus:ring-green-500/10'
          )}
        />
        <div className="absolute right-3 top-1/2 -translate-y-1/2">
          {loading ? <Loader2 className="h-4 w-4 animate-spin text-gray-400" /> : query ? (
            <button type="button" onClick={clear} aria-label="Clear address" className="rounded-full p-1 text-gray-400 hover:bg-gray-100"><X className="h-4 w-4" /></button>
          ) : null}
        </div>
      </div>

      <AnimatePresence>
        {open && (results.length > 0 || failed) && (
          <motion.ul
            id={`${id}-list`}
            role="listbox"
            variants={popover}
            initial="hidden"
            animate="show"
            exit="hidden"
            className="absolute z-30 mt-2 max-h-72 w-full overflow-auto rounded-2xl border border-gray-200/70 bg-white py-1.5 shadow-lift"
          >
            {failed ? (
              <li className="px-4 py-3 text-sm text-red-600">{failed}</li>
            ) : results.map((p, i) => (
              <li key={p.sig} role="option" aria-selected={i === active}>
                <button type="button" onClick={() => pick(p)} onMouseEnter={() => setActive(i)} className={cn('flex w-full items-start gap-3 px-4 py-2.5 text-left text-sm transition-colors', i === active ? 'bg-green-50' : 'hover:bg-gray-50')}>
                  <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-green-600" />
                  <span className="text-ink-soft">{p.label}</span>
                </button>
              </li>
            ))}
          </motion.ul>
        )}
      </AnimatePresence>
      {!value && query.trim().length >= 2 && !loading && !results.length && !failed && (
        <p className="mt-1.5 text-xs text-ink-muted">No matches yet — try a nearby well-known area or tole name, or set it on the map.</p>
      )}

      {showMap && (
        <>
          <div className="mt-2.5 flex flex-wrap items-center gap-2">
            <button type="button" onClick={() => setMapOpen((o) => !o)} aria-expanded={mapOpen} className="inline-flex items-center gap-1.5 rounded-full border border-gray-200 bg-white px-3.5 py-1.5 text-xs font-semibold text-ink-soft transition-colors hover:border-green-300 hover:text-green-800 active:scale-95">
              <MapIcon className="h-3.5 w-3.5 text-green-600" /> {mapOpen ? 'Hide map' : 'Pick on map'}
            </button>
            {value && (
              <a href={`https://www.google.com/maps?q=${value.lat},${value.lon}`} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-xs font-semibold text-green-700 hover:text-green-800">
                Open in Google Maps <ExternalLink className="h-3 w-3" />
              </a>
            )}
          </div>
          {mapOpen && <MapPicker value={value} city={city ?? 'kathmandu'} onPick={pinned} />}
        </>
      )}
    </div>
  );
}
