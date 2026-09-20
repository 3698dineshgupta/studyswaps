import { createClient } from '@/lib/supabase/server';
import { resolveCityForUser } from '@/lib/city';
import { listProducts } from '@/lib/productList';
import BrowseClient from './BrowseClient';

export const dynamic = 'force-dynamic';

// The first 20 results are fetched on the server and sent with the page, so the grid appears with the HTML
// instead of after the browser has downloaded and started all the JavaScript and then made its own request.
export default async function BrowsePage({ searchParams }: { searchParams: { q?: string; category?: string } }) {
  const supabase = createClient();
  const city = await resolveCityForUser(supabase);
  const search = (searchParams.q ?? '').slice(0, 80);
  const category = searchParams.category ?? '';
  let data: unknown = null;
  try { data = await listProducts(supabase, { q: search, category, city, page: 1, pageSize: 20, sort: 'newest' }); } catch { /* the client will fetch it */ }
  return <BrowseClient initial={data ? { data, search, category, city } : undefined} />;
}
