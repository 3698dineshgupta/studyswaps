/**
 * One-time setup: tells Telegram where to send updates for your bot (so personal "Connect Telegram"
 * notifications work). Run it again whenever your site's URL changes (e.g. after connecting a custom domain).
 *
 *   node scripts/telegram/set-webhook.mjs
 *
 * Reads TELEGRAM_BOT_TOKEN, APP_SECRET and the site URL from .env.local.
 */
import fs from 'node:fs'
import { createHash } from 'node:crypto'

const env = Object.fromEntries(fs.readFileSync('.env.local', 'utf8').split(/\r?\n/).filter((l) => /^[A-Z_]+=/.test(l)).map((l) => [l.slice(0, l.indexOf('=')), l.slice(l.indexOf('=') + 1)]))
const token = env.TELEGRAM_BOT_TOKEN
if (!token) { console.error('TELEGRAM_BOT_TOKEN is not set in .env.local'); process.exit(1) }

const siteUrl = (env.NEXT_PUBLIC_APP_URL || '').replace(/\/+$/, '')
if (!siteUrl || /localhost|127\.0\.0\.1/.test(siteUrl)) {
  console.error('NEXT_PUBLIC_APP_URL must be your real, public https:// address (Telegram cannot reach localhost).')
  console.error('Set it in .env.local to your Vercel/production URL, or run this against production by passing it directly:')
  console.error('  SITE_URL=https://studyswaps.com node scripts/telegram/set-webhook.mjs')
  if (!process.env.SITE_URL) process.exit(1)
}
const url = `${(process.env.SITE_URL || siteUrl).replace(/\/+$/, '')}/api/telegram/webhook`

const base = env.APP_SECRET || env.SUPABASE_SERVICE_ROLE_KEY || ''
const secretToken = createHash('sha256').update(`${base}:telegram-webhook`).digest('hex')

const res = await fetch(`https://api.telegram.org/bot${token}/setWebhook`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ url, secret_token: secretToken, allowed_updates: ['message'] }),
})
const data = await res.json()
if (!data.ok) { console.error('Telegram rejected the webhook:', data.description); process.exit(1) }
console.log(`Webhook set to ${url}`)
console.log('Personal Telegram notifications are live. Test it from Profile → Notifications → Connect Telegram.')
