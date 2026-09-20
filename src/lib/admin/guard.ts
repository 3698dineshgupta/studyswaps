/**
 * Server-side gate for every admin API. The browser is never trusted to say who is an admin:
 * the caller's session is verified, then their ACTIVE role is read from the database.
 */
import { NextResponse } from 'next/server'
import type { SupabaseClient } from '@supabase/supabase-js'
import { createServerClient } from '@/lib/supabase/server'
import { getFastUser } from '@/lib/auth/session'
import { createAdminClient } from '@/lib/supabase/admin'
import { rateLimit, LIMITS } from '@/lib/security/rateLimit'
import { logSecurity } from '@/lib/security/log'

export type AdminRole = 'SUPER_ADMIN' | 'ADMIN' | 'VERIFICATION_REVIEWER' | 'MODERATOR' | 'FINANCE_ADMIN' | 'SUPPORT_AGENT' | 'LOGISTICS_ADMIN'

export interface AdminContext {
  admin: SupabaseClient
  profile: { id: string; full_name: string | null }
  email: string | undefined
  roles: AdminRole[]
}

/** `allowed` = roles that may use this endpoint (SUPER_ADMIN and ADMIN can always). */
export async function requireAdmin(request: Request, allowed: AdminRole[] = []): Promise<{ ctx: AdminContext; error?: undefined } | { error: NextResponse; ctx?: undefined }> {
  const supabase = await createServerClient()
  // Reading admin data: the token signature is verified locally. Anything that CHANGES data (POST/PATCH/DELETE — approvals,
  // refunds, payouts, bans) still asks the auth server, so a signed-out/revoked session can never act.
  const user = request.method === 'GET' ? await getFastUser(supabase) : (await supabase.auth.getUser()).data.user
  // Admin endpoints answer strangers with a plain 404, the same as a URL that doesn't exist
  if (!user) return { error: NextResponse.json({ error: 'Not found' }, { status: 404 }) }

  const admin = createAdminClient()
  // Rate limit and the profile+roles lookup are independent: run them together (one round trip each, in parallel)
  const [limited, lookup] = await Promise.all([
    rateLimit(request, LIMITS.admin, user.id),
    admin.from('profiles').select('id, full_name, admin_roles!admin_roles_profile_id_fkey(role, is_active)').eq('auth_user_id', user.id).maybeSingle(),
  ])
  if (limited) return { error: limited }
  const row = lookup.data as { id: string; full_name: string | null; admin_roles?: { role: AdminRole; is_active: boolean }[] } | null
  const profile = row ? { id: row.id, full_name: row.full_name } : null
  const roles = (row?.admin_roles ?? []).filter((r) => r.is_active).map((r) => r.role)
  const ok = roles.some((r) => r === 'SUPER_ADMIN' || r === 'ADMIN' || allowed.includes(r))
  if (!profile || !ok) {
    logSecurity('forbidden', request, { userId: user.id, reason: 'admin_api' })
    return { error: NextResponse.json({ error: 'Not found' }, { status: 404 }) }
  }
  return { ctx: { admin, profile, email: user.email, roles } }
}

/** Record an admin action (who / what / when / result). Never throws. */
export async function audit(
  ctx: AdminContext, request: Request,
  action: string, entityType: string, entityId: string, data: Record<string, unknown> = {}, before?: Record<string, unknown>,
) {
  try {
    await ctx.admin.from('audit_logs').insert({
      actor_id: ctx.profile.id, actor_email: ctx.email, actor_role: ctx.roles[0] ?? null,
      action, entity_type: entityType, entity_id: entityId, old_data: before ?? null, new_data: data,
      ip_address: request.headers.get('cf-connecting-ip') || request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || null,
      user_agent: request.headers.get('user-agent')?.slice(0, 300) ?? null,
    })
  } catch { /* logging must never break the action */ }
  logSecurity('admin_action', request, { adminId: ctx.profile.id, action, entityType, entityId })
}

/** Search text with characters that mean something in the filter syntax removed, and a length cap. */
export const cleanSearch = (v: string | null, max = 60) => (v ?? '').replace(/[,()%*\\:"'`;]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, max)
export const pageParam = (v: string | null) => Math.min(1000, Math.max(1, Math.floor(Number(v || '1')) || 1))
