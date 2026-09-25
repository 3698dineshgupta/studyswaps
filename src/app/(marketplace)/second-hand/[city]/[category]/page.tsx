import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import LandingPage from '@/components/landing/LandingPage'
import { APP_NAME, CATEGORIES } from '@/lib/constants'
import { LAUNCH_CITIES, isCitySlug } from '@/lib/cities'
import { cityCategorySeo } from '@/lib/landing'
import { LANDING_REVALIDATE, getCategoryCounts, getLandingListings } from '@/lib/landingData'
import { DEFAULT_SHARE_IMAGE } from '@/lib/seo'

// Only launch cities x real categories exist; anything else is a real 404.
// Listings come from a 10-minute data cache (landingData.ts) and are read for the city in the URL, never from the visitor's cookie.
export const revalidate = LANDING_REVALIDATE
export const dynamicParams = false
export const generateStaticParams = () => LAUNCH_CITIES.flatMap((c) => CATEGORIES.map((k) => ({ city: c.slug, category: k.slug })))

type Params = { params: { city: string; category: string } }

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  if (!isCitySlug(params.city)) return {}
  const seo = cityCategorySeo(params.city, params.category)
  if (!seo) return {}
  const listings = await getLandingListings(params.city, params.category)
  const url = seo.path
  return {
    title: seo.title,
    description: seo.description,
    alternates: { canonical: url },
    openGraph: { title: seo.title, description: seo.description, url, siteName: APP_NAME, type: 'website', locale: 'en_NP', images: [DEFAULT_SHARE_IMAGE] },
    twitter: { card: 'summary_large_image', title: seo.title, description: seo.description, images: [DEFAULT_SHARE_IMAGE.url] },
    // Thin-content guard: a page with nothing listed is not indexed (links on it are still followed)
    ...(!listings || listings.total === 0 ? { robots: { index: false, follow: true } } : {}),
  }
}

export default async function CityCategoryPage({ params }: Params) {
  const seo = isCitySlug(params.city) ? cityCategorySeo(params.city, params.category) : null
  if (!isCitySlug(params.city) || !seo) notFound()
  const [listings, counts] = await Promise.all([getLandingListings(params.city, params.category), getCategoryCounts(params.city)])
  return <LandingPage city={params.city} categorySlug={params.category} seo={seo} listings={listings} counts={counts} />
}
