/* eslint-disable @typescript-eslint/no-explicit-any */
import type { SupabaseClient } from '@supabase/supabase-js'

/**
 * The signed-in user's OWN full profile (including private fields like phone).
 * Other people's profiles only expose public columns; your own comes from the my_profile() database function
 * (migration 008). Falls back to a plain select so the app keeps working if the migration hasn't been applied yet.
 */
export async function fetchOwnProfile(supabase: SupabaseClient, authUserId: string): Promise<any | null> {
  const viaRpc = await supabase.rpc('my_profile').single()
  if (!viaRpc.error && viaRpc.data) return viaRpc.data
  const { data } = await supabase.from('profiles').select('*').eq('auth_user_id', authUserId).single()
  return data ?? null
}
