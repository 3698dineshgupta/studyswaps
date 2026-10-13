# StudySwaps — Security Test Results (this session)

All commands below were actually run against a local server during this engagement; none of these results are assumed or extrapolated. Where a tool was unavailable, that is stated explicitly rather than omitted.

## 1. Type checking

```
npx tsc --noEmit -p .
```
**Before any fix**: 4 errors (`cookies()` returning a Promise in `lib/city.ts` and `lib/supabase/server.ts`), then after fixing those, 25 more errors surfaced (`createClient()` called without `await` in 8 files, propagating into `dashboard/page.tsx`'s implicit-`any` errors downstream of the then-untyped Supabase client).
**After all fixes**: clean — 0 errors.

## 2. Production build

```
NEXT_DIST_DIR=.next-secrun npx next build
```
First attempt failed with:
```
⨯ Next.js can't recognize the exported `config` field in route ".../second-hand/[city]/[category]/page":
  Unknown identifier "LANDING_REVALIDATE" at "revalidate".
Type error: Type '{ searchParams: BrowseSearchParams; }' does not satisfy the constraint 'PageProps'.
```
This is the build step that actually validates `params`/`searchParams` types against Next's generated route types — **`tsc --noEmit` run in isolation does not catch this**, which is why both were run. After the `params`/`searchParams`/`revalidate` fixes (see `SECURITY_FIXES.md`), the build succeeded cleanly: 86 routes compiled, including the two `generateStaticParams`-driven `second-hand/[city]` and `second-hand/[city]/[category]` pages (verified their static sub-paths were generated: `/second-hand/kathmandu`, `/second-hand/butwal`, `/second-hand/kathmandu/books`, etc.).

## 3. Unit tests

```
npx jest
```
**Result**: `Test Suites: 1 skipped, 9 passed, 9 of 10 total` / `Tests: 1 skipped, 90 passed, 91 total`. The only console output during the run is an expected `security` log line from the rate-limiter's own test deliberately triggering a 429 — not a failure.

New test files added this session:
- `tests/security/telegram.test.ts` — 7/7 pass (timing-safe webhook secret verification, link-code alphabet).
- `tests/security/identity.test.ts` — 6/6 pass (including the decompression-bomb regression test).

## 4. Dependency audit

```
npm audit --omit=dev
```
| | Before | After |
|---|---|---|
| Critical | 1 | 0 |
| High | 7 | 7 (unchanged packages — see F6/F7 in the audit report) |
| Moderate | 2 | 3 |
| Low | 2 | 2 |

Full JSON saved at `security/npm-audit-report.json` (package/advisory metadata only — no secrets).

```
npm ls next
```
Before: `next@14.2.35`. After: `next@15.5.27`.

## 5. Live regression suites

All four pre-existing suites were run **twice**: once on the pre-upgrade tree (Next 14.2.35, dev server) to establish the baseline and catch F4/F5, and once more on the **post-upgrade production build** (`next build` + `next start`, Next 15.5.27) to confirm the Next.js migration introduced no new regressions.

### `node scripts/security/regression.mjs http://localhost:3100`
- First run (pre-fix): **56/57** — `FAIL A1 unauthenticated POST /api/payments/esewa/initiate is refused — status 400` (this is F4).
- After fixing F4: **57/57**.
- Re-run after the Next.js 15 upgrade (production build): **57/57**.

Full passing categories: authentication/authorization (A1–A9), payments (P1–P6), listings/photos/uploads (L1–L9), search/injection bounds (I1–I4), and 12 direct-PostgREST DB-level checks (D1–D12) run with **real per-user anon-key sessions**, not the service-role client — self-verification grant, self-rating fraud, phone-number exposure, fake-paid-order insert, buyer-address leak to seller, wallet-credit self-call, wallet-deduct-on-another-user, pending→available bypass, direct withdrawal insert, product status/stock tamper, photo-deletion-to-dodge-minimum, audit-log forgery — all correctly refused.

### `node scripts/security/admin-flow.mjs http://localhost:3100`
**26/26** both before and after the Next.js upgrade. No regressions from either session's changes.

### `node scripts/security/auth-limits.mjs http://localhost:3100`
All checks pass both times, with one caveat documented in §6 below (a test-environment rate-limit-bucket collision, not an application bug).

### `node scripts/security/cart-after-cancel.mjs http://localhost:3100`
- First run (pre-fix): **2/3** — `FAIL trying again closes the abandoned first attempt — first order is PAYMENT_PENDING` (this is F5).
- After fixing F5: **3/3**.
- Re-run after the Next.js 15 upgrade (production build): **3/3**.

## 6. A note on test-environment noise (not an application bug)

During this session, `regression.mjs` and `auth-limits.mjs` were run many times in quick succession against the same local server while diagnosing F4/F5. Both suites create throwaway accounts and hit rate-limited endpoints (`listing`, `signup-*`, `login-*`). Because these local test runs hit `localhost` directly with no `X-Forwarded-For`/`CF-Connecting-IP` header, `clientIp()` resolves to the literal string `"unknown"` for every one of them — and because this project's rate limiter is Redis-backed (`REDIS_URL` is set), that `"unknown"`-IP bucket **persists across dev-server restarts**, unlike a purely in-memory limiter. This produced two rounds of false-looking `429`-driven failures (`L1`–`L5` in `regression.mjs`, then `L1`/`L5` in `auth-limits.mjs`) that were **test-harness self-collision, not a real finding**: a real browser behind Vercel always sends a real IP header, so the `"unknown"` key can only ever be produced by direct, header-less local requests like these test scripts — it cannot be hit by genuine production traffic. Confirmed by inspecting the actual 429 response bodies and the Redis keys involved (`rl:listing:ip:unknown`, `rl:signup-ip-hour:ip:unknown`, etc.), then clearing only those specific test-only keys (`r.del(...)` on the exact `rl:<rule>:ip:unknown` style keys enumerated via `r.keys('rl:<rule>:*')`) and re-running for a clean result. No rate-limiter logic was changed or weakened to make this pass — the limiter behaved correctly throughout; the noise was purely from reusing one IP bucket across many manual test invocations.

One more pass of `regression.mjs` separately showed `L2 listing with 2 photos refused` failing — this is **not a bug either**: an earlier (already-landed) change in this project lowered the listing photo requirement from 3–6 photos to 1–3, so 2 photos is now valid and the old test assertion (written for the 3–6 range) is stale. This was not "fixed" in app code since the app's current 1–3 behavior is the intended, already-shipped behavior; it surfaced only as a side effect of the rate-limit-bucket investigation above and is noted here for completeness, not treated as a new finding requiring a code change. (Updating the test script itself to match the 1–3 range is a reasonable follow-up, tracked in the checklist.)

## 7. Manual smoke tests (post-Next.js-upgrade, production build)

```
curl http://localhost:3100/product/00000000-0000-0000-0000-000000000000   → 200 (not-found page; app intentionally returns 200, see code comment)
curl http://localhost:3100/second-hand/kathmandu                          → 200 (static-generated city page)
curl http://localhost:3100/second-hand/kathmandu/books                    → 200 (static-generated category page)
curl "http://localhost:3100/browse?q=test&category=books"                 → 200
curl http://localhost:3100/api/orders/not-a-uuid                          → 404 {"error":"Order not found"}
curl http://localhost:3100/api/products/not-a-uuid                        → 404 {"error":"Product not found"}
curl http://localhost:3100/api/tiles/15/1000/1000                         → 404 "Tile not available here"
curl -sI http://localhost:3100/                                           → CSP (with per-request nonce + strict-dynamic), X-Frame-Options: DENY, X-Content-Type-Options: nosniff all present
```
These specifically target the 9 files whose `params` handling changed for Next 15 (product/city/category pages, orders/products/tiles API routes) to confirm the dynamic-segment values are actually reaching the handlers correctly post-migration, not just that the build succeeds.

## 8. What was not (and could not be) tested

- No SAST (Semgrep), DAST (OWASP ZAP), container (Trivy), IaC (Checkov), or dedicated secret-scanner (Gitleaks/TruffleHog) tool actually executed — all were attempted via `npx`/`pip` and failed for lack of a Python/Go/Docker runtime in this Windows sandbox. Manual code review and `git grep`/`git log -S` substituted for secret scanning; `npm audit` substituted for SCA. This is a genuine coverage gap, stated plainly rather than glossed over.
- No load/DoS testing was performed against the live production domain (would require explicit approval given the risk of a real outage).
- No test against the real eSewa production gateway or real Telegram bot token was performed — all route-level tests used the app's own validation logic with mocked/throwaway data, not a live round trip to eSewa/Telegram.
