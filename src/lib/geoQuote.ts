/**
 * Where an item ships from, and what an order costs to a given address. Server-side.
 */
import type { SupabaseClient } from '@supabase/supabase-js'
import { centroidFor, haversineKm, priceOrder, DELIVERY, type OrderPricing } from '@/lib/pricing'

export interface Origin { lat: number; lon: number; estimated: boolean; address?: string | null }

/**
 * Coordinates of the seller's item. Uses the exact point the seller saved when listing; if the
 * listing has none (older listings), falls back to the centre of its city and flags it as estimated.
 */
export async function getOrigin(admin: SupabaseClient, productId: string, locationText?: string | null): Promise<Origin> {
  // Private table (migration 006). If it isn't there yet, or the listing has no row, use the city estimate.
  const { data, error } = await admin.from('product_pickups').select('latitude, longitude, address').eq('product_id', productId).maybeSingle()
  if (!error && data) return { lat: Number(data.latitude), lon: Number(data.longitude), estimated: false, address: data.address }
  const c = centroidFor(locationText)
  return { lat: c.lat, lon: c.lon, estimated: true }
}

export type QuoteResult =
  | { ok: true; pricing: OrderPricing; estimated: boolean }
  | { ok: false; error: string }

export function quoteFor(subtotal: number, origin: Origin, dest: { lat: number; lon: number }): QuoteResult {
  const km = haversineKm(origin, dest)
  if (km > DELIVERY.maxKm) {
    return { ok: false, error: `That address is ${km} km away. We currently deliver up to ${DELIVERY.maxKm} km.` }
  }
  return { ok: true, pricing: priceOrder(subtotal, km), estimated: origin.estimated }
}
