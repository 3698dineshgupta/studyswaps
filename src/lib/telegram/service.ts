/**
 * TelegramService — Server-side ONLY
 * NEVER import this in browser/client components.
 * BOT TOKEN must never reach the browser.
 */

import { createAdminClient } from '@/lib/supabase/admin'

const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN
const VERIFICATION_CHAT_ID = process.env.TELEGRAM_VERIFICATION_CHAT_ID
const LISTINGS_CHAT_ID = process.env.TELEGRAM_LISTINGS_CHAT_ID
const ADMIN_CHAT_ID = process.env.TELEGRAM_ADMIN_CHAT_ID

const TELEGRAM_API_BASE = `https://api.telegram.org/bot${BOT_TOKEN}`

interface TelegramResult {
  ok: boolean
  messageId?: number
  fileId?: string
  error?: string
}

async function sendTelegramMessage(chatId: string, text: string): Promise<TelegramResult> {
  if (!BOT_TOKEN || !chatId) {
    return { ok: false, error: 'Telegram not configured' }
  }

  try {
    const post = async (parseMode?: 'Markdown') => {
      const res = await fetch(`${TELEGRAM_API_BASE}/sendMessage`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ chat_id: chatId, text, ...(parseMode && { parse_mode: parseMode }) }),
        signal: AbortSignal.timeout(10000),
      })
      return res.json()
    }

    let data = await post('Markdown')

    // Names/titles with stray _ or * make Telegram reject Markdown — resend as plain text
    if (!data.ok && /can't parse entities/i.test(String(data.description))) {
      data = await post()
    }

    if (!data.ok) {
      return { ok: false, error: data.description }
    }

    return { ok: true, messageId: data.result.message_id }
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : 'Unknown error' }
  }
}

async function sendTelegramDocument(
  chatId: string,
  fileBuffer: Buffer,
  filename: string,
  caption?: string
): Promise<TelegramResult> {
  if (!BOT_TOKEN || !chatId) {
    return { ok: false, error: 'Telegram not configured' }
  }

  try {
    const formData = new FormData()
    formData.append('chat_id', chatId)
    formData.append('document', new Blob([new Uint8Array(fileBuffer)]), filename)
    if (caption) formData.append('caption', caption)

    const res = await fetch(`${TELEGRAM_API_BASE}/sendDocument`, {
      method: 'POST',
      body: formData,
      signal: AbortSignal.timeout(30000),
    })

    const data = await res.json()

    if (!data.ok) {
      return { ok: false, error: data.description }
    }

    return {
      ok: true,
      messageId: data.result.message_id,
      fileId: data.result.document?.file_id,
    }
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : 'Unknown error' }
  }
}

async function sendTelegramPhoto(
  chatId: string,
  fileBuffer: Buffer,
  filename: string,
  caption?: string
): Promise<TelegramResult> {
  if (!BOT_TOKEN || !chatId) {
    return { ok: false, error: 'Telegram not configured' }
  }

  try {
    const formData = new FormData()
    formData.append('chat_id', chatId)
    formData.append('photo', new Blob([new Uint8Array(fileBuffer)]), filename)
    if (caption) formData.append('caption', caption)

    const res = await fetch(`${TELEGRAM_API_BASE}/sendPhoto`, {
      method: 'POST',
      body: formData,
      signal: AbortSignal.timeout(30000),
    })

    const data = await res.json()

    if (!data.ok) {
      return { ok: false, error: data.description }
    }

    return {
      ok: true,
      messageId: data.result.message_id,
      fileId: data.result.photo?.[0]?.file_id,
    }
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : 'Unknown error' }
  }
}

// ============================================================
// PUBLIC API
// ============================================================

export async function archiveVerification(params: {
  verificationId: string
  verificationNumber: string
  fullName: string
  college: string
  method: string
  studentId: string
  submittedAt: string
}): Promise<TelegramResult> {
  if (!VERIFICATION_CHAT_ID) {
    return { ok: false, error: 'Verification chat not configured' }
  }

  const message = `
🎓 *NEW STUDENT VERIFICATION*

*Verification ID:* \`${params.verificationNumber}\`
*Student:* ${params.fullName}
*College:* ${params.college}
*Student ID:* ${params.studentId}
*Method:* ${params.method}
*Submitted:* ${params.submittedAt}
*Status:* PENDING

_Review via admin dashboard_
`

  const result = await sendTelegramMessage(VERIFICATION_CHAT_ID, message)

  // Update Supabase with Telegram reference
  if (result.ok && result.messageId) {
    const admin = createAdminClient()
    await admin
      .from('verification_requests')
      .update({
        telegram_message_id: result.messageId.toString(),
        telegram_chat_id: VERIFICATION_CHAT_ID,
        telegram_sync_status: 'SENT',
      })
      .eq('id', params.verificationId)
  }

  return result
}

export async function archiveListing(params: {
  listingId: string
  listingNumber: string
  sellerName: string
  sellerId: string
  college: string
  title: string
  category: string
  condition: string
  price: number
  location: string
  isNegotiable: boolean
  description?: string
}): Promise<TelegramResult> {
  if (!LISTINGS_CHAT_ID) {
    return { ok: false, error: 'Listings chat not configured' }
  }

  const message = `
🏷 *NEW SELLER LISTING*

*Listing ID:* \`${params.listingNumber}\`
*Seller:* ${params.sellerName}
*College:* ${params.college}

*Product:* ${params.title}
*Category:* ${params.category}
*Condition:* ${params.condition}
*Price:* Rs. ${params.price.toLocaleString()}
*Negotiable:* ${params.isNegotiable ? 'Yes' : 'No'}
*Location:* ${params.location}

${params.description ? `*Description:*\n${params.description.slice(0, 200)}` : ''}

*Status:* PENDING_REVIEW - waiting for admin approval
*Review:* ${process.env.NEXT_PUBLIC_APP_URL || ''}/admin/listings
`

  const result = await sendTelegramMessage(LISTINGS_CHAT_ID, message)

  if (result.ok && result.messageId) {
    const admin = createAdminClient()
    await admin
      .from('products')
      .update({
        telegram_message_id: result.messageId.toString(),
        telegram_chat_id: LISTINGS_CHAT_ID,
        telegram_sync_status: 'SENT',
      })
      .eq('id', params.listingId)
  }

  return result
}

export async function sendAdminNotification(message: string): Promise<TelegramResult> {
  if (!ADMIN_CHAT_ID) {
    return { ok: false, error: 'Admin chat not configured' }
  }
  return sendTelegramMessage(ADMIN_CHAT_ID, message)
}

export async function sendPaymentAlert(params: {
  orderNumber: string
  buyerName: string
  sellerName: string
  amount: number
  method: string
  status: string
}): Promise<TelegramResult> {
  const message = `
💰 *PAYMENT ALERT*

*Order:* \`${params.orderNumber}\`
*Buyer:* ${params.buyerName}
*Seller:* ${params.sellerName}
*Amount:* Rs. ${params.amount.toLocaleString()}
*Method:* ${params.method}
*Status:* ${params.status}
`
  return sendAdminNotification(message)
}

export async function sendSecurityAlert(message: string): Promise<TelegramResult> {
  const alertMsg = `🚨 *SECURITY ALERT*\n\n${message}`
  return sendAdminNotification(alertMsg)
}

export async function retryFailedSyncJobs(): Promise<void> {
  const admin = createAdminClient()
  const now = new Date().toISOString()

  const { data: jobs } = await admin
    .from('telegram_sync_jobs')
    .select('*')
    .in('status', ['PENDING', 'FAILED', 'RETRYING'])
    .lte('next_retry_at', now)
    .lt('attempts', 5)
    .limit(10)

  if (!jobs || jobs.length === 0) return

  for (const job of jobs) {
    await admin
      .from('telegram_sync_jobs')
      .update({
        status: 'RETRYING',
        attempts: job.attempts + 1,
        updated_at: now,
      })
      .eq('id', job.id)

    // Process job based on entity_type
    let result: TelegramResult = { ok: false, error: 'Unknown entity type' }

    if (job.entity_type === 'verification') {
      const { data: ver } = await admin
        .from('verification_requests')
        .select('*, profiles(*)')
        .eq('id', job.entity_id)
        .single()

      if (ver) {
        result = await archiveVerification({
          verificationId: ver.id,
          verificationNumber: ver.verification_number,
          fullName: ver.full_name,
          college: ver.college_name,
          method: ver.method,
          studentId: ver.student_id,
          submittedAt: ver.submitted_at,
        })
      }
    }

    if (result.ok) {
      await admin
        .from('telegram_sync_jobs')
        .update({
          status: 'SENT',
          completed_at: now,
          updated_at: now,
        })
        .eq('id', job.id)
    } else {
      const nextRetry = new Date(Date.now() + Math.pow(2, job.attempts + 1) * 60000).toISOString()
      await admin
        .from('telegram_sync_jobs')
        .update({
          status: job.attempts >= 4 ? 'FAILED' : 'RETRYING',
          last_error: result.error,
          next_retry_at: nextRetry,
          updated_at: now,
        })
        .eq('id', job.id)
    }
  }
}

export async function queueTelegramSync(
  entityType: string,
  entityId: string,
  operation: string
): Promise<void> {
  const admin = createAdminClient()
  await admin.from('telegram_sync_jobs').insert({
    entity_type: entityType,
    entity_id: entityId,
    operation,
    status: 'PENDING',
    attempts: 0,
    next_retry_at: new Date().toISOString(),
  })
}

export const TelegramService = {
  archiveVerification,
  archiveListing,
  sendAdminNotification,
  sendPaymentAlert,
  sendSecurityAlert,
  retryFailedSyncJobs,
  queueTelegramSync,
}
