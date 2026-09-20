/** Server-side: which launch city is this visitor shopping in? */
import { cookies } from 'next/headers'
import type { SupabaseClient } from '@supabase/supabase-js'
import { CITY_COOKIE, cityFromText, isCitySlug, type CitySlug } from '@/lib/cities'
import { getFastUser } from '@/lib/auth/session'

export function cityFromCookie(): CitySlug | null {
  const v = cookies().get(CITY_COOKIE)?.value
  return isCitySlug(v) ? v : null
}

/** Their chosen city (cookie), else the city on their profile, else null (we then ask them to pick). */
export async function resolveCity(profileLocation?: string | null): Promise<CitySlug | null> {
  return cityFromCookie() ?? cityFromText(profileLocation)
}

export async function resolveCityForUser(supabase: SupabaseClient): Promise<CitySlug | null> {
  const fromCookie = cityFromCookie()
  if (fromCookie) return fromCookie
  const user = await getFastUser(supabase)
  if (!user) return null
  const { data } = await supabase.from('profiles').select('location').eq('auth_user_id', user.id).single()
  return cityFromText(data?.location)
}
