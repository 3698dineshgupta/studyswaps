import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import LandingPage from '@/components/landing/LandingPage'
import { APP_NAME, CATEGORIES } from '@/lib/constants'
import { LAUNCH_CITIES, isCitySlug } from '@/lib/cities'
import { cityCategorySeo } from '@/lib/landing'
import { getCategoryCounts, getLandingListings } from '@/lib/landingData'
import { DEFAULT_SHARE_IMAGE } from '@/lib/seo'

// Only launch cities x real categories exist; anything else is a real 404.
// Listings come from a 10-minute data cache (landingData.ts) and are read for the city in the URL, never from the visitor's cookie.
// Next's route-segment-config analyzer requires this to be a literal, not the imported LANDING_REVALIDATE constant — keep in sync with lib/landingData.ts
export const revalidate = 600
export const dynamicParams = false
export const generateStaticParams = () => LAUNCH_CITIES.flatMap((c) => CATEGORIES.map((k) => ({ city: c.slug, category: k.slug })))

type Params = { params: Promise<{ city: string; category: string }> }

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { city, category } = await params
  if (!isCitySlug(city)) return {}
  const seo = cityCategorySeo(city, category)
  if (!seo) return {}
  const listings = await getLandingListings(city, category)
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
  const { city, category } = await params
  const seo = isCitySlug(city) ? cityCategorySeo(city, category) : null
  if (!isCitySlug(city) || !seo) notFound()
  const [listings, counts] = await Promise.all([getLandingListings(city, category), getCategoryCounts(city)])
  return <LandingPage city={city} categorySlug={category} seo={seo} listings={listings} counts={counts} />
}
