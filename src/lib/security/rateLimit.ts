/**
 * Rate limiting for API routes (Node runtime).
 *
 * Fixed-window counter. Uses Redis when REDIS_URL is set (shared by every server instance), otherwise an in-memory
 * map (correct for a single instance; a multi-instance deployment should set REDIS_URL or add edge rate limiting —
 * see SECURITY.md). Never blocks a request because the limiter itself failed: it fails OPEN and logs.
 */
import { NextResponse } from 'next/server'
import { logSecurity } from '@/lib/security/log'

interface Bucket { count: number; reset: number }
const memory = new Map<string, Bucket>()
const MAX_KEYS = 50_000

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let redis: any = null
let redisTried = false
async function getRedis() {
  if (redisTried) return redis
  redisTried = true
  if (!process.env.REDIS_URL) return null
  try {
    const { default: IORedis } = await import('ioredis')
    // Commands wait briefly for the first connection, and give up fast if Redis is down (the limiter then falls back to memory)
    // rediss:// = TLS (Upstash, Redis Cloud); the hostname is passed so the certificate check succeeds
    const u = new URL(process.env.REDIS_URL)
    redis = new IORedis(process.env.REDIS_URL, { maxRetriesPerRequest: 1, connectTimeout: 5000, commandTimeout: 1500, ...(u.protocol === 'rediss:' ? { tls: { servername: u.hostname } } : {}) })
    redis.on('error', () => { /* fail open; logged on use */ })
  } catch {
    redis = null
  }
  return redis
}

/** The caller's IP. Only trust X-Forwarded-For when running behind your own proxy / CDN (Cloudflare, Vercel, nginx). */
export function clientIp(req: Request): string {
  const h = req.headers
  return (h.get('cf-connecting-ip') || h.get('x-real-ip') || h.get('x-forwarded-for')?.split(',')[0] || 'unknown').trim().slice(0, 64)
}

function memoryHit(key: string, limit: number, windowMs: number) {
  const now = Date.now()
  let b = memory.get(key)
  if (!b || b.reset <= now) {
    if (memory.size > MAX_KEYS) for (const [k, v] of Array.from(memory)) if (v.reset <= now) memory.delete(k)
    b = { count: 0, reset: now + windowMs }
    memory.set(key, b)
  }
  b.count++
  return { count: b.count, retryAfter: Math.max(1, Math.ceil((b.reset - now) / 1000)) }
}

// INCR the counter, start its expiry on the first hit, and return [count, ms-left] — atomically, in one Redis call
const COUNT_SCRIPT = "local c = redis.call('INCR', KEYS[1]); if c == 1 then redis.call('PEXPIRE', KEYS[1], ARGV[1]) end; return {c, redis.call('PTTL', KEYS[1])}"

export interface RateRule {
  /** Short name of the protected action, e.g. "cart" */
  name: string
  limit: number
  windowMs: number
}

/**
 * Returns a ready-made 429 response when the caller is over the limit, otherwise null.
 * `userId` (if the caller is signed in) is counted alongside the IP, so one account can't be spread over many IPs.
 */
export async function rateLimit(req: Request, rule: RateRule, userId?: string | null, opts: { ip?: boolean } = {}): Promise<NextResponse | null> {
  // `ip:false` counts only the identity (e.g. an email address or a global key) — used for per-account lockouts
  const keys = opts.ip === false ? [] : [`rl:${rule.name}:ip:${clientIp(req)}`]
  if (userId) keys.push(`rl:${rule.name}:u:${userId}`)
  try {
    const r = await getRedis()
    // All keys in ONE round trip: an atomic count-and-expire script per key, sent as a single pipeline (was 3 commands per key, one after another)
    let redisHits: [number, number][] | null = null
    if (r) {
      const pipe = r.pipeline()
      for (const key of keys) pipe.eval(COUNT_SCRIPT, 1, key, String(rule.windowMs))
      const res = (await pipe.exec()) ?? []
      redisHits = res.map(([err, v]: [Error | null, unknown]) => { if (err) throw err; const [c, ttl] = v as [number, number]; return [Number(c), Number(ttl)] })
    }
    for (let i = 0; i < keys.length; i++) {
      const key = keys[i]
      let count: number, retryAfter: number
      if (redisHits) {
        count = redisHits[i][0]
        retryAfter = Math.max(1, Math.ceil(redisHits[i][1] / 1000))
      } else {
        ;({ count, retryAfter } = memoryHit(key, rule.limit, rule.windowMs))
      }
      if (count > rule.limit) {
        logSecurity('rate_limited', req, { rule: rule.name, key: key.includes(':u:') ? 'user' : 'ip', userId: userId ?? undefined })
        return NextResponse.json({ error: 'Too many requests. Please slow down and try again shortly.' }, { status: 429, headers: { 'Retry-After': String(retryAfter) } })
      }
    }
  } catch (err) {
    logSecurity('rate_limiter_error', req, { message: err instanceof Error ? err.message : 'unknown' })
    // Redis unreachable: still enforce the limit, using this server's own memory
    for (const key of keys) {
      const { count, retryAfter } = memoryHit(key, rule.limit, rule.windowMs)
      if (count > rule.limit) return NextResponse.json({ error: 'Too many requests. Please slow down and try again shortly.' }, { status: 429, headers: { 'Retry-After': String(retryAfter) } })
    }
  }
  return null
}

/** Sensible presets. Tight where abuse is costly, loose where normal browsing is heavy. */
export const LIMITS = {
  read: { name: 'read', limit: 240, windowMs: 60_000 },
  cart: { name: 'cart', limit: 90, windowMs: 60_000 },
  checkout: { name: 'checkout', limit: 15, windowMs: 60_000 },
  payment: { name: 'payment', limit: 20, windowMs: 60_000 },
  listing: { name: 'listing', limit: 12, windowMs: 3_600_000 },
  photoUpload: { name: 'photo-upload', limit: 40, windowMs: 3_600_000 },
  geocode: { name: 'geocode', limit: 60, windowMs: 60_000 },
  withdraw: { name: 'withdraw', limit: 6, windowMs: 3_600_000 },
  identity: { name: 'identity', limit: 10, windowMs: 3_600_000 },
  orderStatus: { name: 'order-status', limit: 60, windowMs: 60_000 },
  admin: { name: 'admin', limit: 120, windowMs: 60_000 },
  authSync: { name: 'auth-sync', limit: 30, windowMs: 60_000 },
  // Accounts: a person can try a password a handful of times, then must wait. Signing up is capped per IP and overall.
  loginIp: { name: 'login-ip', limit: 40, windowMs: 15 * 60_000 },
  loginAccount: { name: 'login-account', limit: 8, windowMs: 15 * 60_000 },
  signupIpHour: { name: 'signup-ip-hour', limit: 3, windowMs: 3_600_000 },
  signupIpDay: { name: 'signup-ip-day', limit: 8, windowMs: 86_400_000 },
  signupEmail: { name: 'signup-email', limit: 3, windowMs: 3_600_000 },
  signupGlobal: { name: 'signup-global', limit: 400, windowMs: 86_400_000 },
} satisfies Record<string, RateRule>
