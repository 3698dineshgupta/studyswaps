import type { Metadata } from 'next';
import { APP_NAME, CATEGORIES } from '@/lib/constants';
import { DEFAULT_SHARE_IMAGE, browseSeo } from '@/lib/seo';
import { createClient } from '@/lib/supabase/server';
import { resolveCityForUser } from '@/lib/city';
import { listProducts } from '@/lib/productList';
import JsonLd from '@/components/seo/JsonLd';
import { browseBreadcrumbJsonLd } from '@/lib/jsonld';
import BrowseClient from './BrowseClient';

export const dynamic = 'force-dynamic';

type BrowseSearchParams = { q?: string; category?: string };

// Category pages canonicalize to themselves; search / sort / page / city variants point at a base URL, and searches are not indexed
export async function generateMetadata({ searchParams }: { searchParams: Promise<BrowseSearchParams> }): Promise<Metadata> {
  const sp = await searchParams;
  const category = CATEGORIES.find((c) => c.slug === sp.category);
  const canonical = category ? `/browse?category=${category.slug}` : '/browse';
  // Each category gets its own title/description (see CATEGORY_SEO); unknown or missing slugs get the generic /browse copy
  const { title, description } = browseSeo(category?.slug);
  return {
    title,
    description,
    alternates: { canonical },
    openGraph: { title, description, url: canonical, siteName: APP_NAME, type: 'website', locale: 'en_NP', images: [DEFAULT_SHARE_IMAGE] },
    twitter: { card: 'summary_large_image', title, description, images: [DEFAULT_SHARE_IMAGE.url] },
    ...(sp.q ? { robots: { index: false, follow: true } } : {}),
  };
}

// The first 20 results are fetched on the server and sent with the page, so the grid appears with the HTML
// instead of after the browser has downloaded and started all the JavaScript and then made its own request.
export default async function BrowsePage({ searchParams }: { searchParams: Promise<BrowseSearchParams> }) {
  const supabase = await createClient();
  const city = await resolveCityForUser(supabase);
  const sp = await searchParams;
  const search = (sp.q ?? '').slice(0, 80);
  const category = sp.category ?? '';
  let data: unknown = null;
  try { data = await listProducts(supabase, { q: search, category, city, page: 1, pageSize: 20, sort: 'newest' }); } catch { /* the client will fetch it */ }
  return (
    <>
      <JsonLd data={browseBreadcrumbJsonLd(category)} />
      <BrowseClient initial={data ? { data, search, category, city } : undefined} />
    </>
  );
}
