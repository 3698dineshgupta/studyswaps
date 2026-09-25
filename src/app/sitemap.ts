import type { MetadataRoute } from 'next'
import { CATEGORIES, SITE_URL } from '@/lib/constants'
import { createAdminClient } from '@/lib/supabase/admin'
import { LAUNCH_CITIES } from '@/lib/cities'
import { LANDING_ROOT, countCityCategories, landingPath } from '@/lib/landing'
import { fetchListingRows } from '@/lib/landingData'

// Rebuilt at most once an hour so a crawl never hits the database on every request
export const revalidate = 3600

const MAX_PRODUCTS = 5000

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const staticEntries: MetadataRoute.Sitemap = [
    { url: `${SITE_URL}/`, changeFrequency: 'daily', priority: 1 },
    { url: `${SITE_URL}/browse`, changeFrequency: 'hourly', priority: 0.9 },
    ...CATEGORIES.map((c) => ({ url: `${SITE_URL}/browse?category=${c.slug}`, changeFrequency: 'daily' as const, priority: 0.7 })),
    // City landing pages: the hubs always; city x category pages only where something is listed (see below)
    { url: `${SITE_URL}${LANDING_ROOT}`, changeFrequency: 'weekly', priority: 0.7 },
    ...LAUNCH_CITIES.map((c) => ({ url: `${SITE_URL}${landingPath(c.slug)}`, changeFrequency: 'daily' as const, priority: 0.8 })),
    { url: `${SITE_URL}/how-it-works`, changeFrequency: 'monthly', priority: 0.5 },
    { url: `${SITE_URL}/policies`, changeFrequency: 'monthly', priority: 0.3 },
  ]

  // The site must still have a valid sitemap if the database is unreachable
  try {
    const { data } = await createAdminClient()
      .from('products')
      .select('id, updated_at')
      .eq('status', 'ACTIVE')
      .order('updated_at', { ascending: false })
      .limit(MAX_PRODUCTS)
    const products: MetadataRoute.Sitemap = (data ?? []).map((p: { id: string; updated_at: string | null }) => ({
      url: `${SITE_URL}/product/${p.id}`,
      lastModified: p.updated_at ? new Date(p.updated_at) : undefined,
      changeFrequency: 'weekly',
      priority: 0.6,
    }))
    // Empty landing pages are noindex, so they stay out of the sitemap. A failure here only drops these entries.
    let landing: MetadataRoute.Sitemap = []
    try {
      const counts = countCityCategories(await fetchListingRows(createAdminClient()))
      landing = Object.keys(counts).sort().map((key) => ({ url: `${SITE_URL}${LANDING_ROOT}/${key}`, changeFrequency: 'daily' as const, priority: 0.7 }))
    } catch { /* keep the rest of the sitemap */ }
    return [...staticEntries, ...landing, ...products]
  } catch {
    return staticEntries
  }
}
