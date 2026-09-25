import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import LandingPage from '@/components/landing/LandingPage'
import { APP_NAME } from '@/lib/constants'
import { LAUNCH_CITIES, isCitySlug } from '@/lib/cities'
import { cityHubSeo } from '@/lib/landing'
import { LANDING_REVALIDATE, getCategoryCounts, getLandingListings } from '@/lib/landingData'
import { DEFAULT_SHARE_IMAGE } from '@/lib/seo'

// Only launch cities exist; any other slug is a real 404.
// Listings come from a 10-minute data cache (landingData.ts) and are read for the city in the URL, never from the visitor's cookie.
export const revalidate = LANDING_REVALIDATE
export const dynamicParams = false
export const generateStaticParams = () => LAUNCH_CITIES.map((c) => ({ city: c.slug }))

type Params = { params: { city: string } }

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  if (!isCitySlug(params.city)) return {}
  const seo = cityHubSeo(params.city)
  const listings = await getLandingListings(params.city)
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

export default async function CityHubPage({ params }: Params) {
  if (!isCitySlug(params.city)) notFound()
  const [listings, counts] = await Promise.all([getLandingListings(params.city), getCategoryCounts(params.city)])
  return <LandingPage city={params.city} seo={cityHubSeo(params.city)} listings={listings} counts={counts} />
}
