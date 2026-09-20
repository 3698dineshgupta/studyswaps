import type { Metadata } from 'next';
import { getProductForPage } from '@/lib/productPage';
import ProductPageClient from './ProductPageClient';

// The product is fetched on the server, in parallel with nothing else, and sent down as ready-made HTML + data.
// Before, the browser had to download the page, start React, THEN request the product (a waterfall of ~4 round trips).
export async function generateMetadata({ params }: { params: { id: string } }): Promise<Metadata> {
  const p = await getProductForPage(params.id);
  return p ? { title: `${p.title} — Rs. ${Number(p.price).toLocaleString()}`, description: String(p.description ?? '').slice(0, 155) } : { title: 'Listing not found' };
}

export default async function ProductPage({ params }: { params: { id: string } }) {
  const initial = await getProductForPage(params.id);
  return <ProductPageClient id={params.id} initialProduct={initial} />;
}
