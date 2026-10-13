# StudySwaps — Security Audit Report

**Date:** 2026-10-13
**Target:** studyswaps.com (Next.js 14→15 App Router app on Vercel, Supabase Postgres/Auth/Storage, Redis (Upstash), eSewa ePay v2, Telegram Bot API, Cloudinary)
**Repo:** https://github.com/3698dineshgupta/studyswaps (branch: `main`)
**Scope:** this is a point-in-time audit of the current working tree, performed in continuation of an existing, ongoing security program — see `SECURITY.md` for the full history of prior findings (S1–S25) and the architecture diagram. This report documents what changed in **this** engagement: a fresh adversarial pass over every route/library added since the last audit (price-negotiation/offers, Telegram personal notifications, document-based identity verification, eSewa checkout-speed changes), a dependency audit, and remediation of everything found.
**Auditor:** Claude (Sonnet 5), acting as the engineering agent, with the repo owner reviewing and approving each consequential change (notably the Next.js major-version upgrade, explicitly approved before being performed).

---

## 1. Methodology

| Activity | How it was done | Result |
|---|---|---|
| Attack-surface mapping | Read every route under `src/app/api/**/route.ts` added since the last audit (offers ×3, telegram/link, telegram/webhook) plus the modified eSewa/orders/identity routes | Mapped in §2 |
| AuthN/AuthZ review | Manual trace of every route: is the caller authenticated before any side effect; is ownership checked before any read/write of someone else's data | 2 real bugs found, both fixed (F2, F4) |
| IDOR / privilege escalation | Re-ran the existing IDOR regression suite (`scripts/security/regression.mjs`, A1–A9, D1–D12) against a live server with **real per-user Supabase sessions** (not the service-role client) | 57/57 pass — see `SECURITY_TEST_RESULTS.md` |
| Injection (SQLi/XSS/SSRF) | New surface is 100% Supabase query-builder calls (parameterized) + zod-validated bodies; no new raw SQL, no new `dangerouslySetInnerHTML`, no new outbound fetch with user-controlled host | No new injection surface found |
| Business-logic / financial logic | Traced the offers state machine (bounded, no infinite back-and-forth), the eSewa amount-signing path, and the order-creation/cancellation flow end-to-end | 1 real regression found and fixed (F5) |
| Secrets in source history | `git grep` across the current tree + `git log --all -p -S"<value>"` for exact known secret values, plus pattern scans for AWS-key/private-key/JWT shapes | Clean — no secrets in tracked history |
| Dependency / supply-chain | `npm audit --omit=dev` before and after remediation; `npm ls <pkg>` to confirm whether a flagged package is runtime-reachable or build-tooling-only before deciding urgency | See §3 — 1 critical dependency finding, fixed |
| Automated SAST/DAST/secret/container tooling | Attempted `npx`-based installs of semgrep, gitleaks, OWASP ZAP, Trivy, osv-scanner, checkov, trufflehog, ggshield | **None available** in this Windows sandbox (no Python/pip, no Go, no Docker; `npx trufflehog` resolved to an unrelated package by name collision). Documented honestly rather than claimed — see §6 |
| Live header/RLS verification | `curl -sI` against the running build for CSP/HSTS/frame headers; direct PostgREST calls with a real anon-key session (not service role) for D1–D12 | Headers correct; RLS holds under real sessions |
| Regression testing | Full existing suite (`regression.mjs`, `admin-flow.mjs`, `auth-limits.mjs`, `cart-after-cancel.mjs`) + `tsc --noEmit` + `jest` + a full production `next build`, run **twice**: once before, once after the Next.js upgrade | All green both times — see `SECURITY_TEST_RESULTS.md` |

---

## 2. Findings from this engagement

Severity follows CVSS-informed judgment (exploitability × impact in this app's actual context, not the raw advisory score in isolation).

| ID | Severity | Area | Finding | Status |
|---|---|---|---|---|
| F1 | **CRITICAL** | Dependency — `next@14.2.35` | Two **unauthenticated RCE** advisories in range (Image Optimization API when AVIF files are used, `>=10.0.0 <15.5.24`; a Windows-host RCE) plus ~20 DoS/SSRF/cache-poisoning/request-smuggling advisories, all fixed at `next@15.5.24+`. This app serves AVIF (`next.config.mjs` → `images.formats`), so the primary RCE vector was reachable. | **Fixed** — upgraded to `next@15.5.27` with full regression + manual verification. See F1 detail below and `SECURITY_FIXES.md`. |
| F2 | HIGH | `src/app/api/telegram/webhook/route.ts` | The incoming `X-Telegram-Bot-Api-Secret-Token` header was compared with plain `!==`, a non-constant-time comparison. Inconsistent with this project's own established pattern (eSewa signature verification already uses `crypto.timingSafeEqual`). A non-constant-time compare on a secret can leak it one byte at a time via response-timing side channels. | **Fixed** — `verifyWebhookSecretToken()` now uses `timingSafeEqual` with a length pre-check. 7 regression tests added (`tests/security/telegram.test.ts`). |
| F3 | HIGH | `src/lib/identity.ts` (`checkImage`) | The identity-document upload validator capped width/height at 8000px per side but had **no total-pixel cap**, unlike the general upload checker (`lib/security/imageCheck.ts`, 40-megapixel cap). A 7999×7999 PNG (~64 MP, small on disk when highly compressed) passes the per-side check but forces `sharp` to decode/resize tens of millions of pixels — a decompression-bomb DoS vector on an endpoint any signed-up user can call. | **Fixed** — added `limitInputPixels: 40_000_000` to match `imageCheck.ts`. Regression test added (`tests/security/identity.test.ts`) asserting the same 7999×7999 case is now rejected. |
| F4 | HIGH (functional/security regression) | `src/app/api/payments/esewa/initiate/route.ts` | Earlier the same day, a checkout-speed change reordered this route to validate the request body **before** checking authentication ("fail fast"). This meant an unauthenticated caller with a malformed body got `400 Invalid input` instead of `401 Unauthorized` — leaking "your request shape was wrong" to an anonymous caller before confirming who they are, and breaking the project's own standing invariant (every regression test on this route expects 401/403/404 for an unauthenticated caller, never 400). | **Fixed** — reverted to auth-check-first, keeping the safe `Promise.all` parallelization of the profile/order lookups. Confirmed via `scripts/security/regression.mjs` (A1 check). |
| F5 | MEDIUM (business-logic regression) | `src/app/api/orders/route.ts` | The same checkout-speed change moved the "cancel the buyer's other abandoned unpaid orders" step into a fire-and-forget background block (to let the buyer redirect to eSewa without waiting). This silently changed a previously **synchronous, guaranteed** behavior into an eventually-consistent one — proven by the existing `scripts/security/cart-after-cancel.mjs` regression test, which checks the abandoned order's status immediately after the second order-creation call returns, with no delay. Real-world impact was bounded (stock isn't reserved at order-creation time, so no double-sell), but it broke a deliberately-tested guarantee. | **Fixed** — stale-order cancellation (and its dependent `payments`/`deliveries` status updates) moved back to the synchronously-awaited request path. The delivery-timeline-row insert stays fire-and-forget (confirmed safe: `esewa/verify/route.ts` already tolerates a missing delivery row via `.maybeSingle()` + an `if (delivery)` guard, and no test depends on its immediate presence). |
| F6 | LOW | Dependency — `nodemailer@6.10.1` | 12 advisories (SMTP command injection via `envelope.size`/transport name, CRLF header injection, SSRF via the `raw`/`resolveContent` options, DNS-cache cross-tenant credential leak, several DoS). **Real exposure assessed as low**: the only call site (`src/lib/email.ts`) uses plain `{from, to, subject, html, text}` — none of the exploitable options (`raw`, `resolveContent`, custom `envelope`, custom transport `name`, `jsonTransport`) are used anywhere in this codebase (verified by `grep -rn "nodemailer" src/` — one usage, one `sendMail()` call). The `subject` field already passes through an existing `oneLine()` helper that strips `\r\n` specifically to prevent header injection. | **Deferred, documented**. Upgrading to `nodemailer@10.1.0` is a major-version jump the user asked to avoid doing blindly; recommend scheduling it separately with its own test pass (its API changed in `nodemailer@7`). Tracked in `SECURITY_HARDENING_CHECKLIST.md`. |
| F7 | LOW | Dependency — `tailwindcss@3.4.x` → `braces`/`chokidar`/`micromatch`/`fast-glob`/`postcss-nested`/`postcss-selector-parser` | File-watcher/glob-matching DoS and ReDoS advisories. **All of these packages run only at build time** (`next build`/`next dev`, Tailwind's own file-watching), never against attacker-supplied input at request time — confirmed `tailwindcss` is a direct (non-dev) dependency, which is why `npm audit --omit=dev` lists it, but it has no runtime code path. | **Deferred, documented**. Fix requires Tailwind v4 (breaking config/plugin-syntax changes) — out of scope for "avoid blind major-version upgrades." Tracked in the checklist. |
| F8 | LOW | Dependency — `@supabase/ssr@0.3.0` | `cookie <0.7.0` — accepts out-of-bounds characters in cookie name/path/domain. Fix is `@supabase/ssr@0.12.7`, a large jump within the 0.x line (treated as potentially breaking by semver convention). | **Deferred, documented**. Low severity, low urgency; schedule with its own regression pass. |

### F1 detail — the Next.js upgrade

`npm audit --omit=dev` on the pre-audit tree showed:

```
next  9.3.4-canary.0 - 16.3.0-preview.10
Severity: critical
...24 advisories, including:
- GHSA-h25m-26qc-wcjf  Next.js HTTP request deserialization DoS            (>=13.0.0 <15.0.8)
- GHSA-ggv3-7p47-pfv8  HTTP request smuggling in rewrites                   (>=9.5.0  <15.5.13)
- [RCE] Unauthenticated Remote Code Execution in Image Optimization API
         when AVIF files are used                                          (>=10.0.0 <15.5.24)
- [RCE] Unauthenticated Remote Code Execution on windows-hosted servers     (>=13.4.0 <15.5.24)
...plus SSRF (Server Actions / WebSocket upgrades), cache-poisoning, CSP-nonce bypass XSS, middleware/i18n bypass
fix available via `npm audit fix --force`
Will install next@16.4.0, which is a breaking change
```

`npm audit`'s suggested fix (`next@16.4.0`) is two major versions up and was explicitly the kind of "blind major-version upgrade" the engagement rules said to avoid. Cross-referencing every advisory's fixed-version floor showed the actual minimum safe version is **`next@15.5.24`** — one major version up, not two. `next@15.5.27` (the latest 15.5.x patch at audit time) was available and chosen.

This app serves `image/avif` from `next.config.mjs`'s `images.formats`, so the unauthenticated AVIF-decode RCE was a live, reachable vector on the production image-optimization endpoint — the single highest-severity finding of this engagement. Given the stakes (live payment-processing site), this was **not** performed unilaterally: the repo owner was asked explicitly and chose "upgrade now, test fully, then deploy" before any code was touched.

**What the upgrade actually required** (beyond bumping the version number) — Next.js 15 made `cookies()`, and page/layout/route-handler `params`/`searchParams`, return `Promise`s instead of plain objects. This is silent at the TypeScript level for `params`/`searchParams` (a local type annotation like `{ params: { id: string } }` doesn't get checked against Next's real prop type unless the project's generated route types are consulted — which only happens inside `next build`, not `tsc --noEmit` in isolation). Concretely fixed:
- `src/lib/supabase/server.ts`, `src/lib/city.ts`: `cookies()` → `await cookies()` (24 call sites already awaited the wrapping function, confirmed by grep before changing).
- 8 server components/layouts that called the raw `createClient()` export without `await` (pages render fine today because it happened to return a thenable-compatible shape under 14; under 15 it's a hard break) — all given `await`.
- 9 dynamic-route files (`product/[id]`, `second-hand/[city]`, `second-hand/[city]/[category]`, `offers/[id]/cart`, `offers/[id]/respond`, `orders/[id]`, `orders/[id]/status`, `products/[id]` ×3 handlers, `tiles/[z]/[x]/[y]`) — `params` re-typed as `Promise<...>` and awaited before use.
- `browse/page.tsx` — `searchParams` re-typed as `Promise<...>` and awaited; `generateMetadata` made `async`.
- `next.config.mjs` — `experimental.serverComponentsExternalPackages` renamed to top-level `serverExternalPackages` (Next 15 moved it out of experimental).
- Two landing pages' `export const revalidate` — Next 15's route-segment-config static analyzer requires a literal, not an imported constant; inlined `600` with a comment pointing back at the source of truth.

Every one of these was caught by either `npx tsc --noEmit` (the `cookies()`/`createClient()` cases) or `next build`'s own stricter page-type validation (the `params`/`searchParams` cases, which `tsc` alone does not catch) — none were caught by runtime testing alone, which is exactly why both were run. See `SECURITY_TEST_RESULTS.md` for the full verification trail, including manual smoke tests of every affected dynamic route.

---

## 3. Dependency audit — before / after

| | Before this session | After |
|---|---|---|
| Critical | 1 (`next`) | **0** |
| High | 7 | 7 (nodemailer ×1 group, tailwindcss-chain ×2 — both deferred, see F6/F7) |
| Moderate | 2 | 3 (unchanged packages; count shift is from the `next` entry's removal re-grouping the audit tree, not a new issue) |
| Low | 2 | 2 (`@supabase/ssr`/`cookie` — F8) |

Earlier in this security program (before this session), `@tanstack/react-query-devtools` was removed entirely (zero usages found anywhere in `src/`, eliminating 2 criticals with no functional risk) and `sharp` was bumped `0.35.4→0.35.5` (exact patch). Those are already in the working tree from the prior pass; this session's new change is the `next`/`eslint-config-next` major bump (F1) plus the two targeted security-code fixes (F2, F3) and the two regression reverts (F4, F5).

Full machine-readable `npm audit --json` output (post-fix) is saved at `security/npm-audit-report.json` for reference. No secrets or credentials appear in it — it is purely package/advisory metadata.

---

## 4. What was verified clean (no new issue found)

- **RLS under real sessions**: D1–D12 in `regression.mjs` — self-verification grant, self-rating fraud, phone-number exposure, fake-paid order insertion, buyer-address leak to seller, wallet-credit self-call, wallet-deduct on another user, pending→available bypass, direct withdrawal insert, product status/stock tamper, photo-deletion-to-dodge-minimum, audit-log forgery — all refused, tested with **real anon-key sessions signed in as throwaway users**, not the service-role client.
- **New API routes' auth ordering**: all three new offers routes (`offers`, `offers/[id]/cart`, `offers/[id]/respond`) and `telegram/link` already had auth-check-first ordering correctly in place — F4 was an isolated regression in one pre-existing route, not a systemic pattern.
- **Secret history**: `git grep` (working tree) and `git log --all -p -S"<value>"` for every known secret shape (service-role key prefix, eSewa secret, Telegram bot token pattern, AWS-key shape, PEM private-key headers) — clean.
- **Live production security headers**: CSP (per-request nonce + `strict-dynamic`), HSTS, X-Frame-Options `DENY`, COOP/CORP, Permissions-Policy — all verified present via `curl -sI` against the running build, unaffected by the Next.js upgrade (set in `src/middleware.ts` and `next.config.mjs`, neither of which needed to change for this).
- **Rate limiting**: Redis-backed counters (confirmed persistent across dev-server restarts — see note in `SECURITY_TEST_RESULTS.md` about clearing test-only buckets) correctly enforce `listing` (12/hr), `signup-ip-hour` (10/hr), `login-account` (8/15min) and the rest of the `LIMITS` table during live testing.

## 5. What could not be tested

- **Automated SAST/DAST/container/IaC scanning** (Semgrep, OWASP ZAP, Trivy, osv-scanner, Checkov) — no tool runtime available in this environment (no Python/pip, no Go, no Docker). Manual code review and `npm audit` substituted; this is a real coverage gap, not a clean bill of health from those specific tool classes. See `SECURITY_HARDENING_CHECKLIST.md` for a recommendation to run these in CI where a Linux runner with those toolchains is available.
- **Production infrastructure/WAF/DNS posture** — this audit only touched the application and its dependencies; Vercel/Cloudflare/DNS configuration was not re-verified (prior audit's `SECURITY.md` §4 already covers recommended WAF rules, not re-tested here).
- **A true external penetration test** — this was a single-agent code/config audit with the repo owner reviewing decisions, not an independent third-party pentest. For a production app handling real payments, an external pentest before or shortly after a major scale-up is still recommended.

## 6. Recommendation

Given the live-payment nature of this app, schedule an independent manual/external penetration test at least annually and before any major payment-flow change, and run the SAST/secret/container scanners this session couldn't (Semgrep + Gitleaks at minimum) in CI on a Linux runner where they're installable — see `SECURITY_HARDENING_CHECKLIST.md`.
