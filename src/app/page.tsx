import { Metadata } from 'next';
import { createClient } from '@/lib/supabase/server';
import { resolveCityForUser } from '@/lib/city';
import { cityBySlug, cityOrFilter } from '@/lib/cities';
import Header from '@/components/layout/Header';
import MobileNav from '@/components/layout/MobileNav';
import SiteFooter from '@/components/layout/SiteFooter';
import ProductGrid from '@/components/marketplace/ProductGrid';
import type { CardProduct } from '@/components/marketplace/ProductCard';
import Hero from '@/components/hero/Hero';
import CategoriesSection from '@/components/home/CategoriesSection';
import NearYouSection from '@/components/home/NearYouSection';
import SectionHeading from '@/components/home/SectionHeading';
import SellCta from '@/components/home/SellCta';
import TrustSection from '@/components/home/TrustSection';
import { APP_NAME } from '@/lib/constants';

export const metadata: Metadata = { title: `${APP_NAME} — Buy & sell with verified students` };
// Listings change often and depend on RLS/session; never cache this page
export const dynamic = 'force-dynamic';

export default async function HomePage() {
  const supabase = createClient();
  // Kathmandu and Butwal shoppers each see their own city's listings
  const city = await resolveCityForUser(supabase);

  let latest = supabase
      .from('products')
      .select(`
        id, title, price, original_price, condition, location, is_negotiable, quantity, created_at,
        profiles!products_seller_id_fkey(full_name, verification_status, profile_photo),
        product_images(storage_path, is_primary),
        categories(name, slug)
      `)
      .eq('status', 'ACTIVE')
      .order('created_at', { ascending: false })
      .limit(12);
  let slugs = supabase.from('products').select('categories(slug)').eq('status', 'ACTIVE').limit(1000);
  if (city) { latest = latest.or(cityOrFilter(city)); slugs = slugs.or(cityOrFilter(city)); }
  const [{ data: listings }, { data: catRows }] = await Promise.all([latest, slugs]);

  /* eslint-disable @typescript-eslint/no-explicit-any */
  const products: CardProduct[] = ((listings ?? []) as any[]).map((p) => ({
    ...p,
    images: p.product_images,
    seller: p.profiles,
    category: p.categories,
  }));

  const counts: Record<string, number> = {};
  for (const r of (catRows ?? []) as any[]) { const slug = r.categories?.slug; if (slug) counts[slug] = (counts[slug] ?? 0) + 1; }

  return (
    <>
      <Header />
      <main className="pb-24 lg:pb-0">
        {/* Hero — animated orbiting-marketplace scene (see components/hero) */}
        <Hero />

        <CategoriesSection counts={counts} />

        <section aria-labelledby="fresh-heading" className="page-container py-6 sm:py-10">
          <SectionHeading eyebrow={cityBySlug(city) ? `Just listed in ${cityBySlug(city)!.name}` : 'Just listed'} title="Fresh on the marketplace" text="New finds from verified students, updated all day." action={{ label: 'View all', href: '/browse' }} />
          <span id="fresh-heading" className="sr-only">Latest listings</span>
          <ProductGrid products={products.slice(0, 10)} onView emptyMessage={cityBySlug(city) ? `No listings in ${cityBySlug(city)!.name} yet — be the first to sell something here!` : undefined} />
        </section>

        <NearYouSection products={products} />
        <SellCta />
        <TrustSection />

        <SiteFooter />
      </main>
      <MobileNav />
    </>
  );
}
