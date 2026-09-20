/* eslint-disable @typescript-eslint/no-explicit-any */
import { cache } from 'react'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { getFastUser } from '@/lib/auth/session'

const SELECT = `
  id, title, description, price, original_price, condition, location, quantity,
  is_negotiable, delivery_available, delivery_charge, preferred_meeting_point,
  brand, model, year_purchased, seller_id,
  status, view_count, created_at, updated_at,
  profiles!products_seller_id_fkey(
    id, full_name, verification_status, location, created_at, profile_photo, seller_rating, seller_review_count, total_sales
  ),
  product_images(id, storage_path, is_primary, sort_order),
  categories(id, name, slug)
`

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

/** Shape the row the way the product page expects (aliases + primary photo first). */
export function shapeProduct(p: any) {
  return {
    ...p,
    seller: p.profiles,
    negotiable: p.is_negotiable,
    images: [...(p.product_images ?? [])].sort((a: any, b: any) => (b.is_primary ? 1 : 0) - (a.is_primary ? 1 : 0) || a.sort_order - b.sort_order),
    category: p.categories,
  }
}

/**
 * One listing for server-side rendering. Cached per request, so the page and its <title> share ONE query.
 * Non-public listings (pending, rejected …) are only shown to their own seller.
 */
export const getProductForPage = cache(async (id: string) => {
  if (!UUID.test(id)) return null
  const supabase = createClient()
  const { data: p } = await supabase.from('products').select(SELECT).eq('id', id).maybeSingle()
  if (!p) return null

  if (p.status !== 'ACTIVE' && p.status !== 'SOLD') {
    const user = await getFastUser(supabase)
    if (!user) return null
    const { data: mine } = await supabase.from('profiles').select('id').eq('auth_user_id', user.id).maybeSingle()
    if (!mine || mine.id !== (p.profiles as any)?.id) return null
  }

  // Count the view without making the visitor wait for it
  void createAdminClient().from('products').update({ view_count: (p.view_count || 0) + 1 }).eq('id', id).then(() => {})
  return shapeProduct(p)
})
