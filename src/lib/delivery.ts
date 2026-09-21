import { LAUNCH_CITIES } from '@/lib/cities'
/**
 * Delivery on the client: what the buyer enters at checkout, and how it's validated / shown.
 *
 * StudySwaps is the mediator — we collect from the seller and deliver to the buyer's address;
 * they never meet. Pricing lives in lib/pricing.ts (Rs 150 up to 10 km, +Rs 25 per extra km) and is
 * always recomputed on the server from a SIGNED address, so nothing here can change what is charged.
 */

/** Cities we launched in — used for filters and location labels on listings. */
export const SERVICE_CITIES = LAUNCH_CITIES.map((c) => c.name)

/** An address returned by our search (signed by the server). */
export interface PlaceSelection {
  label: string
  lat: number
  lon: number
  city?: string
  sig: string
}

/** What checkout collects (client state). */
export interface DeliverySelection {
  place: PlaceSelection | null
  /** House / building / street details */
  address_line: string
  landmark: string
}

export const initialDelivery: DeliverySelection = { place: null, address_line: '', landmark: '' }

/** Returns an error message for the current selection, or null when it is complete. */
export function validateDelivery(d: DeliverySelection): string | null {
  if (!d.place) return 'Search for your area and pick it from the list'
  if (d.address_line.trim().length < 5) return 'Enter your house / street details'
  if (d.landmark.trim().length < 3) return 'Add a landmark so our rider can find you'
  return null
}

/** Short human summary for the review step. */
export function describeDelivery(d: DeliverySelection): { title: string; detail: string } {
  if (!d.place) return { title: 'Home delivery', detail: '—' }
  return { title: 'Home delivery', detail: `${d.address_line.trim()}, ${d.place.label} — near ${d.landmark.trim()}` }
}
