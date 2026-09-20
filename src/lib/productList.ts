/* eslint-disable @typescript-eslint/no-explicit-any */
import type { SupabaseClient } from '@supabase/supabase-js'
import { cityOrFilter, type CitySlug } from '@/lib/cities'

export interface ListParams {
  q?: string
  category?: string
  condition?: string
  minPrice?: number
  maxPrice?: number
  negotiable?: boolean
  sort?: string
  page?: number
  pageSize?: number
  city?: CitySlug | null
}

export interface ListResult {
  products: any[]
  total: number
  page: number
  pageSize: number
  totalPages: number
  total_pages: number
}

const clean = (v: unknown, max = 80) => String(v ?? '').replace(/[,()%*\\:"'`;]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, max)

/**
 * The marketplace listing query. Used by BOTH the /api/products endpoint and the server-rendered browse page, so the
 * first screen of results arrives with the HTML instead of after a second (client-side) request.
 * Every input is bounded and whitelisted here; callers can pass raw values.
 */
export async function listProducts(supabase: SupabaseClient, p: ListParams): Promise<ListResult> {
  const query = clean(p.q)
  const category = /^[a-z0-9-]{1,40}$/.test(p.category ?? '') ? (p.category as string) : ''
  const condition = ['NEW', 'LIKE_NEW', 'GOOD', 'FAIR', 'POOR'].includes(p.condition ?? '') ? (p.condition as string) : ''
  const ok = (n: unknown) => (typeof n === 'number' && Number.isFinite(n) && n >= 0 && n <= 99_999_999 ? n : undefined)
  const page = Math.min(500, Math.max(1, Math.floor(p.page || 1)))
  const pageSize = Math.min(50, Math.max(1, Math.floor(p.pageSize || 20)))

  // Only the columns a product CARD shows (the old query also pulled data the grid never displays)
  let q = supabase
    .from('products')
    .select(`
      id, title, price, original_price, condition, location, is_negotiable, quantity, created_at,
      profiles!products_seller_id_fkey(full_name, verification_status, profile_photo),
      product_images!inner(storage_path, is_primary),
      categories${category ? '!inner' : ''}(name, slug)
    `, { count: 'exact' })
    .eq('status', 'ACTIVE')
    .range((page - 1) * pageSize, page * pageSize - 1)

  if (query) q = q.or(`title.ilike.%${query}%,description.ilike.%${query}%,brand.ilike.%${query}%`)
  if (category) q = q.eq('categories.slug', category)
  if (p.city) q = q.or(cityOrFilter(p.city))
  if (condition) q = q.eq('condition', condition)
  if (ok(p.minPrice) !== undefined) q = q.gte('price', ok(p.minPrice)!)
  if (ok(p.maxPrice) !== undefined) q = q.lte('price', ok(p.maxPrice)!)
  if (p.negotiable) q = q.eq('is_negotiable', true)

  switch (p.sort) {
    case 'price_asc': q = q.order('price', { ascending: true }); break
    case 'price_desc': q = q.order('price', { ascending: false }); break
    case 'popular': q = q.order('view_count', { ascending: false }); break
    case 'oldest': q = q.order('created_at', { ascending: true }); break
    default: q = q.order('created_at', { ascending: false })
  }

  const t0 = Date.now()
  const { data, count, error } = await q
  const took = Date.now() - t0
  if (took > 800) console.warn(JSON.stringify({ level: 'perf', kind: 'slow-query', name: 'listProducts', ms: took })) // slow-query alert
  // A page beyond the last one is not an error, just an empty page
  if (error && (error as { code?: string }).code === 'PGRST103') return { products: [], total: 0, page, pageSize, totalPages: 0, total_pages: 0 }
  if (error) throw error

  const products = ((data || []) as any[]).map((r) => ({ ...r, images: r.product_images, seller: r.profiles, category: r.categories }))
  const totalPages = Math.ceil((count || 0) / pageSize)
  return { products, total: count || 0, page, pageSize, totalPages, total_pages: totalPages }
}
