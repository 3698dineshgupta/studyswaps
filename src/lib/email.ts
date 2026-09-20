/**
 * Transactional email — server-side only. Never throws: a failed email must not break the action that triggered it.
 *
 * Configure ONE of:
 *   • Resend  (https://resend.com):  RESEND_API_KEY  + EMAIL_FROM
 *   • Any SMTP (Gmail app password, Brevo, Mailgun …):  SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS + EMAIL_FROM
 * With neither, emails are skipped (a one-line notice is logged) and the app works exactly as before.
 */
import { APP_URL, APP_NAME } from '@/lib/constants'

export interface EmailMessage {
  to: string
  subject: string
  html: string
  text: string
}

const esc = (v: string) => v.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;')
const oneLine = (v: string, max = 150) => v.replace(/[\r\n]+/g, ' ').trim().slice(0, max) // no header injection via subjects

export function emailConfigured(): boolean {
  return !!(process.env.RESEND_API_KEY || process.env.SMTP_HOST)
}

/** A simple branded email. All dynamic text is HTML-escaped. */
export function renderEmail(o: { name?: string | null; title: string; body: string; ctaLabel?: string; ctaPath?: string }): { html: string; text: string } {
  const url = o.ctaPath ? (/^https?:\/\//.test(o.ctaPath) ? o.ctaPath : `${APP_URL}${o.ctaPath.startsWith('/') ? '' : '/'}${o.ctaPath}`) : null
  const hi = o.name ? `Hi ${esc(String(o.name).split(' ')[0])},` : 'Hi,'
  const html = `<!doctype html><html><body style="margin:0;background:#f6f7f4;font-family:Segoe UI,Helvetica,Arial,sans-serif;color:#14171c">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f6f7f4;padding:24px 12px"><tr><td align="center">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;background:#ffffff;border-radius:16px;overflow:hidden;border:1px solid #e6e8e3">
<tr><td style="background:#16a34a;padding:18px 24px;color:#ffffff;font-size:18px;font-weight:700">${esc(APP_NAME)}</td></tr>
<tr><td style="padding:28px 24px 8px"><p style="margin:0 0 6px;color:#6b7280;font-size:14px">${hi}</p>
<h1 style="margin:0 0 12px;font-size:22px;line-height:1.25">${esc(o.title)}</h1>
<p style="margin:0;font-size:15px;line-height:1.6;color:#374151">${esc(o.body).replace(/\n/g, '<br>')}</p></td></tr>
${url ? `<tr><td style="padding:20px 24px 8px"><a href="${esc(url)}" style="display:inline-block;background:#16a34a;color:#ffffff;text-decoration:none;font-weight:700;font-size:15px;padding:12px 24px;border-radius:999px">${esc(o.ctaLabel ?? 'Open')}</a></td></tr>` : ''}
<tr><td style="padding:24px;font-size:12px;color:#9ca3af;line-height:1.5">You are receiving this because you have an account on ${esc(APP_NAME)}. We never ask for your password or payment PIN by email.</td></tr>
</table></td></tr></table></body></html>`
  const text = `${o.name ? `Hi ${String(o.name).split(' ')[0]},` : 'Hi,'}\n\n${o.title}\n\n${o.body}\n${url ? `\n${o.ctaLabel ?? 'Open'}: ${url}\n` : ''}\n— ${APP_NAME}`
  return { html, text }
}

export async function sendEmail(msg: EmailMessage): Promise<boolean> {
  const from = process.env.EMAIL_FROM || `${APP_NAME} <no-reply@localhost>`
  const subject = oneLine(msg.subject)
  try {
    if (process.env.RESEND_API_KEY) {
      const res = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: { Authorization: `Bearer ${process.env.RESEND_API_KEY}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ from, to: [msg.to], subject, html: msg.html, text: msg.text }),
        signal: AbortSignal.timeout(10000),
      })
      if (!res.ok) throw new Error(`Resend ${res.status}`)
      return true
    }
    if (process.env.SMTP_HOST) {
      const nodemailer = (await import('nodemailer')).default
      const port = Number(process.env.SMTP_PORT || 587)
      const transport = nodemailer.createTransport({
        host: process.env.SMTP_HOST, port, secure: port === 465,
        auth: process.env.SMTP_USER ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS } : undefined,
        connectionTimeout: 10000, greetingTimeout: 10000, socketTimeout: 15000,
      })
      await transport.sendMail({ from, to: msg.to, subject, html: msg.html, text: msg.text })
      return true
    }
    console.warn('[email] not configured — set RESEND_API_KEY or SMTP_HOST to send emails')
    return false
  } catch (e) {
    console.error('[email] send failed:', e instanceof Error ? e.message : 'unknown')
    return false
  }
}
