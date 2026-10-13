# StudySwaps — Incident Response Runbook

This is the standalone incident-response playbook referenced by `SECURITY.md` §6. It assumes the small-team reality of this project: no dedicated security team, one or a few engineers with Supabase/Vercel/eSewa/Telegram/Cloudinary admin access. Fill in the placeholder contacts once they exist; do not block adopting this document on that.

## 1. Severity tiers

| Tier | Definition | Example | Response time |
|---|---|---|---|
| **SEV-1** | Active exploitation with financial loss, mass data exposure, or the site is down/unusable | Wallet funds drained via a privilege-escalation bug; database dumped and posted publicly; site serving malware | Immediate, drop everything |
| **SEV-2** | A real vulnerability confirmed exploitable but not (yet) exploited at scale, or a contained incident affecting a handful of accounts | One user's account compromised via credential stuffing; a newly-discovered IDOR that hasn't been seen exploited in the audit logs | Within hours |
| **SEV-3** | A vulnerability found (e.g. by this kind of audit) with no evidence of exploitation | A dependency CVE with no indication of active use against this app | Scheduled fix, tracked in `SECURITY_HARDENING_CHECKLIST.md` |

## 2. Roles (fill in names/contacts for your team)

| Role | Responsibility | Who |
|---|---|---|
| Incident commander | Owns the decision to contain/communicate/recover; the one person everyone else defers to during a SEV-1 | `[INSERT NAME/CONTACT]` |
| Supabase admin | Can rotate Supabase keys, run SQL, pull `audit_logs`/Postgres logs, trigger a restore | `[INSERT NAME/CONTACT]` |
| Vercel/DNS admin | Can redeploy, roll back a deploy, flip environment variables, change DNS/WAF rules | `[INSERT NAME/CONTACT]` |
| Payments contact | Can reach eSewa support for a disputed/fraudulent transaction, knows the merchant dashboard | `[INSERT NAME/CONTACT]` |
| Communications | Drafts and sends the user-facing notice if one is needed | `[INSERT NAME/CONTACT]` |

For a one-person team, all five roles are the same person — the table still matters because it's the checklist of **what you need access to** before an incident, not during one. Confirm today that whoever holds this responsibility can actually log into Supabase, Vercel, the eSewa merchant portal, and BotFather (Telegram) without needing to recover a password mid-incident.

## 3. Immediate containment — first 15 minutes of any SEV-1/SEV-2

1. **Identify what's actually compromised** before rotating anything — rotating the wrong credential wastes the most critical minutes and can mask what the attacker is doing. Check `audit_logs`, the security log (`level:"security"` JSON lines — events `rate_limited`, `csrf_blocked`, `forbidden`, `admin_action`, `payment_confirmed`, `payment_oversold`, `upload_rejected`), and Supabase's own auth/API logs, filtered by the suspicious `requestId`, IP, or account.
2. **If a secret is confirmed leaked or a privilege-escalation bug is confirmed exploitable right now**: rotate it immediately.
   - Supabase: Project Settings → API → regenerate the service-role key and/or the JWT secret (**regenerating the JWT secret signs every existing user out** — understand that blast radius before doing it; usually you want this only for a confirmed account-takeover-at-scale scenario, not a single leaked key you're rotating defensively).
   - eSewa: rotate the merchant secret via the eSewa merchant portal.
   - Cloudinary: rotate the API secret in the Cloudinary console.
   - Telegram: `/revoke` the bot token via @BotFather, then update `TELEGRAM_BOT_TOKEN` in Vercel env vars and redeploy (the webhook secret derived from `APP_SECRET`/`SUPABASE_SERVICE_ROLE_KEY` — see `src/lib/telegram/link.ts` — also needs re-deriving if its base secret rotates).
   - `APP_SECRET` (if set): rotate, redeploy. This also changes the derived Telegram webhook secret — re-run `node scripts/telegram/set-webhook.mjs` afterward so Telegram is told the new secret.
3. **If the exploit is a live bug in the app itself** (not a leaked credential): the fastest safe containment is usually a Vercel rollback to the last known-good deployment, not a hotfix under pressure. Roll back first, fix calmly after.
4. **If financial (wallet/payment) logic is involved**: pause withdrawals immediately — leave any `REQUESTED` withdrawal rows untouched (don't pay them) until the investigation (§4) is done. Do not attempt to claw back or manually adjust `wallet_ledger`/`payments` rows without a clear, reviewed plan; these are financial records and manual edits without a plan are how a contained incident becomes an unrecoverable accounting mess.
5. **If the site needs to come down entirely**: Vercel → set a maintenance redirect, or temporarily restrict the domain via your DNS/WAF provider's "under attack" mode (Cloudflare has a one-click version of this per `SECURITY.md` §4, if configured).

## 4. Investigation

- **`audit_logs` table**: who did what, when, from what IP/user agent, with old/new data — this is the primary forensic source for anything that went through an audited action (admin actions, order status changes, listing changes).
- **Security log** (stdout JSON lines, `level:"security"`): rate-limit hits, CSRF blocks, forbidden-access attempts, upload rejections — grep by `requestId` or IP to reconstruct a session's full request sequence. Wherever this is shipped (a log platform, or just Vercel's own function logs if nothing else is wired up), that's where to pull it from.
- **Supabase Auth logs**: failed logins, password resets, new-device sign-ins for the affected account(s).
- **`payments`/`wallet_ledger`/`withdrawals` tables**: for anything financial, reconstruct the exact sequence of state transitions for the affected order(s)/account(s) before touching anything.
- **Git history / Vercel deployment history**: if the root cause is a code regression (as two of this session's findings were — F4, F5), find exactly which deploy introduced it and how long it was live, so you know the true exposure window.

## 5. Specific playbooks

### 5a. Suspected account takeover (credential stuffing, session theft)
1. Confirm via Supabase Auth logs (new IP/device, failed-then-succeeded login pattern).
2. Force sign-out for that specific user if possible (Supabase doesn't have a simple per-user "kill all sessions" button outside of a JWT-secret rotation, which signs out *everyone* — for a single account, change their password via the admin API instead, which invalidates their refresh tokens).
3. Check `audit_logs` for anything that account did after the suspected takeover point — orders placed, listings edited, withdrawal requests, profile changes.
4. If a withdrawal was requested during the compromised window, pause/cancel it before it's paid.
5. Notify the affected user; recommend they change their password everywhere they reused it.

### 5b. Suspected payment/financial-logic exploit
1. Pause withdrawals (leave `REQUESTED` rows unpaid) immediately.
2. Pull every `payments`/`orders`/`wallet_ledger` row touched by the suspected exploit path; reconstruct the exact sequence.
3. Cross-check against eSewa's own transaction log in the merchant portal — the app's record and eSewa's record should agree; a mismatch is itself evidence of what happened.
4. Do not refund or adjust balances until the root cause and full blast radius are understood — a premature "fix" can make the forensic trail harder to read and can double-correct an already-correct balance.
5. Write the regression test for the exploited path into `scripts/security/regression.mjs` (or a new dedicated script) before considering the incident closed, per this project's established practice (every fix in `SECURITY_FIXES.md` this session came with a corresponding test).

### 5c. Suspected data exposure (RLS bypass, leaked backup, leaked key)
1. Identify exactly what table(s)/column(s) were exposed and to whom (public anon key? a specific leaked service-role key? a specific user's own session reading data that should have been row-scoped away from them?).
2. If a **key** leaked: rotate it (§3.2) and check Supabase/Cloudinary/Vercel access logs for the window it was live, if available.
3. If it's an **RLS/column-grant bug**: the fix is a migration (see `SECURITY.md` §2 for the pattern this project already uses — `supabase/run-0XX-*.sql` files, applied by the repo owner in the Supabase SQL editor, then verified with `scripts/security/regression.mjs`'s `D*` checks using a **real per-user session**, never the service-role client, so the test actually proves the fix).
4. Determine whether the exposure requires user notification. In Nepal there isn't yet a GDPR-equivalent statutory breach-notification deadline as of this writing, but exposed PII (phone numbers, addresses, ID-document photos) warrants proactively telling affected users regardless of what's legally required — this is a trust product for students, and the right call here is the conservative one.

### 5d. Suspected DoS / availability incident
1. Check whether it's volumetric (one IP or a small set hammering the site — the rate limiter and/or WAF should already be containing this; verify the `rate_limited` security-log events are firing) or logic-based (a single expensive request, like an unbounded decompression-bomb upload or an unbounded search query — both of which were specifically hardened against in this and the prior audit, see F3 and `SECURITY.md` S10/S19).
2. If volumetric and the WAF/edge isn't containing it, escalate to "under attack" mode (§3.5) while investigating.
3. If logic-based, identify the specific endpoint and request shape, add/verify input bounds, write a regression test, deploy the fix, then stand down the emergency containment.

## 6. Recovery

1. Confirm root cause is actually fixed — re-run the relevant regression suite(s) against the fixed build before considering it closed, exactly as `SECURITY_TEST_RESULTS.md` documents for this session's own findings.
2. If data was altered incorrectly, restore from backup (Supabase daily backups / PITR on Pro — confirmed as an open checklist item in `SECURITY_HARDENING_CHECKLIST.md` to actually turn on and test) rather than trying to manually reconstruct correct state.
3. If buyers were financially affected (overcharged, double-charged, didn't receive a paid-for item due to the incident), refund via eSewa's merchant portal proactively rather than waiting for a complaint.
4. Resume any paused functionality (withdrawals, etc.) only after confirming the specific exploited path is closed.

## 7. Communication

- **Internal**: a short, timestamped incident log (what happened, when noticed, what was done, by whom) — even a plain text file or a pinned doc is enough for a team this size; the important thing is that it exists and is written *during* the incident, not reconstructed from memory afterward.
- **External (affected users)**: plain language, what happened, what data/money was or wasn't affected, what you've done about it, what they should do (e.g. "change your password"). Do not speculate about scope beyond what's actually confirmed; do not over-promise a timeline you haven't verified you can hit.
- **Do not** post technical exploit details publicly while the issue could still be actively exploited elsewhere (e.g. an unpatched dependency CVE affecting other sites too) — coordinate disclosure timing with the fix.

## 8. Post-mortem

Within a few days of any SEV-1/SEV-2 being closed: write a short post-mortem (what happened, root cause, what caught it or how it was found, what was fixed, what regression test now guards against it, what — if anything — should change about how incidents are detected sooner next time). Add any new, generally-applicable lesson to `SECURITY.md`'s findings table or this runbook, the same way this session's findings (F1–F5) were folded into the living documents rather than left as one-off chat output.

## 9. Pre-incident checklist (do this now, not during an incident)

- [ ] Confirm whoever holds the incident-commander role today can actually log into Supabase, Vercel, the eSewa merchant portal, and BotFather without a password-recovery delay.
- [ ] Confirm Supabase backups are actually turned on (open item in `SECURITY_HARDENING_CHECKLIST.md` as of this audit).
- [ ] Confirm the security log (stdout JSON lines) is actually being captured somewhere durable and searchable, not just scrolling past in an ephemeral Vercel function log that expires.
- [ ] Know, right now, where `scripts/security/*.mjs` live and that they still run (`node scripts/security/regression.mjs <baseUrl>`) — these are your fastest way to confirm a fix actually closed the gap during a live incident, not just in theory.
