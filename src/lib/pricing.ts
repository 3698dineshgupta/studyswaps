/**
 * StudySwaps money rules — the single source of truth for fees, delivery pricing
 * and payouts. Used by the checkout UI (to display), the orders API (to charge) and the
 * wallet code (to credit / release). The server ALWAYS recomputes; the UI only displays.
 *
 *  BUYER pays      items + delivery fee + platform fee                (eSewa only)
 *  SELLER earns    items − 5% commission                              (held, then withdrawable)
 *  PLATFORM keeps  delivery fee + platform fee + 5% commission
 */

/** Flat fee charged to the buyer on every order. */
export const PLATFORM_FEE = 20

/** Share of the item price deducted from the seller once the item is sold. */
export const SELLER_COMMISSION_RATE = 0.05

export const DELIVERY = {
  /** Charged for any delivery up to `baseKm`. */
  baseFee: 150,
  baseKm: 10,
  /** Added for every started kilometre beyond `baseKm`. */
  perExtraKm: 25,
  /** We don't deliver further than this. */
  maxKm: 100,
} as const

export const WITHDRAWAL = {
  method: 'ESEWA',
  minAmount: 100,
  maxAmount: 100_000,
  /** Days after delivery before an unconfirmed order's earnings become withdrawable. */
  releaseDays: 3,
  /** How long payouts take once requested (shown to sellers; set to match your finance process). */
  processingText: 'within 2 working days',
} as const

const round2 = (n: number) => Math.round(n * 100) / 100

/** Great-circle distance in km (straight line), rounded to 0.1 km. */
export function haversineKm(a: { lat: number; lon: number }, b: { lat: number; lon: number }): number {
  const R = 6371
  const rad = (d: number) => (d * Math.PI) / 180
  const dLat = rad(b.lat - a.lat)
  const dLon = rad(b.lon - a.lon)
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLon / 2) ** 2
  return Math.round(2 * R * Math.asin(Math.sqrt(h)) * 10) / 10
}

/** Rs 150 up to 10 km, then + Rs 25 for each started km beyond that. */
export function deliveryFeeForKm(km: number): number {
  if (km <= DELIVERY.baseKm) return DELIVERY.baseFee
  return DELIVERY.baseFee + DELIVERY.perExtraKm * Math.ceil(km - DELIVERY.baseKm)
}

export const commissionFor = (subtotal: number) => round2(subtotal * SELLER_COMMISSION_RATE)

export interface OrderPricing {
  distanceKm: number
  subtotal: number
  deliveryFee: number
  platformFee: number
  /** What the buyer pays in total */
  total: number
  /** Deducted from the seller (5% of the item price) */
  commission: number
  /** What the seller receives (held until released) */
  sellerNet: number
}

export function priceOrder(subtotal: number, distanceKm: number): OrderPricing {
  const deliveryFee = deliveryFeeForKm(distanceKm)
  const commission = commissionFor(subtotal)
  return {
    distanceKm,
    subtotal: round2(subtotal),
    deliveryFee,
    platformFee: PLATFORM_FEE,
    total: round2(subtotal + deliveryFee + PLATFORM_FEE),
    commission,
    sellerNet: round2(subtotal - commission),
  }
}

/** Rough centres of the cities we launched in — used only when a listing has no exact coordinates. */
export const CITY_CENTROIDS: Record<string, { lat: number; lon: number }> = {
  kathmandu: { lat: 27.7172, lon: 85.324 },
  lalitpur: { lat: 27.6588, lon: 85.3247 },
  bhaktapur: { lat: 27.671, lon: 85.4298 },
  butwal: { lat: 27.7006, lon: 83.4483 },
}

export function centroidFor(locationText?: string | null): { lat: number; lon: number; estimated: true } {
  const text = (locationText ?? '').toLowerCase()
  const hit = Object.entries(CITY_CENTROIDS).find(([city]) => text.includes(city))
  return { ...(hit ? hit[1] : CITY_CENTROIDS.kathmandu), estimated: true }
}
