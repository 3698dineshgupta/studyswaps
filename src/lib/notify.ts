/**
 * Creates in-app notifications (server-side, service role). Never throws: a failed
 * notification must not break the order / payment / review action that triggered it.
 */
import { createAdminClient } from '@/lib/supabase/admin'
import { renderEmail, sendEmail } from '@/lib/email'

export type NotificationType =
  | 'VERIFICATION_STATUS' | 'ORDER_UPDATE' | 'PAYMENT_UPDATE' | 'DELIVERY_UPDATE' | 'NEW_MESSAGE'
  | 'WITHDRAWAL_UPDATE' | 'DISPUTE_UPDATE' | 'LISTING_STATUS' | 'REVIEW_RECEIVED' | 'SYSTEM'

export async function notify(profileId: string, n: { type: NotificationType; title: string; body: string; actionUrl?: string; data?: Record<string, unknown>; /** also send this as an email */ email?: { subject?: string; cta?: string } }) {
  try {
    const db = createAdminClient()
    await db.from('notifications').insert({
      profile_id: profileId,
      type: n.type,
      title: n.title,
      body: n.body,
      action_url: n.actionUrl ?? null,
      data: n.data ?? null,
    })
    if (n.email) {
      const { data: p } = await db.from('profiles').select('full_name, auth_user_id').eq('id', profileId).maybeSingle()
      const { data: u } = p ? await db.auth.admin.getUserById(p.auth_user_id) : { data: null }
      const to = u?.user?.email
      if (to) {
        const { html, text } = renderEmail({ name: p?.full_name, title: n.title, body: n.body, ctaLabel: n.email.cta, ctaPath: n.actionUrl })
        await sendEmail({ to, subject: n.email.subject ?? n.title, html, text })
      }
    }
  } catch (e) {
    console.error('[notify] failed:', e instanceof Error ? e.message : 'unknown')
  }
}
