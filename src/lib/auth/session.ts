/**
 * Fast, still-secure "who is this?" for READ paths.
 *
 * `supabase.auth.getUser()` asks Supabase's servers about the token on EVERY call (350–650 ms from here). Supabase
 * signs access tokens with ES256 and publishes the public key, so we can verify the signature, expiry, issuer and
 * audience ourselves in ~0.1 ms. A forged or expired token still fails.
 *
 * Trade-off (documented in SECURITY.md): a token that was revoked by "sign out" stays valid until its own expiry
 * (≤ 1 hour). So this is used for reads (page shell, cart, order lists) and NEVER for money or admin actions —
 * payments, withdrawals, order creation, status changes and every /api/admin route keep using getUser().
 */
import { createPublicKey, verify as cryptoVerify, type KeyObject } from 'crypto'
import type { SupabaseClient } from '@supabase/supabase-js'

interface Claims { sub: string; email?: string; exp: number }

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? ''
const keys = new Map<string, KeyObject>()
let jwksLoadedAt = 0

async function loadJwks(force = false) {
  // A forged token with an unknown key id may trigger at most one refresh every 30 s (no request amplification)
  if (force ? Date.now() - jwksLoadedAt < 30_000 && keys.size : Date.now() - jwksLoadedAt < 10 * 60_000 && keys.size) return
  const res = await fetch(`${SUPABASE_URL}/auth/v1/.well-known/jwks.json`, { signal: AbortSignal.timeout(4000), next: { revalidate: 600 } })
  if (!res.ok) throw new Error(`jwks ${res.status}`)
  const { keys: list } = (await res.json()) as { keys: (JsonWebKey & { kid?: string; alg?: string })[] }
  for (const k of list) if (k.kid && k.kty === 'EC') keys.set(k.kid, createPublicKey({ key: k as import('crypto').JsonWebKey, format: 'jwk' }))
  jwksLoadedAt = Date.now()
}

const b64 = (s: string) => Buffer.from(s, 'base64url')

/** Returns the token's claims when its ES256 signature, expiry, issuer and audience are all valid; otherwise null. */
export async function verifyAccessToken(token: string): Promise<Claims | null> {
  try {
    const [h, p, s] = token.split('.')
    if (!h || !p || !s) return null
    const header = JSON.parse(b64(h).toString())
    if (header.alg !== 'ES256' || !header.kid) return null // legacy HS256 tokens etc. → caller falls back to getUser()
    if (!keys.has(header.kid)) await loadJwks(true)
    else await loadJwks().catch(() => {})
    const key = keys.get(header.kid)
    if (!key) return null
    const ok = cryptoVerify('sha256', Buffer.from(`${h}.${p}`), { key, dsaEncoding: 'ieee-p1363' }, b64(s))
    if (!ok) return null
    const claims = JSON.parse(b64(p).toString())
    if (typeof claims.exp !== 'number' || claims.exp * 1000 < Date.now()) return null
    if (claims.aud !== 'authenticated' || claims.iss !== `${SUPABASE_URL}/auth/v1` || !claims.sub) return null
    return { sub: claims.sub, email: claims.email, exp: claims.exp }
  } catch {
    return null
  }
}

/**
 * The signed-in user for read paths. Verifies the session token locally; if that isn't possible (unknown signing
 * algorithm, key fetch failed) it falls back to the authoritative network check, so it is never LESS safe than a
 * valid signature and never fails open.
 */
export async function getFastUser(supabase: SupabaseClient): Promise<{ id: string; email?: string } | null> {
  const { data: { session } } = await supabase.auth.getSession()
  if (!session?.access_token) return null
  const claims = await verifyAccessToken(session.access_token)
  if (claims) return { id: claims.sub, email: claims.email }
  const { data: { user } } = await supabase.auth.getUser()
  return user ? { id: user.id, email: user.email } : null
}
