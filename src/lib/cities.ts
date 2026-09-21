/**
 * The cities StudySwaps has launched in. One list drives everything: who sees which listings,
 * where addresses can be searched, the sign-up city choice and the delivery area.
 */
import { haversineKm } from '@/lib/pricing'

export const CITY_COOKIE = 'sm_city'

export type CitySlug = 'kathmandu' | 'butwal'

export interface LaunchCity {
  slug: CitySlug
  name: string
  center: { lat: number; lon: number }
  /** Everything within this many km of the centre counts as this city */
  radiusKm: number
  /** Place names that mean "this city" when they appear in a listing's location text */
  keywords: string[]
  /** Nominatim search box: west, south, east, north */
  viewbox: [number, number, number, number]
  blurb: string
}

export const LAUNCH_CITIES: LaunchCity[] = [
  {
    slug: 'kathmandu', name: 'Kathmandu', center: { lat: 27.7172, lon: 85.324 }, radiusKm: 24,
    keywords: ['kathmandu', 'lalitpur', 'bhaktapur', 'patan', 'kirtipur', 'budhanilkantha', 'tokha', 'madhyapur', 'thimi', 'godawari', 'baneshwor', 'thamel'],
    viewbox: [85.18, 27.58, 85.53, 27.83], blurb: 'Kathmandu Valley',
  },
  {
    slug: 'butwal', name: 'Butwal', center: { lat: 27.7006, lon: 83.4483 }, radiusKm: 20,
    keywords: ['butwal', 'devdaha', 'tilottama', 'siddharthanagar', 'sainamaina', 'rupandehi', 'manigram'],
    viewbox: [83.33, 27.6, 83.58, 27.8], blurb: 'Butwal & Rupandehi',
  },
];

export const isCitySlug = (v: unknown): v is CitySlug => v === 'kathmandu' || v === 'butwal';
export const cityBySlug = (slug: CitySlug | null | undefined) => LAUNCH_CITIES.find((c) => c.slug === slug) ?? null;

/** Which launch city does a piece of place text ("Baneshwor, Kathmandu") belong to? */
export function cityFromText(text?: string | null): CitySlug | null {
  const t = (text ?? '').toLowerCase();
  if (!t) return null;
  return LAUNCH_CITIES.find((c) => c.keywords.some((k) => t.includes(k)))?.slug ?? null;
}

/** Which launch city is this map point in (null = outside every launch area)? */
export function cityOfPoint(lat: number, lon: number): CitySlug | null {
  let best: { slug: CitySlug; d: number } | null = null;
  for (const c of LAUNCH_CITIES) {
    const d = haversineKm({ lat, lon }, c.center);
    if (d <= c.radiusKm && (!best || d < best.d)) best = { slug: c.slug, d };
  }
  return best?.slug ?? null;
}

/** PostgREST `or=` filter that keeps only listings located in the city. */
export function cityOrFilter(slug: CitySlug): string {
  const c = cityBySlug(slug);
  return (c?.keywords ?? []).map((k) => `location.ilike.%${k}%`).join(',');
}

/** Make sure a location label carries the city name (so city filtering is reliable). */
export function withCityName(label: string, slug: CitySlug): string {
  const c = cityBySlug(slug)!;
  return cityFromText(label) === slug ? label : `${label}, ${c.name}`;
}
