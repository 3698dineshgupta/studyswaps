/**
 * Address search + tamper-proof places — server-side ONLY.
 *
 * Search uses OpenStreetMap's Nominatim (no API key). Every result we hand to the browser is
 * SIGNED (HMAC), so when the browser later sends a place back with an order, we can prove the
 * coordinates came from us and were not edited to lower the delivery fee.
 */
import { createHmac, timingSafeEqual } from 'crypto'
import { LAUNCH_CITIES, cityBySlug, cityOfPoint, type CitySlug } from '@/lib/cities'

export interface Place {
  label: string
  lat: number
  lon: number
  city?: string
  sig: string
}

function secret(): string {
  const s = process.env.APP_SECRET || process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!s) throw new Error('APP_SECRET is not configured')
  return s
}

const payload = (label: string, lat: number, lon: number) => `${label}|${lat.toFixed(5)}|${lon.toFixed(5)}`
const sign = (label: string, lat: number, lon: number) => createHmac('sha256', secret()).update(payload(label, lat, lon)).digest('base64url')

export function signPlace(p: Omit<Place, 'sig'>): Place {
  return { ...p, sig: sign(p.label, p.lat, p.lon) }
}

export function verifyPlace(p: unknown): p is Place {
  if (!p || typeof p !== 'object') return false
  const { label, lat, lon, sig } = p as Place
  if (typeof label !== 'string' || typeof sig !== 'string' || typeof lat !== 'number' || typeof lon !== 'number') return false
  if (!Number.isFinite(lat) || !Number.isFinite(lon)) return false
  const a = Buffer.from(sign(label, lat, lon))
  const b = Buffer.from(sig)
  return a.length === b.length && timingSafeEqual(a, b)
}

// ---- Nominatim (polite: ≥1.1s between calls, cached) ----
const cache = new Map<string, { at: number; results: Place[] }>()
const CACHE_MS = 10 * 60 * 1000
let queue: Promise<unknown> = Promise.resolve()
let lastCall = 0

function throttled<T>(fn: () => Promise<T>): Promise<T> {
  const run = queue.then(async () => {
    const wait = Math.max(0, lastCall + 1100 - Date.now())
    if (wait) await new Promise((r) => setTimeout(r, wait))
    lastCall = Date.now()
    return fn()
  })
  queue = run.catch(() => undefined)
  return run
}

interface NominatimHit {
  lat: string
  lon: string
  display_name: string
  address?: Record<string, string>
}

function labelFor(hit: NominatimHit): { label: string; city?: string } {
  const a = hit.address ?? {}
  const city = a.city || a.town || a.municipality || a.village || a.county || a.state_district
  const parts = [a.road || a.neighbourhood || a.amenity || hit.display_name.split(',')[0], a.suburb || a.quarter, city]
    .filter((v, i, arr): v is string => !!v && arr.indexOf(v) === i)
  return { label: parts.length >= 2 ? parts.join(', ') : hit.display_name.split(',').slice(0, 3).join(',').trim(), city }
}

/** We only operate in the launch cities, so every place we hand out is inside one of them. */
const inLaunchArea = (lat: number, lon: number) => cityOfPoint(lat, lon) !== null

interface PhotonFeature { geometry: { coordinates: [number, number] }; properties: Record<string, string | undefined> }

/** Photon (OpenStreetMap-based typeahead search, no key needed). */
async function photonSearch(q: string, zones: typeof LAUNCH_CITIES): Promise<Place[]> {
  const all = await Promise.all(zones.map(async (z) => {
    const url = new URL('https://photon.komoot.io/api/')
    url.search = new URLSearchParams({ q, limit: '10', lang: 'en', lat: String(z.center.lat), lon: String(z.center.lon), bbox: `${z.viewbox[0]},${z.viewbox[1]},${z.viewbox[2]},${z.viewbox[3]}` }).toString()
    const res = await fetch(url, { headers: { 'User-Agent': 'StudySwaps/1.0 (student marketplace, Nepal)' }, signal: AbortSignal.timeout(8000) })
    if (!res.ok) return []
    return ((await res.json()).features ?? []) as PhotonFeature[]
  }))
  return all.flat().map((f) => {
    const p = f.properties
    const [lon, lat] = f.geometry.coordinates
    const head = p.name || p.street
    const parts = [head, p.name && p.street && p.street !== p.name ? p.street : undefined, p.district || p.locality, p.city || p.county]
      .filter((v, i, arr): v is string => !!v && arr.indexOf(v) === i)
    return { label: parts.slice(0, 3).join(', '), lat, lon, city: p.city }
  }).filter((r) => r.label && Number.isFinite(r.lat) && Number.isFinite(r.lon)).map((r) => signPlace(r))
}

export async function searchPlaces(query: string, city?: CitySlug | null): Promise<Place[]> {
  const q = query.trim().slice(0, 120)
  if (q.length < 2) return []
  const zone = cityBySlug(city)

  const key = `${city ?? '*'}|${q.toLowerCase()}`
  const hit = cache.get(key)
  if (hit && Date.now() - hit.at < CACHE_MS) return hit.results

  const nominatim = async (): Promise<Place[]> => {
    const url = new URL('https://nominatim.openstreetmap.org/search')
    const params: Record<string, string> = { q: zone && !q.toLowerCase().includes(zone.slug) ? `${q}, ${zone.name}` : q, format: 'jsonv2', addressdetails: '1', limit: '10', countrycodes: 'np', 'accept-language': 'en' }
    if (zone) { params.viewbox = zone.viewbox.join(','); params.bounded = '1' }
    url.search = new URLSearchParams(params).toString()
    const rows = await throttled(async () => {
      const res = await fetch(url, { headers: { 'User-Agent': 'StudySwaps/1.0 (student marketplace, Nepal)', Accept: 'application/json' }, signal: AbortSignal.timeout(10000) })
      if (!res.ok) throw new Error(`Address search failed (${res.status})`)
      return (await res.json()) as NominatimHit[]
    })
    return rows.map((r) => ({ ...labelFor(r), lat: Number(r.lat), lon: Number(r.lon) })).filter((r) => Number.isFinite(r.lat) && Number.isFinite(r.lon)).map((r) => signPlace(r))
  }

  // Photon understands partial words and named places (colleges, shops, chowks); Nominatim is strong on street addresses.
  // Ask both and merge — much closer to what a map app suggests.
  const [photon, nomi] = await Promise.allSettled([photonSearch(q, zone ? [zone] : LAUNCH_CITIES), nominatim()])
  if (photon.status === 'rejected' && nomi.status === 'rejected') throw nomi.reason
  const merged = [...(photon.status === 'fulfilled' ? photon.value : []), ...(nomi.status === 'fulfilled' ? nomi.value : [])]
  const results = merged
    .filter((r) => inLaunchArea(r.lat, r.lon))
    .filter((r, i, all) => all.findIndex((o) => o.label.toLowerCase() === r.label.toLowerCase()) === i)
    .slice(0, 10)

  cache.set(key, { at: Date.now(), results })
  if (cache.size > 300) cache.delete(cache.keys().next().value as string)
  return results
}

/** Drop-a-pin: turn map coordinates into a signed place (or null when the pin is outside our cities). */
export async function reversePlace(lat: number, lon: number): Promise<Place | null> {
  if (!Number.isFinite(lat) || !Number.isFinite(lon) || !inLaunchArea(lat, lon)) return null
  const url = new URL('https://nominatim.openstreetmap.org/reverse')
  url.search = new URLSearchParams({ lat: String(lat), lon: String(lon), format: 'jsonv2', addressdetails: '1', zoom: '17', 'accept-language': 'en' }).toString()
  const hit = await throttled(async () => {
    const res = await fetch(url, { headers: { 'User-Agent': 'StudySwaps/1.0 (student marketplace, Nepal)', Accept: 'application/json' }, signal: AbortSignal.timeout(10000) })
    if (!res.ok) throw new Error(`Reverse lookup failed (${res.status})`)
    return (await res.json()) as NominatimHit
  })
  const area = cityBySlug(cityOfPoint(lat, lon))!
  // Unmapped spot (no street or name nearby): still accept it, labelled by its city, so a pin is never refused inside our area
  if (!hit || !hit.display_name) return signPlace({ label: `Pinned location, ${area.name}`, lat, lon, city: area.name })
  const { label, city } = labelFor(hit)
  return signPlace({ label: cityOfPoint(lat, lon) && !label.toLowerCase().includes(area.slug) ? `${label}, ${area.name}` : label, lat, lon, city })
}
