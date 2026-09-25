/**
 * Server-side data for the /second-hand landing pages and the sitemap.
 * Reads with an anonymous client and an explicit city: never the visitor's cookies, so the results are the same for
 * everyone and can be shared through Next's data cache (10 minutes).
 */
import { unstable_cache } from 'next/cache'
import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { listProducts, type ListResult } from '@/lib/productList'
import { cityOrFilter, type CitySlug } from '@/lib/cities'
import { countCityCategories } from '@/lib/landing'

export const LANDING_REVALIDATE = 600
export const LANDING_PAGE_SIZE = 20

/** Cookie-free read-only client (same access as a signed-out visitor on /browse). */
function publicClient(): SupabaseClient {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
    auth: { persistSession: false, autoRefreshToken: false },
  })
}

const listCached = unstable_cache(
  (city: CitySlug, category: string): Promise<ListResult> =>
    listProducts(publicClient(), { city, category, page: 1, pageSize: LANDING_PAGE_SIZE, sort: 'newest' }),
  ['landing-listings'],
  { revalidate: LANDING_REVALIDATE },
)

/** Newest listings for a city (and category); null if the database could not be reached. */
export async function getLandingListings(city: CitySlug, category = ''): Promise<ListResult | null> {
  try { return await listCached(city, category) } catch { return null }
}

/**
 * Location + category of every ACTIVE listing that has a photo (the same rule listProducts applies), so a
 * city x category page is reported as non-empty exactly when it will actually show something.
 */
export async function fetchListingRows(client: SupabaseClient, city?: CitySlug, limit = 5000): Promise<{ location: string | null; category: string | null }[]> {
  let q = client
    .from('products')
    .select('location, categories(slug), product_images!inner(storage_path)')
    .eq('status', 'ACTIVE')
    .limit(limit)
  if (city) q = q.or(cityOrFilter(city))
  const { data, error } = await q
  if (error) throw error
  return ((data ?? []) as unknown as { location: string | null; categories: { slug: string } | { slug: string }[] | null }[]).map((r) => ({
    location: r.location,
    category: (Array.isArray(r.categories) ? r.categories[0]?.slug : r.categories?.slug) ?? null,
  }))
}

const countsCached = unstable_cache(
  async (city: CitySlug) => countCityCategories(await fetchListingRows(publicClient(), city)),
  ['landing-counts'],
  { revalidate: LANDING_REVALIDATE },
)

/** Listings per category slug for one city; null if the database could not be reached. */
export async function getCategoryCounts(city: CitySlug): Promise<Record<string, number> | null> {
  try {
    const all = await countsCached(city)
    const out: Record<string, number> = {}
    for (const [k, n] of Object.entries(all)) if (k.startsWith(`${city}/`)) out[k.slice(city.length + 1)] = n
    return out
  } catch { return null }
}
