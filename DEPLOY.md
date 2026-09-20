# Putting StudentMarket live (Vercel + Supabase)

**How it fits together.** One Next.js app does both jobs. The pages (frontend) *and* the `/api/*` routes (backend)
deploy together to **Vercel**. **Supabase** is your database, login and file storage (already live). Nothing else needs a server.

```
Browser ──▶ Vercel (Next.js pages + /api routes) ──▶ Supabase (database, auth)
                       │                             ├▶ Upstash Redis (rate limits)
                       └─────────────────────────────├▶ Cloudinary (photos) · eSewa (payments)
                                                     └▶ Gmail SMTP (emails) · Telegram (alerts)
```

## 0. Before you start
- **Vercel Hobby (free) is for personal, non-commercial projects.** A marketplace that takes payments should use **Vercel Pro** (~$20/month).
- **Pick the Vercel region next to Supabase.** Supabase → Project Settings → Infrastructure shows your region
  (Mumbai → `bom1`, Singapore → `sin1`). Vercel → Project → Settings → Functions → *Function Region*. This is the biggest speed win: every database call otherwise crosses continents.
- Buy a domain (e.g. `studentmarket.com.np` / `.com`). You'll need it for eSewa and emails.

## 1. Put the code on GitHub
The folder is not a git repo yet. In the project folder:
```
git init
git add .
git commit -m "StudentMarket"
```
Create an **empty private repository** on github.com, then run the two commands GitHub shows (`git remote add origin …`, `git push -u origin main`).
`.gitignore` already keeps `.env*` (all your secrets) out of the repo. The demo-data scripts (`scripts/seed*.mjs`) are git-ignored too.

## 2. Create the Vercel project
1. vercel.com → **Add New → Project → Import** your GitHub repo. Framework is detected as Next.js. Leave build settings as they are.
2. **Environment Variables** — add these (copy the values from your `.env.local`; tick Production, Preview, Development):

| Name | Notes |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` | public keys |
| `SUPABASE_SERVICE_ROLE_KEY` | **secret** — server only |
| `NEXT_PUBLIC_APP_URL` | your real address, **must start with `https://`** (turns on secure cookies, HSTS) |
| `NEXT_PUBLIC_APP_NAME` | `StudentMarket` |
| `APP_SECRET` | long random string (signs addresses/tokens) |
| `ESEWA_ENVIRONMENT`, `ESEWA_PRODUCT_CODE`, `ESEWA_SECRET_KEY` | production eSewa merchant values |
| `CLOUDINARY_URL` | product photos |
| `TELEGRAM_BOT_TOKEN`, `TELEGRAM_VERIFICATION_CHAT_ID`, `TELEGRAM_LISTINGS_CHAT_ID`, `TELEGRAM_ADMIN_CHAT_ID` | admin alerts |
| `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`, `EMAIL_FROM` | Gmail app password emails |
| `REDIS_URL` | Upstash `rediss://…` (needed: serverless instances share limits through it) |
| `INTERNAL_SECRET` | optional, 32+ random characters |

3. Click **Deploy**. First build takes ~2–3 minutes. Every later `git push` redeploys automatically.

## 3. Connect your domain
Vercel → Project → **Settings → Domains → Add** your domain → copy the DNS records it shows into your domain registrar.
HTTPS is automatic. Then set `NEXT_PUBLIC_APP_URL` to `https://your-domain` and **Redeploy**.

## 4. Supabase settings (Dashboard)
- **SQL editor:** run `supabase/run-009-010.sql` (008 is already applied).
- **Authentication → URL Configuration:** *Site URL* = your https address; *Redirect URLs* add `https://your-domain/**`.
- **Authentication → Sign In / Providers:** turn **off** "Allow new users to sign up" (our server creates accounts, with limits).
- **Authentication → Attack Protection:** enable **CAPTCHA (Turnstile)**; set minimum password length 10.
- **Database → Backups:** confirm daily backups are on.

## 5. eSewa (real money — do this carefully)
- In your eSewa merchant portal, register the success and failure URLs: `https://your-domain/api/payments/esewa/verify` and `https://your-domain/orders/…`.
- Test with **one small real order** (e.g. Rs. 10 item) end to end: pay → order becomes "Payment confirmed" → seller notified → Telegram alert.

## 6. Clean up before real users arrive
- Delete the demo accounts (`*@studentmarket.test`) in Supabase → Authentication → Users.
- Rotate every secret that was ever pasted into a chat (Supabase keys, eSewa secret, Cloudinary, Telegram bot, Gmail app password, Redis).
- Make yourself admin: `node scripts/make-admin.mjs you@gmail.com` (run locally, it uses your `.env.local`).

## 7. After going live — quick checklist
1. Home page loads, sign up (new account), sign in, sign out.
2. Seller: verify identity → post a listing with 3+ photos → see it in **Admin panel → Listings** → approve → it appears on the marketplace.
3. Buyer: add to cart → checkout → address + map → pay with eSewa.
4. Emails arrive (approval, verification). Telegram alerts arrive.
5. Vercel → **Logs** for errors; Vercel → **Analytics/Speed Insights** for real-user speed (also reported at `/api/vitals`).

## Good to know
- **Photo size:** serverless functions accept ~4.5 MB per request. The app now shrinks photos in the browser (≈300–600 KB) before upload, so phone photos work.
- **Function time limits:** upload and payment routes are set to 30 s.
- **Preview deployments** (every branch) share your env vars — use a separate Supabase project for staging if you test destructive things.
- Don't run `scripts/security/regression.mjs` against the live site: it creates throwaway users in the live database. Run it against a staging copy.
