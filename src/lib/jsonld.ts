/**
 * Pure builders for schema.org JSON-LD (rendered by components/seo/JsonLd.tsx). No server imports, so they are unit-tested in tests/seo.
 * Only real data goes in: no seller name (student privacy), no ratings/reviews, no contact details, no invented organisation facts.
 */
import { APP_NAME, CATEGORIES, PRODUCT_CONDITIONS, SITE_URL } from '@/lib/constants'
import { LAUNCH_CITIES } from '@/lib/cities'
import { SITE_DESCRIPTION } from '@/lib/seo'
import { getSupabaseImageUrl } from '@/lib/utils'

type Json = Record<string, unknown>

/** Absolute URL on the public origin for a site path such as "/browse?category=books". */
export const absoluteUrl = (path: string) => `${SITE_URL}${path.startsWith('/') ? path : `/${path}`}`

/** Serialises JSON-LD for an inline <script>. "<" is escaped so user-written text can never close the tag or open a new one. */
export function serializeJsonLd(data: unknown): string {
  return JSON.stringify(data).replace(/</g, '\\u003c')
}

export function organizationJsonLd(): Json {
  return {
    '@context': 'https://schema.org',
    '@type': 'Organization',
    name: APP_NAME,
    url: SITE_URL,
    logo: absoluteUrl('/brand/icon-512.png'),
    description: SITE_DESCRIPTION,
    areaServed: [
      { '@type': 'Country', name: 'Nepal' },
      ...LAUNCH_CITIES.map((c) => ({ '@type': 'City', name: c.name })),
    ],
  }
}

export function websiteJsonLd(): Json {
  return { '@context': 'https://schema.org', '@type': 'WebSite', name: APP_NAME, url: SITE_URL }
}

export interface Crumb { name: string; path: string }

export function breadcrumbJsonLd(crumbs: Crumb[]): Json {
  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: crumbs.map((c, i) => ({ '@type': 'ListItem', position: i + 1, name: c.name, item: absoluteUrl(c.path) })),
  }
}

/**
 * FAQPage from question/answer pairs. Pass the very array the page renders, so the markup can never drift from what visitors read.
 * Pairs with a blank question or answer are dropped (Google ignores FAQ markup that is not visible or is empty).
 */
export function faqJsonLd(items: { question: string; answer: string }[]): Json {
  return {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: items
      .filter((i) => i.question.trim() && i.answer.trim())
      .map((i) => ({ '@type': 'Question', name: i.question, acceptedAnswer: { '@type': 'Answer', text: i.answer } })),
  }
}

/** Home > Browse, plus the category for a valid slug. */
export function browseBreadcrumbJsonLd(categorySlug?: string | null): Json {
  const category = CATEGORIES.find((c) => c.slug === categorySlug)
  return breadcrumbJsonLd([
    { name: 'Home', path: '/' },
    { name: 'Browse', path: '/browse' },
    ...(category ? [{ name: category.name, path: `/browse?category=${category.slug}` }] : []),
  ])
}

export interface ProductLd {
  id: string
  title: string
  description?: string | null
  price: number | string
  condition?: string | null
  quantity?: number | null
  status?: string | null
  brand?: string | null
  images?: { storage_path: string; is_primary?: boolean }[] | null
  category?: { name?: string | null; slug?: string | null } | null
}

/** schema.org condition for our listing condition: only NEW is "new", everything else is second-hand. */
export function itemCondition(condition?: string | null): string {
  const known = PRODUCT_CONDITIONS.some((c) => c.value === condition)
  return known && condition === 'NEW' ? 'https://schema.org/NewCondition' : 'https://schema.org/UsedCondition'
}

/** Absolute https photo URLs (~1200px), primary first as given, without duplicates. */
export function productImageUrls(images?: { storage_path: string }[] | null): string[] {
  const urls = (images ?? [])
    .filter((i) => i?.storage_path)
    .map((i) => getSupabaseImageUrl(i.storage_path, 1200))
    .filter((u) => /^https:\/\//.test(u))
  return Array.from(new Set(urls))
}

/**
 * Product + Offer. `fallbackDescription` (the page's meta description) is used when the seller wrote no text.
 * Returns the Offer only when the price is a real number.
 */
export function productJsonLd(p: ProductLd, fallbackDescription: string): Json {
  const url = absoluteUrl(`/product/${p.id}`)
  const price = Number(p.price)
  const inStock = p.status === 'ACTIVE' && Number(p.quantity) > 0
  const text = String(p.description ?? '').replace(/\s+/g, ' ').trim().slice(0, 5000)
  const images = productImageUrls(p.images)
  const brand = String(p.brand ?? '').trim()
  const out: Json = {
    '@context': 'https://schema.org',
    '@type': 'Product',
    name: p.title,
    description: text || fallbackDescription,
    ...(images.length ? { image: images } : {}),
    sku: p.id,
    ...(p.category?.name ? { category: p.category.name } : {}),
    ...(brand ? { brand: { '@type': 'Brand', name: brand } } : {}),
    url,
  }
  if (Number.isFinite(price) && price >= 0) {
    out.offers = {
      '@type': 'Offer',
      url,
      priceCurrency: 'NPR',
      price: String(price),
      availability: inStock ? 'https://schema.org/InStock' : 'https://schema.org/SoldOut',
      itemCondition: itemCondition(p.condition),
    }
  }
  return out
}

/** Home > Browse > Category > Title (the category step is skipped if the listing has no valid category). */
export function productBreadcrumbJsonLd(p: Pick<ProductLd, 'id' | 'title' | 'category'>): Json {
  const cat = p.category?.slug && p.category?.name ? p.category : null
  return breadcrumbJsonLd([
    { name: 'Home', path: '/' },
    { name: 'Browse', path: '/browse' },
    ...(cat ? [{ name: cat.name as string, path: `/browse?category=${cat.slug}` }] : []),
    { name: p.title, path: `/product/${p.id}` },
  ])
}
