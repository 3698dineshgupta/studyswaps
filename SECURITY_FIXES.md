# StudySwaps — Security Fixes Applied (this session)

Companion to `SECURITY_AUDIT.md`. Every fix below is already in the working tree (not yet committed/pushed — see the end of this document for that status). No destructive database migrations, credential rotations, DNS changes, or production deploys were performed; the Next.js version upgrade was code-only and run through the full test suite locally before being left for the repo owner to deploy.

---

## F1 — Next.js 14.2.35 → 15.5.27 (critical unauthenticated RCE + ~20 other advisories)

**`package.json` / `package-lock.json`**: `next` `14.2.35` → `^15.5.27`, `eslint-config-next` `14.2.0` → `^15.5.27` (kept in lockstep so lint rules match the runtime).

**`next.config.mjs`**: moved `serverComponentsExternalPackages` out of `experimental` to the new top-level `serverExternalPackages` key (Next 15 stabilized it).

**`src/lib/supabase/server.ts`**: `createClient()` made `async`; `cookies()` → `await cookies()`. Every one of the 24 existing call sites already wrote `await createServerClient()`, so this was a drop-in change with no caller-side fix needed for those.

**`src/lib/city.ts`**: `cityFromCookie()` made `async`; awaits `cookies()` internally. `resolveCity()` and `resolveCityForUser()` updated to `await cityFromCookie()`.

**`src/app/layout.tsx`**: the one direct call site of `cityFromCookie()` (outside `lib/city.ts` itself) updated to compute `initialCity` via `await cityFromCookie()` before render, instead of calling it inline in JSX. The inline `getFastUser(createClient())` call updated to `getFastUser(await createClient())`.

**8 server components/layouts updated from `createClient()` to `await createClient()`** (these import the raw, non-aliased export and were not caught by the grep that confirmed the 24 `createServerClient()` sites, since they use a different import name):
`src/app/(marketplace)/browse/page.tsx`, `src/app/page.tsx`, `src/lib/productPage.ts`, `src/app/dashboard/page.tsx`, `src/app/profile/page.tsx`, `src/app/sell/page.tsx`, `src/app/admin/layout.tsx`, `src/app/auth/callback/route.ts`.

**9 dynamic-route files — `params` re-typed `{ id: string }` → `Promise<{ id: string }>` and awaited at the top of each handler** (Next 15 made route params async; this is not caught by `tsc --noEmit` alone because the local type annotation isn't checked against Next's generated prop types outside of `next build`):
- `src/app/(marketplace)/product/[id]/page.tsx` (`generateMetadata` and the page component both)
- `src/app/(marketplace)/second-hand/[city]/page.tsx`
- `src/app/(marketplace)/second-hand/[city]/[category]/page.tsx`
- `src/app/api/offers/[id]/cart/route.ts`
- `src/app/api/offers/[id]/respond/route.ts`
- `src/app/api/orders/[id]/route.ts`
- `src/app/api/orders/[id]/status/route.ts` (every `params.id` reference in the file switched to a single destructured `id`)
- `src/app/api/products/[id]/route.ts` (all three handlers: `GET`, `PATCH`, `DELETE`)
- `src/app/api/tiles/[z]/[x]/[y]/route.ts`

**`src/app/(marketplace)/browse/page.tsx`**: `searchParams` re-typed as `Promise<BrowseSearchParams>`; `generateMetadata` made `async` and awaits it; the page component awaits it before reading `q`/`category`.

**Two landing-page route-segment configs**: `src/app/(marketplace)/second-hand/[city]/page.tsx` and `.../[city]/[category]/page.tsx` had `export const revalidate = LANDING_REVALIDATE` (an imported constant). Next 15's static analyzer for route segment config requires a literal it can parse without evaluating imports — changed to `export const revalidate = 600` with a comment pointing back at `lib/landingData.ts`'s `LANDING_REVALIDATE` as the source of truth to keep in sync. The now-unused import was removed from both files.

**Verification**: `npx tsc --noEmit -p .` clean; `NEXT_DIST_DIR=.next-secrun npx next build` succeeds (86 routes, including the static-param `second-hand/[city]`/`[city]/[category]` pages); full regression suite re-run against the built production server (`next start`) — see `SECURITY_TEST_RESULTS.md`.

---

## F2 — Timing-unsafe Telegram webhook secret comparison

**`src/lib/telegram/link.ts`**: added
```ts
import { createHash, randomInt, timingSafeEqual } from 'crypto'
export function webhookSecretToken(): string {
  const base = process.env.APP_SECRET || process.env.SUPABASE_SERVICE_ROLE_KEY || ''
  return createHash('sha256').update(`${base}:telegram-webhook`).digest('hex')
}
export function verifyWebhookSecretToken(received: string | null): boolean {
  const expected = Buffer.from(webhookSecretToken())
  const actual = Buffer.from(received ?? '')
  return expected.length === actual.length && timingSafeEqual(expected, actual)
}
```

**`src/app/api/telegram/webhook/route.ts`**: replaced the plain `!==` header comparison with `verifyWebhookSecretToken(request.headers.get('x-telegram-bot-api-secret-token'))`; also added a `LIMITS.telegramWebhook` rate limit (60/min) that this route previously had none of.

**`src/lib/security/rateLimit.ts`**: added the two presets this change and the related `telegram/link` route needed: `telegramLink: { limit: 10, windowMs: 3_600_000 }`, `telegramWebhook: { limit: 60, windowMs: 60_000 }`.

**Test**: `tests/security/telegram.test.ts` (new, 7 tests) — correct secret accepted; missing/empty/wrong-length/wrong-but-same-length headers all rejected without throwing; confirms `timingSafeEqual`'s length-mismatch exception is handled (it throws on unequal-length buffers, which is why the length check is a precondition, not an afterthought); confirms the derived token changes when `APP_SECRET` changes (not a fixed, guessable value); confirms link codes use an unambiguous alphabet (no `0`/`O`/`1`/`I`).

---

## F3 — Missing decompression-bomb cap on identity-document uploads

**`src/lib/identity.ts`**: added
```ts
// Same cap as the general upload checker (lib/security/imageCheck.ts): stops a small, highly-compressed file from
// decoding into a huge number of pixels ("decompression bomb") and burning CPU/memory before any size check can run.
const MAX_IMAGE_PIXELS = 40_000_000
```
and passed `{ limitInputPixels: MAX_IMAGE_PIXELS, failOn: 'error' }` to the `sharp(buffer, ...)` call inside `checkImage()`, plus `{ limitInputPixels: MAX_IMAGE_PIXELS }` to the `sharp(buffer, ...)` call inside `normalizeCapture()`. Previously only a per-side 8000px cap existed here (the general checker already had both caps; this one was missing the pixel-count cap specifically).

**Test**: `tests/security/identity.test.ts` (new, 6 tests) — the key regression test constructs a 7999×7999 PNG (under the 8000px per-side limit, ~64 megapixels total) and asserts `checkImage()` now rejects it; also covers a valid photo, an HTML file renamed to `.png`, an oversized-side image, a too-small image, and a file over the byte limit rejected before any decode is attempted.

---

## F4 — Auth-ordering regression in eSewa payment initiation

**`src/app/api/payments/esewa/initiate/route.ts`**: reverted the handler to check authentication **before** parsing/validating the request body (a same-day "fail fast" optimization had swapped this). Current order: `createServerClient()` → `supabase.auth.getUser()` → 401 if absent → rate limit → **then** `initiateSchema.safeParse(...)` → 400 if invalid. The safe part of the earlier optimization (fetching the profile and the order in one `Promise.all` instead of two sequential round trips) was kept.

**Verification**: `scripts/security/regression.mjs` check `A1 unauthenticated POST /api/payments/esewa/initiate is refused` — was failing with `status 400`, now passes with `status 401`.

---

## F5 — Stale-order cancellation silently became non-synchronous

**`src/app/api/orders/route.ts`**: the block that cancels a buyer's other abandoned `CREATED`/`PAYMENT_PENDING` orders whenever they place a new one (plus the dependent `payments.status = 'FAILED'` and `deliveries.current_status = 'CANCELLED'` updates on those stale orders) was moved back out of the fire-and-forget `void (async () => {...})()` block and into the main, synchronously-awaited request path — it now completes before the API responds, as it always had before the same-day eSewa-speed change. The delivery-timeline-row insert (`deliveries` + `delivery_events` for the **new** order) stays in the background block, since nothing downstream needs it to exist synchronously:
- `src/app/api/payments/esewa/verify/route.ts` already reads the delivery row with `.maybeSingle()` and guards with `if (delivery)`, so a not-yet-inserted row is handled gracefully.
- No test in `scripts/security/*.mjs` asserts the delivery row exists immediately after order creation (confirmed by `grep -rn "deliveries|current_status" scripts/security/*.mjs` — the only matches are in this test's own teardown and in `regression.mjs`'s unrelated cleanup, neither asserting immediacy).

**Verification**: `scripts/security/cart-after-cancel.mjs` check `trying again closes the abandoned first attempt` — was failing (`first order is PAYMENT_PENDING`, expected `CANCELLED`), now passes. Re-verified again after the Next.js 15 upgrade (both fixes landed together; each was independently re-tested against the Next 15 production build).

---

## F6, F7, F8 — Deferred dependency findings (documented, not changed)

No code change. See `SECURITY_AUDIT.md` §2 for the reachability analysis on each (nodemailer's exploitable options are unused; tailwindcss's vulnerable sub-deps are build-time-only; `@supabase/ssr`'s advisory is low-severity). Tracked as backlog items in `SECURITY_HARDENING_CHECKLIST.md` rather than fixed now, per the explicit instruction to avoid blind major-version upgrades.

---

## Status: not yet committed

All of the above are currently uncommitted changes in the working tree (`git status` shows them as modified/untracked). Per this project's standing practice, nothing is committed or pushed to GitHub without explicit instruction. New dependency state (`package-lock.json`) reflects `npm install next@15.5.27 eslint-config-next@15.5.27` already run locally.
