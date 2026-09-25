/**
 * Copy for the public "How StudySwaps works" page (/how-it-works). Pure (no server imports), so it is unit-tested in tests/seo.
 * Every number comes from src/lib/pricing.ts / photos.ts and the city list, so nothing here can go stale; every statement
 * matches the policies page. The FAQ array is the ONE source for both the visible questions and the FAQPage JSON-LD.
 */
import { APP_NAME } from '@/lib/constants'
import { LAUNCH_CITIES } from '@/lib/cities'
import { DELIVERY, PLATFORM_FEE, SELLER_COMMISSION_RATE, WITHDRAWAL } from '@/lib/pricing'
import { PHOTO_MAX, PHOTO_MIN } from '@/lib/photos'
import { formatPrice } from '@/lib/utils'

export const HOW_PATH = '/how-it-works'
export const HOW_TITLE = 'How StudySwaps Works — Buy & Sell Second-hand with Verified Students'
export const HOW_SHARE_TITLE = 'How StudySwaps Works'
export const HOW_DESCRIPTION =
  'How StudySwaps works: browse and pay with eSewa, we deliver; or verify your student ID once and sell. Fees, payouts and safety explained.'

export const COMMISSION_PCT = `${Math.round(SELLER_COMMISSION_RATE * 100)}%`
export const PHOTO_RANGE = `${PHOTO_MIN}–${PHOTO_MAX}`
export const CITY_NAMES = LAUNCH_CITIES.map((c) => c.name)

/** "Kathmandu and Butwal" / "A, B and C" */
export const joinNames = (names: string[]) => (names.length > 1 ? `${names.slice(0, -1).join(', ')} and ${names[names.length - 1]}` : names[0] ?? '')

export interface FaqItem {
  question: string
  /** Plain text: shown as-is on the page and sent as-is in the FAQPage JSON-LD */
  answer: string
  /** Optional link shown under the answer (not part of the JSON-LD) */
  more?: { label: string; href: string }
}

export const HOW_FAQ: FaqItem[] = [
  {
    question: 'Is it free to list an item?',
    answer: `Yes, there is no listing fee. When your item sells, ${APP_NAME} keeps a ${COMMISSION_PCT} commission of the item price and you receive the rest. The delivery fee and the ${formatPrice(PLATFORM_FEE)} platform fee are paid by the buyer and never taken from your earnings.`,
    more: { label: 'Seller earnings & withdrawals', href: '/policies#payouts' },
  },
  {
    question: 'Who delivers the item?',
    answer: `${APP_NAME} does. The seller hands the item to us (or our delivery partner), we check it and deliver it to the buyer's address, so buyer and seller never need to meet, call or share their address.`,
    more: { label: 'Delivery policy', href: '/policies#delivery' },
  },
  {
    question: 'How much does delivery cost?',
    answer: `${formatPrice(DELIVERY.baseFee)} within ${DELIVERY.baseKm} km, plus ${formatPrice(DELIVERY.perExtraKm)} for every extra kilometre, up to ${DELIVERY.maxKm} km. The total is always shown before you pay.`,
  },
  {
    question: 'How do I pay?',
    answer: `With eSewa, which is the only payment method. There is no cash on delivery. You pay on eSewa's own secure page, and the order is confirmed once eSewa reports the payment as complete.`,
    more: { label: 'Payments', href: '/policies#payments' },
  },
  {
    question: 'How do sellers get paid?',
    answer: `Your earnings are held as pending after a sale and become available as soon as the order is marked delivered. You then withdraw to your eSewa number, from ${formatPrice(WITHDRAWAL.minAmount)} per request, and requests are processed ${WITHDRAWAL.processingText}.`,
  },
  {
    question: 'Do buyers need ID verification?',
    answer: `No. Anyone can sign up and buy. Only sellers verify their identity, once, with two live photos: the front of their student ID card and a selfie holding it.`,
    more: { label: 'Identity verification', href: '/policies#verification' },
  },
  {
    question: 'Which cities does StudySwaps serve?',
    answer: `We currently serve ${joinNames(CITY_NAMES)}. Delivery is available up to ${DELIVERY.maxKm} km from the item's location, and more areas will be added over time.`,
  },
  {
    question: `What can't I sell?`,
    answer: `Weapons, illegal drugs, alcohol, tobacco and medicines, stolen or counterfeit goods, exam papers and cheating services, government IDs and bank cards, hazardous chemicals and live animals are not allowed. The full list is in our policies.`,
    more: { label: 'Prohibited items', href: '/policies#prohibited' },
  },
]
