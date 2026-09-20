# StudentMarket — Security audit, fixes and runbook

Posture: **improved, not "unhackable"**. Nothing here is a guarantee; the remaining risks are listed at the end.

## 1. Architecture and trust boundaries

```
USER (browser: fully untrusted)
  │  HTTPS                                             ← TB1: everything the browser sends can be forged
  ▼
Next.js 14 (middleware: CSP nonce, CSRF origin check, IP throttle, session refresh, /admin gate)
  │
  ├─ Route handlers /api/*  (validate → authenticate → authorize → act with the service role)
  │      ↳ rate limit (memory or Redis) · zod schemas · audit log · security log
  │
  ├─ Supabase Auth (GoTrue: bcrypt passwords, JWT + refresh rotation, email flows)   ← TB2
  ├─ Supabase Postgres (RLS + column grants + SECURITY DEFINER functions)           ← TB3: the browser can ALSO talk to this
  ├─ Supabase Storage (private bucket for ID photos; public bucket only for product photos)
  ├─ Cloudinary (product photos, signed server-side uploads)
  ├─ eSewa ePay v2 (payments; verified server-side: signature + amount + status API)  ← TB4
  ├─ Telegram Bot API (ops alerts, server-side only)
  └─ OpenStreetMap: Nominatim / Photon / tiles (server-proxied)
```

Key fact: the anon key ships in the browser, so **the database API is a second front door**. Row-level security decides
*rows*, not *columns* or *functions*. Most critical findings were there.

## 2. Findings (verified by `scripts/security/regression.mjs`; baseline 38/57 → 47/57 app-level fixed, rest needs migration 008)

| ID | Severity | Where | Evidence (before) | Fix | Status |
|---|---|---|---|---|---|
| S1 | **CRITICAL** | DB: `credit_seller_pending`, `release_pending_to_available` callable by any signed-in user | Test user credited themselves Rs 1000 and moved it to "available" | `REVOKE EXECUTE … FROM PUBLIC, anon, authenticated` (008) | Fixed in SQL — **run 008** |
| S2 | **CRITICAL** | DB: `profiles_self_update` allowed every column | User set own `verification_status='VERIFIED'`, `total_sales=999` | Column-level `GRANT UPDATE (full_name, phone, profile_photo, bio, location, college_name)` (008) | Fixed in SQL — **run 008** |
| S3 | **CRITICAL** | DB: `orders_create` policy | User inserted an order already `PAYMENT_CONFIRMED` | Policy dropped, INSERT/UPDATE revoked on orders + money tables (008) | Fixed in SQL — **run 008** |
| S4 | **CRITICAL** | DB: `withdrawals_self_create` | User inserted a Rs 99,999 withdrawal row | Policy dropped, writes revoked (008) | Fixed in SQL — **run 008** |
| S5 | HIGH | DB: `profiles_public_read` exposed `phone` to anyone with the anon key | Phone numbers readable unauthenticated | Column-level SELECT without phone; own profile via `my_profile()` (008) | Fixed in SQL — **run 008** |
| S6 | HIGH | DB + API: buyer's address/phone visible to the seller | Seller order API returned address + phone | API reads via server and redacts per role; address columns hidden from browsers (008) | API fixed ✔ / DB part — **run 008** |
| S7 | HIGH | DB: sellers could edit `products.status/quantity`, delete `product_images` | Stock set to 5000; all photos deleted (bypasses "3 photo minimum" and moderation) | Column grants, image writes revoked (008); PATCH schema `.strict()` and server-side writes | API fixed ✔ / DB part — **run 008** |
| S8 | HIGH | Next.js 14.2.0 (critical advisories, incl. middleware authorization bypass) | `npm audit` critical | Upgraded to 14.2.35; middleware strips `x-middleware-subrequest`; admin layout + every admin API re-check role | Fixed ✔ (see residual R1) |
| S9 | HIGH | `/api/upload` legacy endpoint: extension from user filename, `startsWith` ownership check on delete (path traversal) | Endpoint accepted arbitrary bucket uploads | Endpoint deleted (unused) | Fixed ✔ |
| S10 | HIGH | Photo upload trusted `Content-Type` | HTML disguised as PNG → 500 / forwarded to Cloudinary | Magic-byte check with sharp, pixel cap (40 MP), 8000 px, 10 MB, min 200 px | Fixed ✔ |
| S11 | HIGH | Order creation: cart quantity taken from a user-editable table; oversell on last item | Quantity 500 accepted at API; two payers could both get the last item | Server re-validates qty vs stock; atomic compare-and-set stock reservation at payment; oversold → auto-cancel + refund alert | Fixed ✔ |
| S12 | MEDIUM | Mass assignment on `PATCH /api/products/[id]` (accepted `status`) | `status:'ACTIVE'` bypassed moderation | `.strict()` schema; status removed from seller-editable fields | Fixed ✔ |
| S13 | MEDIUM | No CSRF defence beyond SameSite | Cross-origin POST accepted (status 409 from logic, not policy) | Origin / `Sec-Fetch-Site` check on all mutating `/api` calls | Fixed ✔ |
| S14 | MEDIUM | No rate limiting anywhere | — | Per-IP global throttle (middleware) + per-action, per-user limits (cart, checkout, payments, uploads, geocode, withdrawals, identity, admin) + 429 + `Retry-After`; Redis-backed when `REDIS_URL` set | Fixed ✔ |
| S15 | MEDIUM | CSP had `unsafe-inline` + `unsafe-eval` for scripts | — | Per-request nonce + `strict-dynamic` in production (verified with a production build: hydration works, no violations); `frame-ancestors 'none'`, `form-action` allow-list, HSTS + `upgrade-insecure-requests` on HTTPS | Fixed ✔ |
| S16 | MEDIUM | Admin user moderation done from the browser with the anon key | Silently failed / relied on RLS | `/api/admin/*` (role-checked, rate-limited, audited): users, listings, orders, withdrawals, disputes, audit, stats | Fixed ✔ |
| S17 | MEDIUM | Reviews: reviewer could attach a review to any `seller_id`; sellers could edit ratings | — | Policy checks seller = order's seller; sellers may only update reply fields (008) | Fixed in SQL — **run 008** |
| S18 | MEDIUM | Audit inserts used a non-existent `metadata` column (silently lost) | Payment/listing audit rows missing | Corrected to `new_data`; central `audit()` helper with IP/UA | Fixed ✔ |
| S19 | MEDIUM | Search / pagination unbounded | `page=99999999` → 500 | Query ≤ 80 chars, filter-syntax chars stripped, page ≤ 500, size ≤ 50, enum whitelists | Fixed ✔ |
| S20 | MEDIUM | Tile proxy = free open proxy | — | Only tiles inside the two launch cities, zoom 10–19, throttled, cached | Fixed ✔ |
| S21 | LOW | `INTERNAL_SECRET` compared with `!==` | — | Constant-time compare, ≥16 chars required, disabled if unset | Fixed ✔ |
| S22 | LOW | `X-Powered-By` header; no COOP/CORP; weak Permissions-Policy | — | Removed / added | Fixed ✔ |
| S23 | LOW | Redis published on `0.0.0.0:6379` with no password (docker-compose) | — | No published port, `requirepass`, `no-new-privileges`, read-only app FS, `cap_drop: ALL` | Fixed ✔ |
| S24 | LOW | Unused deps (`uuid`, `crypto-js`) with advisories | — | Removed; `sharp` → 0.35.4 | Fixed ✔ |
| S25 | INFO | Cookies: session cookie must be readable by the browser client (not HttpOnly) — inherent to `@supabase/ssr` browser client | — | `SameSite=Lax`, `Secure` on HTTPS, CSP nonce reduces XSS risk | Accepted (R3) |

**Verified good (no change needed):** eSewa verification (signature + amount + status API + idempotent claim), identity-verification capture (server-issued session, private bucket, liveness), order IDOR (404 for non-parties), photo ownership + traversal checks on listing create, geocoded addresses are HMAC-signed (fee can't be tampered), pricing computed only on the server, open redirects (`redirectTo`/`next` sanitised), no `dangerouslySetInnerHTML`/`eval`, secrets only in `.env.local` (git-ignored) and never in the browser bundle.

## 3. What you must do (I cannot do these for you)

1. **Run `supabase/run-009-010.sql`** in the Supabase SQL editor (008 is already applied — the regression suite passes 57/57; 009 adds the refund/withdrawal functions, 010 adds performance indexes). Afterwards run `node scripts/security/regression.mjs` — all 57 checks should pass.
2. **Rotate every secret that was ever pasted into a chat / shared**: Supabase service-role + anon keys (Project Settings → API → regenerate JWT secret if you can), eSewa secret, Cloudinary API secret, Telegram bot token (BotFather `/revoke`). Treat pasted secrets as compromised.
3. **Delete the demo accounts before launch** (`*@studentmarket.test`, password `the demo password`) — seeded logins with a known password, one of them verified with a wallet.
4. Supabase Dashboard → Auth → **password minimum length 10**, enable **leaked-password protection** (Pro), set **Site URL / redirect allow-list** to your domain only, enable **CAPTCHA (Turnstile)** on sign-up/sign-in, keep email confirmation ON for production, review the built-in auth rate limits.
5. Set `NEXT_PUBLIC_APP_URL` to your **https** URL in production (turns on HSTS, secure cookies, upgrade-insecure-requests).
6. Set `INTERNAL_SECRET` (32+ random chars) only if you want the ops release endpoint.
7. Turn on **Supabase backups** (daily; PITR on Pro) and test a restore once.

## 4. WAF / edge (deployment platform is not decided yet)

Recommended: **Cloudflare (free plan is enough) in front of the app**, or Vercel Firewall if you deploy on Vercel.
- Proxy DNS through Cloudflare; SSL "Full (strict)"; Always-HTTPS; min TLS 1.2.
- Managed WAF rules + Bot Fight Mode; "Under attack" mode as a switch for incidents.
- Rate limit rules: `/api/*` 100 req/min/IP, `/login` + `/register` + `/api/auth/*` 10/min/IP, `/api/payments/*` 20/min/IP.
- Turnstile on login/sign-up. Block countries only if you truly need it (Nepal-only launch: optional, low value, easy to bypass).
- Firewall rule: allow only your eSewa callback path from anywhere; keep `/admin` and `/api/admin` behind Cloudflare Access (email OTP) for an extra factor.
- Because the app trusts `cf-connecting-ip` for rate limits, **only expose the origin to Cloudflare** (origin firewall / authenticated origin pulls), otherwise a client can spoof it.
- Server (if a VPS): only 80/443 + SSH from your IP, key-only SSH, no root login, `unattended-upgrades`, `ufw`, Docker not exposing DB/Redis (compose already fixed).

## 5. Monitoring and logging

- **Security log**: JSON lines with `level:"security"`, `requestId`, IP, path (events: `rate_limited`, `csrf_blocked`, `forbidden`, `admin_action`, `payment_confirmed`, `payment_oversold`, `upload_rejected`, `internal_secret_rejected`). Ship stdout to any log platform and alert on spikes of `rate_limited`, `csrf_blocked`, `forbidden`.
- **Audit trail**: table `audit_logs` (who/what/when/IP/UA/old+new data) — viewable in **Admin → Activity log**.
- **Telegram** ops chat gets: new listing (with review link), new order, payment confirmed, refund required, oversold, withdrawal requested/paid, listing decisions, security alerts.
- Recommended: Sentry (errors, scrub PII), uptime monitor on `/login`, Supabase log alerts for auth failures.

## 6. Incident response (credential leak or suspected breach)

1. **Contain**: revoke/rotate the credential (Supabase keys, eSewa, Cloudinary, Telegram, `APP_SECRET`); turn on Cloudflare "Under attack"; if needed set the site to maintenance.
2. **Invalidate sessions**: Supabase → Auth → sign out all users / rotate JWT secret.
3. **Investigate**: `audit_logs`, Supabase logs, security log by `requestId`/IP; check `payments`, `wallet_ledger`, `withdrawals` for anomalies; pause withdrawals (leave them in REQUESTED).
4. **Patch** the root cause, add a regression test to `scripts/security/regression.mjs`, verify.
5. **Recover**: restore from backup if data was altered; refund affected buyers via eSewa.
6. **Notify** affected users and, if required, the authorities; write a short post-mortem.
7. **Monitor** closely for 2 weeks.

## 7. Environments

Use three Supabase projects: **development**, **staging**, **production**. Run `regression.mjs` and any aggressive tests only on staging. Production keeps `NODE_ENV=production`, no seed scripts, no demo users.

## 8. Tests you can re-run

- `npm test` — unit tests (pricing, city rules, rate limiter, image validator).
- `node scripts/security/regression.mjs [baseUrl]` — 57 attack scenarios against a running server (throwaway users, cleaned up).
- `node scripts/security/admin-flow.mjs [baseUrl]` — listing approval flow + admin permissions.
- `node scripts/security/cart-after-cancel.mjs [baseUrl]` — cart survives a cancelled payment.

## 9. Remaining risks

| # | What | Why | Risk | Recommended fix |
|---|---|---|---|---|
| R1 | Next.js 14.x still lists DoS-class advisories fixed only in 15/16 (image optimizer `remotePatterns`, RSC deserialization DoS, rewrites smuggling — we use no rewrites) | 14.2.35 is the last 14.x | Availability, not data theft | Plan an upgrade to Next 15/16 LTS; WAF request-size limits meanwhile |
| R2 | In-memory rate limiting is per instance | Multiple instances each keep their own counters | Limits are looser than stated when scaled out | Set `REDIS_URL` (docker-compose provides it) and/or Cloudflare rate limits |
| R3 | Session cookie is readable by JS | `@supabase/ssr` browser client design | Token theft if XSS is ever found | Nonce-CSP is in place; optional: move to server-only cookie auth (`@supabase/ssr` ≥0.5 API) |
| R4 | Register endpoint reveals whether an email exists | Supabase behaviour | Account enumeration | Enable CAPTCHA + confirmation emails; generic messaging if you turn confirmation ON |
| R5 | Withdrawals are paid manually | No eSewa payout API integration | Operator error / insider risk | Two-person rule for large payouts; audit log already records who paid |
| R6 | Admin pages for verification review still use the older client UI | Works via server API; not restyled | Low | Migrate to the new admin kit |
| R7 | eSewa production credentials in `.env.local` | Real money | Financial | Keep sandbox until launch; rotate the secret (see §3.2) |
| R8 | No automated dependency updates / CI security scan | No CI in repo | Drift | Enable Dependabot + `npm audit` in CI |
| R9 | Product photos are public URLs (Cloudinary) | Needed for the marketplace | Anyone with a URL can view that photo | Accepted; IDs are private (Supabase private bucket) |
| R10 | Orphaned uploads (photos uploaded but listing never published) remain in Cloudinary | Upload-before-publish design | Storage cost | Periodic cleanup job of `studentmarket/products/` not referenced in `product_images` |

## 10. Performance changes that touch security (added with the speed audit)

- **Local JWT verification for read paths.** `getUser()` calls Supabase's auth server on every request (350–650 ms). Read paths (page shell, cart list, order lists, admin GET endpoints) now verify the ES256 access token locally (`src/lib/auth/session.ts`: signature against Supabase's public JWKS, expiry, issuer, audience). Forged/expired tokens still fail; unknown algorithms fall back to `getUser()`. **Trade-off:** a token revoked by "sign out" stays valid for reads until it expires (≤ 1 hour). **Anything that changes data — orders, payments, withdrawals, order status, every admin POST — still calls `getUser()`.**
- **Rate-limit counters** now live in Redis (Upstash) and are updated with one pipelined atomic script per request; if Redis is unreachable the limiter falls back to per-instance memory (still enforcing limits).
- **Profile/role lookup for the page shell** is cached in memory for 15 s per user. The cache only drives *what is displayed* (avatar, "Admin panel" link); every admin page and API re-checks the role from the database.
- **Public product lists** may be cached by CDNs/browsers for 15–30 s, but only when the city is passed explicitly in the URL (the data is identical for everyone). Private data (cart, orders, wallet, admin) is never cached.
- **Fonts are self-hosted** (`next/font`), so the CSP no longer needs `fonts.googleapis.com` / `fonts.gstatic.com`.
