import type { SupabaseClient } from '@supabase/supabase-js'

/**
 * The browser Supabase client is ~50 KB gzipped. Most pages (and every guest) never need it, so it is loaded on
 * demand — after the page is already interactive — instead of being part of every page's first download.
 */
let client: Promise<SupabaseClient> | null = null
export function getSupabase(): Promise<SupabaseClient> {
  return (client ??= import('./client').then((m) => m.createClient()))
}
