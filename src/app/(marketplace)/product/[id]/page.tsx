import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { getProductForPage } from '@/lib/productPage';
import { APP_NAME } from '@/lib/constants';
import { DEFAULT_SHARE_IMAGE, buildProductDescription, productImageUrl } from '@/lib/seo';
import JsonLd from '@/components/seo/JsonLd';
import { productBreadcrumbJsonLd, productJsonLd } from '@/lib/jsonld';
import ProductPageClient from './ProductPageClient';

// The product is fetched on the server, in parallel with nothing else, and sent down as ready-made HTML + data.
// Before, the browser had to download the page, start React, THEN request the product (a waterfall of ~4 round trips).
export async function generateMetadata({ params }: { params: { id: string } }): Promise<Metadata> {
  const p = await getProductForPage(params.id);
  if (!p) return { title: 'Listing not found', robots: { index: false, follow: false } };
  const title = `${p.title} — Rs. ${Number(p.price).toLocaleString()}`;
  const canonical = `/product/${params.id}`;
  // Built from the listing's real fields; "verified student" is only claimed when this seller is VERIFIED
  const description = buildProductDescription({ ...p, sellerVerified: p.seller?.verification_status === 'VERIFIED' });
  // The listing's own photo makes the shared link preview useful; with no photo the site-wide share image is used
  const image = productImageUrl(p.images);
  const ogImages = image ? [{ url: image, alt: p.title }] : [DEFAULT_SHARE_IMAGE];
  return {
    title,
    description,
    alternates: { canonical },
    // A page-level openGraph replaces the layout's, so siteName/locale are repeated here
    openGraph: { title, description, url: canonical, siteName: APP_NAME, type: 'website', locale: 'en_NP', images: ogImages },
    twitter: { card: 'summary_large_image', title, description, images: [image ?? DEFAULT_SHARE_IMAGE.url] },
  }
}

export default async function ProductPage({ params }: { params: { id: string } }) {
  const initial = await getProductForPage(params.id);
  // Renders the not-found page and adds noindex. The HTTP status stays 200 because (marketplace)/loading.tsx has already started streaming
  if (!initial) notFound();
  // Structured data from the same real fields as the visible page; no seller name (privacy), no ratings
  const description = buildProductDescription({ ...initial, sellerVerified: initial.seller?.verification_status === 'VERIFIED' });
  const ld = { ...initial, id: params.id };
  return (
    <>
      <JsonLd data={productJsonLd(ld, description)} />
      <JsonLd data={productBreadcrumbJsonLd(ld)} />
      <ProductPageClient id={params.id} initialProduct={initial} />
    </>
  );
}
