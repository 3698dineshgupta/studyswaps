/**
 * Starts (or resumes) an eSewa payment for an order — server-side ONLY, service-role writes.
 *
 * Shared by two callers so there is exactly one place this logic lives:
 *   - POST /api/orders inlines it right after creating a new order, so the browser gets the signed
 *     eSewa form in the SAME response instead of a second round trip (this was the slow part the
 *     "Pay with eSewa" button was waiting on — one fewer full request, auth check and DB round trips).
 *   - POST /api/payments/esewa/initiate still exists on its own for "Pay now" on an order that was
 *     already created earlier (the order detail page, after a cancelled or abandoned attempt).
 */
import type { SupabaseClient } from '@supabase/supabase-js'
import { ESewaService, type EsewaFormPayload } from '@/lib/esewa/service'
import { APP_URL } from '@/lib/constants'

export interface PayableOrder {
  id: string
  order_number: string
  subtotal: number | string
  delivery_charge: number | string
  platform_fee: number | string
  total: number | string
}

export async function startEsewaPaymentForOrder(admin: SupabaseClient, order: PayableOrder): Promise<EsewaFormPayload> {
  // Reuse an open payment attempt so retries don't create duplicates
  const { data: existing } = await admin
    .from('payments')
    .select('id, esewa_transaction_uuid')
    .eq('order_id', order.id)
    .eq('method', 'ESEWA')
    .eq('status', 'PENDING')
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  let transactionUuid = existing?.esewa_transaction_uuid as string | undefined

  if (!transactionUuid) {
    // eSewa only accepts alphanumerics and hyphens in transaction_uuid
    transactionUuid = `${order.order_number}-${Date.now()}`

    const { error: paymentError } = await admin.from('payments').insert({
      order_id: order.id,
      method: 'ESEWA',
      status: 'PENDING',
      amount: order.total,
      esewa_transaction_uuid: transactionUuid,
      esewa_product_code: process.env.ESEWA_PRODUCT_CODE || 'EPAYTEST',
    })
    if (paymentError) throw paymentError

    await admin.from('orders').update({ status: 'PAYMENT_PENDING' }).eq('id', order.id)
  }

  return ESewaService.generatePaymentForm({
    amount: Number(order.subtotal),
    serviceCharge: Number(order.platform_fee ?? 0),
    deliveryCharge: Number(order.delivery_charge ?? 0),
    transactionUuid,
    // eSewa appends `?data=...` itself, so these must not carry a query string
    successUrl: `${APP_URL}/api/payments/esewa/verify`,
    failureUrl: `${APP_URL}/orders/${order.id}`,
  })
}
