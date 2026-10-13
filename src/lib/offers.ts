/**
 * Price negotiation ("Make an offer") — rules shared by the API routes.
 *
 * A buyer offers a price on a listing the seller marked negotiable. The seller accepts, rejects, or counters
 * ONCE; if countered, the buyer accepts or rejects that counter. There is no open-ended back-and-forth, so the
 * state machine stays small and auditable:
 *
 *   PENDING --seller--> ACCEPTED | REJECTED | COUNTERED
 *   COUNTERED --buyer--> ACCEPTED | REJECTED
 *   ACCEPTED --buyer checks out--> FULFILLED        (or expires untouched --> EXPIRED)
 *
 * All money stays server-side: the accepted `amount` is substituted for the listing price only for the buyer
 * who made that offer, only while the offer is ACCEPTED and unexpired (see /api/cart and /api/orders).
 */

/** How long an accepted offer stays honourable before the buyer must check out. */
export const OFFER_ACCEPT_WINDOW_MS = 48 * 60 * 60 * 1000 // 48 hours

/** An offer must be at least this fraction of the asking price — stops throwaway Rs. 1 offers. */
export const MIN_OFFER_FRACTION = 0.1
/** ...and can never exceed the asking price (that is just buying it). */
export const MAX_OFFER_FRACTION = 1

export type OfferAmountError = 'TOO_LOW' | 'TOO_HIGH'

/** Validate a buyer's (or seller's counter) amount against the listing price. */
export function checkOfferAmount(amount: number, listingPrice: number): OfferAmountError | null {
  if (amount < Math.ceil(listingPrice * MIN_OFFER_FRACTION)) return 'TOO_LOW'
  if (amount > listingPrice * MAX_OFFER_FRACTION) return 'TOO_HIGH'
  return null
}

export const round2 = (n: number) => Math.round(n * 100) / 100
