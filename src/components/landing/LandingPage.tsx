import Link from 'next/link'
import { ChevronRight } from 'lucide-react'
import ProductGrid from '@/components/marketplace/ProductGrid'
import JsonLd from '@/components/seo/JsonLd'
import { breadcrumbJsonLd } from '@/lib/jsonld'
import { CATEGORIES } from '@/lib/constants'
import { LAUNCH_CITIES, cityBySlug, type CitySlug } from '@/lib/cities'
import { cityCategoryLinkText, cityLinkText, landingCrumbs, landingPath, type LandingSeo } from '@/lib/landing'
import { LANDING_PAGE_SIZE } from '@/lib/landingData'
import type { ListResult } from '@/lib/productList'

interface Props {
  city: CitySlug
  /** Set on a city x category page */
  categorySlug?: string
  seo: LandingSeo
  listings: ListResult | null
  /** Listings per category in this city (null: unknown, so every category is linked) */
  counts: Record<string, number> | null
}

const chip = 'inline-flex items-center gap-1.5 rounded-full border border-gray-200 bg-white px-3.5 py-1.5 text-sm font-medium text-ink-soft transition-colors hover:border-green-600 hover:text-green-700'

/** Server-rendered body of /second-hand/<city> and /second-hand/<city>/<category>. Only the product cards are client components. */
export default function LandingPage({ city, categorySlug, seo, listings, counts }: Props) {
  const cityName = cityBySlug(city)?.name ?? ''
  const category = CATEGORIES.find((c) => c.slug === categorySlug)
  const crumbs = landingCrumbs(city, categorySlug)
  const products = listings?.products ?? []
  const total = listings?.total ?? 0
  const otherCities = LAUNCH_CITIES.filter((c) => c.slug !== city)
  // Only categories that really have listings are linked (empty pages are noindex); if the counts are unknown, link them all
  const shownCategories = CATEGORIES.filter((c) => c.slug !== categorySlug && (counts ? (counts[c.slug] ?? 0) > 0 : true))
  const browseHref = category ? `/browse?category=${category.slug}` : '/browse'

  return (
    <div className="page-container py-6 sm:py-8">
      <JsonLd data={breadcrumbJsonLd(crumbs)} />

      <nav aria-label="Breadcrumb" className="mb-4 text-sm text-ink-muted">
        <ol className="flex flex-wrap items-center gap-1">
          {crumbs.map((c, i) => (
            <li key={c.path} className="flex items-center gap-1">
              {i > 0 && <ChevronRight className="h-3.5 w-3.5 text-gray-300" aria-hidden />}
              {i === crumbs.length - 1 ? <span aria-current="page" className="font-medium text-ink-soft">{c.name}</span> : <Link href={c.path} className="hover:text-green-700 hover:underline">{c.name}</Link>}
            </li>
          ))}
        </ol>
      </nav>

      <header className="mb-6 max-w-3xl">
        <h1 className="font-display text-2xl font-extrabold tracking-tight text-ink sm:text-3xl">{seo.h1}</h1>
        <div className="mt-3 space-y-2.5 text-[15px] leading-relaxed text-ink-soft">
          {seo.intro.map((p) => <p key={p}>{p}</p>)}
        </div>
        {listings && total > 0 && (
          <p className="mt-3 text-sm font-semibold text-green-700">
            {total} {total === 1 ? 'item' : 'items'} currently listed{category ? ` under ${category.name}` : ''} in {cityName}
          </p>
        )}
      </header>

      {!categorySlug && shownCategories.length > 0 && (
        <section aria-labelledby="by-category" className="mb-8">
          <h2 id="by-category" className="mb-3 font-display text-lg font-bold text-ink">Browse {cityName} by category</h2>
          <ul className="flex flex-wrap gap-2">
            {shownCategories.map((c) => (
              <li key={c.slug}>
                <Link href={landingPath(city, c.slug)} className={chip}>
                  <span aria-hidden>{c.icon}</span> {cityCategoryLinkText(city, c.slug)}
                  {counts && <span className="text-xs text-ink-muted">({counts[c.slug]})</span>}
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section aria-labelledby="listings-heading">
        <h2 id="listings-heading" className="mb-4 font-display text-lg font-bold text-ink">
          {products.length ? `Newest ${category ? category.name.toLowerCase() : 'items'} in ${cityName}` : 'Listings'}
        </h2>
        {products.length > 0 ? (
          <>
            <ProductGrid products={products} />
            {total > LANDING_PAGE_SIZE && (
              <p className="mt-6 text-center">
                <Link href={browseHref} className="btn-secondary px-5 py-2.5">Browse all {total} listings</Link>
              </p>
            )}
          </>
        ) : (
          <div className="rounded-2xl border border-dashed border-gray-300 bg-white/60 p-8 text-center">
            <p className="font-display text-lg font-bold text-ink">
              {listings ? `Nothing listed${category ? ` in ${category.name}` : ''} in ${cityName} right now` : 'Listings could not be loaded right now'}
            </p>
            <p className="mx-auto mt-2 max-w-md text-sm leading-relaxed text-ink-muted">
              {listings ? 'New items from verified students are added all the time. Have something to pass on? Be the first to list it.' : 'Please try again in a few minutes, or browse everything that is listed.'}
            </p>
            <div className="mt-5 flex flex-wrap items-center justify-center gap-3">
              <Link href={browseHref} className="btn-primary px-5 py-2.5">Browse all listings</Link>
              <Link href="/sell" className="btn-secondary px-5 py-2.5">Sell an item</Link>
            </div>
          </div>
        )}
      </section>

      {seo.tips.length > 0 && (
        <section aria-labelledby="tips-heading" className="mt-10 max-w-3xl">
          <h2 id="tips-heading" className="mb-3 font-display text-lg font-bold text-ink">Before you buy</h2>
          <ul className="list-disc space-y-1.5 pl-5 text-[15px] leading-relaxed text-ink-soft marker:text-green-600">
            {seo.tips.map((t) => <li key={t}>{t}</li>)}
          </ul>
        </section>
      )}

      <nav aria-label="Related pages" className="mt-10 border-t border-gray-200/70 pt-6">
        <h2 className="mb-3 font-display text-lg font-bold text-ink">Explore more</h2>
        <ul className="flex flex-wrap gap-2">
          {categorySlug && <li><Link href={landingPath(city)} className={chip}>{cityLinkText(city)}</Link></li>}
          {otherCities.map((c) => (
            <li key={c.slug}>
              <Link href={landingPath(c.slug, categorySlug)} className={chip}>
                {categorySlug ? cityCategoryLinkText(c.slug, categorySlug) : cityLinkText(c.slug)}
              </Link>
            </li>
          ))}
          {categorySlug && shownCategories.map((c) => (
            <li key={c.slug}><Link href={landingPath(city, c.slug)} className={chip}>{cityCategoryLinkText(city, c.slug)}</Link></li>
          ))}
        </ul>
      </nav>
    </div>
  )
}
