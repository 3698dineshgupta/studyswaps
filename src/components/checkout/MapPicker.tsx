'use client';

import { useEffect, useRef, useState } from 'react';
import { Crosshair, Loader2 } from 'lucide-react';
import 'leaflet/dist/leaflet.css';
import type { Map as LeafletMap, Marker } from 'leaflet';
import { cityBySlug, type CitySlug } from '@/lib/cities';
import type { PlaceSelection } from '@/lib/delivery';

interface MapPickerProps {
  value: PlaceSelection | null;
  city: CitySlug;
  onPick: (place: PlaceSelection) => void;
}

const PIN = `<svg xmlns="http://www.w3.org/2000/svg" width="34" height="44" viewBox="0 0 34 44"><path d="M17 43C17 43 2 27.5 2 16.5 2 8 8.7 1.5 17 1.5S32 8 32 16.5C32 27.5 17 43 17 43Z" fill="#16a34a" stroke="#fff" stroke-width="3"/><circle cx="17" cy="16.5" r="5.5" fill="#fff"/></svg>`;

/**
 * Tap the map or drag the pin to set the location. OpenStreetMap tiles via Leaflet (no API key needed);
 * every pin is turned into a signed address by our server, so it can't be tampered with before pricing.
 */
export default function MapPicker({ value, city, onPick }: MapPickerProps) {
  const el = useRef<HTMLDivElement>(null);
  const map = useRef<LeafletMap | null>(null);
  const marker = useRef<Marker | null>(null);
  const seq = useRef(0);
  const onPickRef = useRef(onPick);
  onPickRef.current = onPick;
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const resolve = async (lat: number, lon: number) => {
    const mine = ++seq.current;
    setBusy(true);
    setError('');
    try {
      const res = await fetch(`/api/geocode/reverse?lat=${lat}&lon=${lon}`);
      const json = await res.json().catch(() => ({}));
      if (mine !== seq.current) return;
      if (!res.ok) throw new Error(json.error || 'Could not read that spot');
      onPickRef.current(json.place as PlaceSelection);
    } catch (e) {
      if (mine === seq.current) setError((e as Error).message);
    } finally {
      if (mine === seq.current) setBusy(false);
    }
  };

  // Create the map once
  useEffect(() => {
    let dead = false;
    (async () => {
      const L = (await import('leaflet')).default;
      if (dead || !el.current || map.current) return;
      const c = cityBySlug(city)!;
      const start: [number, number] = value ? [value.lat, value.lon] : [c.center.lat, c.center.lon];
      const m = L.map(el.current, { center: start, zoom: value ? 16 : 13, minZoom: 11, zoomControl: true, attributionControl: true });
      L.tileLayer('/api/tiles/{z}/{x}/{y}', { maxZoom: 19, attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>' }).addTo(m);

      const icon = L.divIcon({ html: PIN, className: 'sm-pin', iconSize: [34, 44], iconAnchor: [17, 43] });
      const mk = L.marker(start, { icon, draggable: true, opacity: value ? 1 : 0.55 }).addTo(m);
      mk.on('dragend', () => { const p = mk.getLatLng(); mk.setOpacity(1); void resolve(p.lat, p.lng); });
      m.on('click', (e) => { mk.setLatLng(e.latlng); mk.setOpacity(1); void resolve(e.latlng.lat, e.latlng.lng); });
      map.current = m;
      marker.current = mk;
      setTimeout(() => m.invalidateSize(), 50);
    })();
    return () => { dead = true; map.current?.remove(); map.current = null; marker.current = null; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // A search result (or the city switch) moves the pin
  useEffect(() => {
    const m = map.current, mk = marker.current;
    if (!m || !mk || !value) return;
    const cur = mk.getLatLng();
    if (Math.abs(cur.lat - value.lat) < 1e-5 && Math.abs(cur.lng - value.lon) < 1e-5) return;
    mk.setLatLng([value.lat, value.lon]);
    mk.setOpacity(1);
    m.flyTo([value.lat, value.lon], Math.max(m.getZoom(), 16), { duration: 0.6 });
  }, [value]);

  const locate = () => {
    if (!navigator.geolocation) { setError('Location is not available on this device'); return; }
    setBusy(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const { latitude: lat, longitude: lon } = pos.coords;
        marker.current?.setLatLng([lat, lon]);
        marker.current?.setOpacity(1);
        map.current?.flyTo([lat, lon], 17, { duration: 0.6 });
        void resolve(lat, lon);
      },
      () => { setBusy(false); setError('Could not get your location. Tap the map instead.'); },
      { enableHighAccuracy: true, timeout: 10000 },
    );
  };

  return (
    <div className="mt-3">
      <div className="relative isolate z-0 overflow-hidden rounded-2xl border border-gray-200 shadow-soft">
        <div ref={el} className="h-64 w-full bg-gray-100 sm:h-72" role="application" aria-label="Map — tap to place the pin, or drag it" />
        <button type="button" onClick={locate} className="absolute right-3 top-3 z-[500] flex items-center gap-1.5 rounded-full bg-white px-3 py-1.5 text-xs font-semibold text-ink shadow-lift transition-transform active:scale-95">
          <Crosshair className="h-3.5 w-3.5 text-green-600" /> Use my location
        </button>
        {busy && <div className="absolute bottom-3 left-3 z-[500] flex items-center gap-2 rounded-full bg-white px-3 py-1.5 text-xs font-medium text-ink-soft shadow-lift"><Loader2 className="h-3.5 w-3.5 animate-spin text-green-600" /> Finding address…</div>}
      </div>
      <p className="mt-2 text-xs text-ink-muted">Tap the map or drag the pin to the exact spot.</p>
      {error && <p role="alert" className="mt-1 text-xs font-medium text-red-600">{error}</p>}
    </div>
  );
}
