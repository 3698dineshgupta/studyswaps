import { createServerClient, type CookieOptions } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

const PROTECTED_ROUTES = [
  '/cart', '/checkout', '/orders', '/wishlist',
  '/sell', '/dashboard',
  '/profile', '/chat', '/notifications',
  '/verify',
]

const AUTH_ROUTES = ['/login', '/register', '/forgot-password']
const IS_PROD = process.env.NODE_ENV === 'production'
// HTTPS-only protections (HSTS, secure cookies, upgrade-insecure-requests) switch on when the site URL is https,
// so a production build tested over plain http://localhost still works.
const HTTPS = (process.env.NEXT_PUBLIC_APP_URL || '').startsWith('https://')

// ---------------------------------------------------------------------------------------------------------------
// Security headers + Content-Security-Policy (per-request nonce in production, so no 'unsafe-inline' scripts)
// ---------------------------------------------------------------------------------------------------------------
function buildCsp(nonce: string): string {
  const supabase = 'https://*.supabase.co'
  const scriptSrc = IS_PROD
    ? `'self' 'nonce-${nonce}' 'strict-dynamic'`
    : `'self' 'unsafe-eval' 'unsafe-inline'` // dev only: hot reload needs eval
  return [
    "default-src 'self'",
    `script-src ${scriptSrc}`,
    // Inline styles are required by the animation library (it sets style attributes). Styles cannot run code.
    "style-src 'self' 'unsafe-inline'",
    `img-src 'self' data: blob: ${supabase} https://res.cloudinary.com`,
    "font-src 'self'",
    `connect-src 'self' ${supabase} wss://*.supabase.co${IS_PROD ? '' : ' ws://localhost:* ws://127.0.0.1:*'}`,
    "frame-src 'none'",
    "frame-ancestors 'none'",
    "object-src 'none'",
    "base-uri 'self'",
    // eSewa's payment page is reached by a form POST
    "form-action 'self' https://rc-epay.esewa.com.np https://epay.esewa.com.np",
    "manifest-src 'self'",
    ...(HTTPS ? ['upgrade-insecure-requests'] : []),
  ].join('; ')
}

// ---------------------------------------------------------------------------------------------------------------
// Coarse per-IP throttle for /api (in-memory, per instance). Route handlers add stricter per-action + per-user
// limits; put a WAF / edge rate limit in front for multi-instance deployments (see SECURITY.md).
// ---------------------------------------------------------------------------------------------------------------
const hits = new Map<string, { n: number; reset: number }>()
function throttled(ip: string, path: string): number {
  const heavy = path.startsWith('/api/tiles')            // a map view legitimately loads ~20 tiles
  const limit = heavy ? 900 : 300                          // requests per minute per IP
  const key = `${heavy ? 't' : 'a'}:${ip}`
  const now = Date.now()
  let b = hits.get(key)
  if (!b || b.reset <= now) {
    if (hits.size > 20_000) for (const [k, v] of Array.from(hits)) if (v.reset <= now) hits.delete(k)
    b = { n: 0, reset: now + 60_000 }
    hits.set(key, b)
  }
  b.n++
  return b.n > limit ? Math.ceil((b.reset - now) / 1000) : 0
}

function clientIp(request: NextRequest) {
  return (request.headers.get('cf-connecting-ip') || request.headers.get('x-real-ip') || request.headers.get('x-forwarded-for')?.split(',')[0] || 'unknown').trim()
}

function logLine(event: string, request: NextRequest, requestId: string, extra: Record<string, unknown> = {}) {
  console.warn(JSON.stringify({ ts: new Date().toISOString(), level: 'security', event, requestId, method: request.method, path: request.nextUrl.pathname, ip: clientIp(request), ...extra }))
}

export async function middleware(request: NextRequest) {
  const requestId = crypto.randomUUID()
  const pathname = request.nextUrl.pathname
  const isApi = pathname.startsWith('/api/')

  // Never let a client pretend to be an internal Next.js subrequest (CVE-2025-29927 class of middleware bypass)
  const requestHeaders = new Headers(request.headers)
  requestHeaders.delete('x-middleware-subrequest')
  requestHeaders.set('x-request-id', requestId)

  const nonce = btoa(crypto.randomUUID())
  const csp = buildCsp(nonce)
  requestHeaders.set('x-nonce', nonce)
  requestHeaders.set('content-security-policy', csp)

  const finish = (res: NextResponse) => {
    res.headers.set('Content-Security-Policy', csp)
    res.headers.set('x-request-id', requestId)
    if (HTTPS) res.headers.set('Strict-Transport-Security', 'max-age=31536000; includeSubDomains')
    return res
  }
  const json = (body: object, status: number, headers: Record<string, string> = {}) => finish(NextResponse.json(body, { status, headers }))

  // ---- API guards: abuse throttle + CSRF ----
  if (isApi) {
    const wait = throttled(clientIp(request), pathname)
    if (wait) {
      logLine('rate_limited', request, requestId, { rule: 'ip-global' })
      return json({ error: 'Too many requests. Please slow down.' }, 429, { 'Retry-After': String(wait) })
    }

    if (['POST', 'PUT', 'PATCH', 'DELETE'].includes(request.method)) {
      // Browsers always send Origin on cross-site writes. A different site's origin (or Sec-Fetch-Site: cross-site)
      // means a forged request riding on the visitor's cookies — refuse it.
      const origin = request.headers.get('origin')
      const site = request.headers.get('sec-fetch-site')
      let foreign = site === 'cross-site'
      if (origin) {
        try { foreign = foreign || new URL(origin).host !== request.headers.get('host') } catch { foreign = true }
      }
      if (foreign) {
        logLine('csrf_blocked', request, requestId, { origin })
        return json({ error: 'Cross-site request blocked' }, 403)
      }
    }
  }

  let response = NextResponse.next({ request: { headers: requestHeaders } })

  const cookieDefaults: Partial<CookieOptions> = { sameSite: 'lax', secure: HTTPS, path: '/' }
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookieOptions: cookieDefaults,
      cookies: {
        get(name: string) {
          return request.cookies.get(name)?.value
        },
        set(name: string, value: string, options: CookieOptions) {
          request.cookies.set({ name, value, ...options })
          response = NextResponse.next({ request: { headers: requestHeaders } })
          response.cookies.set({ name, value, ...options, ...cookieDefaults })
        },
        remove(name: string, options: CookieOptions) {
          request.cookies.set({ name, value: '', ...options })
          response = NextResponse.next({ request: { headers: requestHeaders } })
          response.cookies.set({ name, value: '', ...options, ...cookieDefaults })
        },
      },
    }
  )

  const { data: { session } } = await supabase.auth.getSession()

  // Redirect authenticated users away from auth pages
  if (session && AUTH_ROUTES.some((route) => pathname.startsWith(route))) {
    return finish(NextResponse.redirect(new URL('/', request.url)))
  }

  // Protect routes that require authentication
  if (!session && PROTECTED_ROUTES.some((route) => pathname.startsWith(route))) {
    const redirectUrl = new URL('/login', request.url)
    redirectUrl.searchParams.set('redirectTo', pathname)
    return finish(NextResponse.redirect(redirectUrl))
  }

  // Protect admin routes (the admin layout and every admin API re-check the role on the server as well)
  if (pathname.startsWith('/admin')) {
    // The admin area does not exist for anyone who isn't an admin: strangers get an ordinary 404, not a login prompt
    const hide = () => finish(NextResponse.rewrite(new URL('/page-not-found', request.url)))
    if (!session) return hide()

    // One query for profile + role (row-level security still applies: only admins can read admin_roles)
    const { data: row } = await supabase
      .from('profiles')
      .select('id, admin_roles!admin_roles_profile_id_fkey(role, is_active)')
      .eq('auth_user_id', session.user.id)
      .maybeSingle()
    const adminRole = (row?.admin_roles as { role: string; is_active: boolean }[] | undefined)?.find((r) => r.is_active)

    if (!adminRole) return hide()
  }

  return finish(response)
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|public).*)',
  ],
}
