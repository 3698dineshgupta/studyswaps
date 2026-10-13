/**
 * Linking a seller/buyer's own Telegram account for personal notifications — server-side ONLY.
 *
 * Telegram will not let a bot message someone who hasn't started a chat with it, so linking works like this:
 *  1. We generate a short-lived code and store it on the profile (`/api/telegram/link`).
 *  2. The person opens https://t.me/<bot>?start=<code> and taps Start.
 *  3. Telegram calls our webhook with that chat's id; we look the code up and save the chat id on the profile.
 * From then on, `notify()` sends that profile a Telegram message for every notification, alongside email.
 */
import { createHash, randomInt } from 'crypto'

const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN
const TELEGRAM_API_BASE = `https://api.telegram.org/bot${BOT_TOKEN}`

export const LINK_CODE_TTL_MS = 10 * 60 * 1000 // 10 minutes — plenty of time to switch to the Telegram app

/** A short, easy-to-type code (Telegram's /start payload must be plain text, no spaces). */
export function generateLinkCode(): string {
  return Array.from({ length: 8 }, () => '23456789ABCDEFGHJKLMNPQRSTUVWXYZ'[randomInt(32)]).join('')
}

/** Verifies the `X-Telegram-Bot-Api-Secret-Token` header Telegram sends with every webhook call. */
export function webhookSecretToken(): string {
  const base = process.env.APP_SECRET || process.env.SUPABASE_SERVICE_ROLE_KEY || ''
  return createHash('sha256').update(`${base}:telegram-webhook`).digest('hex')
}

let cachedUsername: string | null = null
/** The bot's own @username, fetched once and cached — used to build the t.me deep link. */
export async function getBotUsername(): Promise<string | null> {
  if (cachedUsername) return cachedUsername
  if (!BOT_TOKEN) return null
  try {
    const res = await fetch(`${TELEGRAM_API_BASE}/getMe`, { signal: AbortSignal.timeout(8000) })
    const data = await res.json()
    if (data.ok && data.result?.username) {
      cachedUsername = data.result.username as string
      return cachedUsername
    }
  } catch { /* network hiccup — caller shows "try again" */ }
  return null
}

export function telegramConfigured(): boolean {
  return !!BOT_TOKEN
}
