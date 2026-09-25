/**
 * Pure helpers for page metadata (titles, descriptions, share images). No server imports, so they are unit-tested in tests/seo.
 * Everything here is built from real data; nothing is invented (a piece that is missing is simply left out).
 */
import { APP_NAME, CATEGORIES, PRODUCT_CONDITIONS } from '@/lib/constants'
import { cityFromText, cityBySlug } from '@/lib/cities'
import { formatPrice, getSupabaseImageUrl } from '@/lib/utils'

export const SITE_DESCRIPTION =
  'StudySwaps: verified students in Nepal buy and sell second-hand books, laptops and hostel items in Kathmandu & Butwal, delivered without meeting the seller.'

// Absolute title (skips the "| StudySwaps" template, which would double the brand)
export const HOME_TITLE = 'StudySwaps — Second-hand Books, Laptops & Hostel Items in Nepal'

export const BROWSE_SEO = {
  title: 'Browse Second-hand Books, Laptops & More for Students',
  description:
    'Browse second-hand books, laptops, furniture, hostel items and more from verified students in Nepal. Pay securely and get it delivered without meeting the seller.',
}

// Hand-written per category: "Agri Equipment" or "Other" would read badly in a mechanical "<name> for sale" template.
// Keys must cover every slug in CATEGORIES (checked by tests/seo/metadata.test.ts).
export const CATEGORY_SEO: Record<string, { title: string; description: string }> = {
  books: {
    title: 'Second-hand Books & Notes for Students in Nepal',
    description: 'Buy used textbooks, reference books and study notes from verified students in Nepal at student-friendly prices, delivered without meeting the seller.',
  },
  electronics: {
    title: 'Used Laptops & Electronics for Students in Nepal',
    description: 'Find second-hand laptops, phones, calculators and other electronics from verified students in Nepal. Secure payment, delivered without meeting the seller.',
  },
  furniture: {
    title: 'Second-hand Furniture for Students in Nepal',
    description: 'Shop used desks, chairs, shelves and other student furniture from verified students in Nepal. Secure payment, delivered without meeting the seller.',
  },
  clothing: {
    title: 'Second-hand Clothing for Students in Nepal',
    description: 'Buy pre-loved jackets, uniforms and everyday clothing from verified students in Nepal at low prices, delivered without meeting the seller.',
  },
  bicycles: {
    title: 'Used Bicycles for Students in Nepal',
    description: 'Find second-hand bicycles for getting around campus from verified students in Nepal. Secure payment, delivered without meeting the seller.',
  },
  'hostel-items': {
    title: 'Second-hand Hostel Items for Students in Nepal',
    description: 'Get hostel essentials like bedding, kitchenware, heaters and fans second-hand from verified students in Nepal, delivered without meeting the seller.',
  },
  'lab-equipment': {
    title: 'Second-hand Lab Equipment for Students in Nepal',
    description: 'Buy used lab equipment and practical-class supplies from verified students in Nepal at student-friendly prices, delivered without meeting the seller.',
  },
  'agricultural-equipment': {
    title: 'Second-hand Agricultural Equipment for Students',
    description: 'Find used agricultural tools and equipment for agriculture and forestry courses from verified students in Nepal, delivered without meeting the seller.',
  },
  other: {
    title: 'More Second-hand Finds for Students in Nepal',
    description: 'Browse other second-hand items listed by verified students in Nepal, from study gear to everyday things, delivered without meeting the seller.',
  },
}

/** Title + description for a /browse?category=<slug> page, or the generic /browse copy when the slug is missing or unknown. */
export function browseSeo(slug?: string | null) {
  const valid = CATEGORIES.some((c) => c.slug === slug)
  return (valid && slug && CATEGORY_SEO[slug]) || BROWSE_SEO
}

/** Shortens text to at most `max` characters, cutting at a word boundary and adding "…" only when something was cut. */
export function trimAtWord(text: string, max: number): string {
  const clean = text.replace(/\s+/g, ' ').trim()
  if (clean.length <= max) return clean
  if (max <= 1) return ''
  const room = clean.slice(0, max - 1) // leave one character for the ellipsis
  // Cut is at a word boundary already if the next character after the slice is a space
  const atBoundary = clean[max - 1] === ' '
  const cut = atBoundary ? room : room.slice(0, Math.max(room.lastIndexOf(' '), 0))
  const out = cut.replace(/[\s,;:.\-–—]+$/, '')
  return out ? `${out}…` : ''
}

export interface ProductSeoInput {
  title: string
  price: number | string
  condition?: string | null
  location?: string | null
  description?: string | null
  delivery_available?: boolean | null
  /** Only claim "verified student" when the seller really is VERIFIED */
  sellerVerified?: boolean
}

/** Human place name for a listing location: the launch city if we recognise one, else the first part of the text. */
function placeName(location?: string | null): string {
  const city = cityBySlug(cityFromText(location))
  if (city) return city.name
  return (location ?? '').split(',')[0].trim()
}

/** Meta description for a listing, built from its real fields, max 155 characters. */
export function buildProductDescription(p: ProductSeoInput, max = 155): string {
  const cond = PRODUCT_CONDITIONS.find((c) => c.value === p.condition)?.label
  const place = placeName(p.location)
  const price = Number(p.price)
  const title = String(p.title ?? '').replace(/\s+/g, ' ').trim()

  const head = `${title}${cond ? ` — ${cond} condition` : ''}${Number.isFinite(price) ? `${cond ? ',' : ' —'} ${formatPrice(price)}` : ''}${place ? ` in ${place}` : ''}.`
  // Optional sentences, dropped last-first when they do not fit
  const extras = [
    p.sellerVerified ? 'Sold by a verified student on StudySwaps.' : '',
    p.delivery_available ? 'Delivered to your door.' : '',
  ].filter(Boolean)
  while (extras.length && [head, ...extras].join(' ').length > max) extras.pop()

  // Hard cut only as a last resort, for a single absurdly long word
  let out = trimAtWord([head, ...extras].join(' '), max) || head.slice(0, max)

  // Add the start of the seller's own text if there is a useful amount of room left (skip it if it only repeats what the sentence above already says, e.g. "Good condition")
  const text = String(p.description ?? '').replace(/\s+/g, ' ').trim()
  const room = max - out.length - 1
  const redundant = !text || out.toLowerCase().includes(text.replace(/[\s.,!]+$/, '').toLowerCase())
  if (!redundant && room >= 25) {
    const snippet = trimAtWord(text, room)
    if (snippet) out = `${out} ${snippet}`
  }
  return out
}

/** Absolute https URL (~1200px wide) of the listing's primary photo, or null if it has none (the site default share image is used then). */
export function productImageUrl(images?: { storage_path: string; is_primary?: boolean }[] | null): string | null {
  const list = images ?? []
  const img = list.find((i) => i.is_primary) ?? list[0]
  if (!img?.storage_path) return null
  const url = getSupabaseImageUrl(img.storage_path, 1200)
  return /^https:\/\//.test(url) ? url : null
}

/**
 * Site-wide share image (src/app/opengraph-image.png, 1200x630). A page that sets its own `openGraph` no longer inherits
 * the file-based image from the root, so pages without a better picture pass this explicitly.
 */
export const DEFAULT_SHARE_IMAGE = { url: '/opengraph-image.png', width: 1200, height: 630, alt: APP_NAME }
