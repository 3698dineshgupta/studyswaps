/**
 * Admin order operations (service role). One place, so orders, disputes and refunds behave the same.
 */
import { notify } from '@/lib/notify'
import { releaseOrderFunds } from '@/lib/wallet/release'
import { TelegramService } from '@/lib/telegram/service'
import type { AdminContext } from '@/lib/admin/guard'

/** Statuses an admin may set by hand. Payment confirmation is deliberately NOT here: only eSewa verification can do that. */
export const ADMIN_SETTABLE = [
  'SELLER_NOTIFIED', 'SELLER_ACCEPTED', 'PACKING', 'READY_FOR_PICKUP', 'PICKED_UP', 'IN_TRANSIT', 'OUT_FOR_DELIVERY',
  'DELIVERED', 'BUYER_CONFIRMED', 'COMPLETED', 'CANCELLED', 'RETURN_REQUESTED', 'RETURN_APPROVED', 'RETURNED', 'REFUNDED', 'DISPUTED',
] as const
export type AdminOrderStatus = (typeof ADMIN_SETTABLE)[number]

const GIVES_MONEY_BACK: string[] = ['CANCELLED', 'REFUNDED', 'RETURNED']

const LABEL: Record<string, string> = {
  SELLER_ACCEPTED: 'accepted by the seller', PACKING: 'being packed', READY_FOR_PICKUP: 'ready for collection', PICKED_UP: 'collected',
  IN_TRANSIT: 'on the way', OUT_FOR_DELIVERY: 'out for delivery', DELIVERED: 'delivered', BUYER_CONFIRMED: 'confirmed', COMPLETED: 'completed',
  CANCELLED: 'cancelled', REFUNDED: 'refunded', RETURNED: 'returned', DISPUTED: 'under review', RETURN_REQUESTED: 'return requested', RETURN_APPROVED: 'return approved', SELLER_NOTIFIED: 'sent to the seller',
}

export async function adminSetOrderStatus(ctx: AdminContext, orderId: string, status: AdminOrderStatus, note?: string) {
  const { admin, profile } = ctx
  const { data: order } = await admin.from('orders').select('id, order_number, status, total, buyer_id, seller_id').eq('id', orderId).maybeSingle()
  if (!order) return { ok: false as const, code: 404, error: 'Order not found' }
  if (['CREATED', 'PAYMENT_PENDING'].includes(order.status)) {
    return { ok: false as const, code: 409, error: 'This order has not been paid yet. Wait for payment (or let it expire).' }
  }
  if (order.status === status) return { ok: false as const, code: 409, error: 'The order already has that status' }

  const { data: paid } = await admin.from('payments').select('id').eq('order_id', orderId).eq('status', 'CONFIRMED').limit(1)
  const wasPaid = !!paid?.length

  const { data: moved } = await admin.from('orders').update({ status }).eq('id', orderId).eq('status', order.status).select('id')
  if (!moved?.length) return { ok: false as const, code: 409, error: 'The order changed while you were working. Refresh and try again.' }

  // Delivery timeline
  const { data: delivery } = await admin.from('deliveries').update({ current_status: status }).eq('order_id', orderId).select('id').maybeSingle()
  if (delivery) {
    await admin.from('delivery_events').insert({ delivery_id: delivery.id, status, description: note || `Updated by StudentMarket: ${LABEL[status] ?? status}`, actor_id: profile.id, actor_type: 'admin' })
  }

  let refundNeeded = false
  if (GIVES_MONEY_BACK.includes(status) && wasPaid) {
    refundNeeded = true
    const { error } = await admin.rpc('reverse_order_earnings', { p_order_id: orderId })
    if (error) console.error('[admin] reverse earnings failed (run migration 009):', error.message)
    // The item goes back on sale
    const { data: items } = await admin.from('order_items').select('product_id, quantity').eq('order_id', orderId)
    for (const it of items ?? []) {
      const { data: p } = await admin.from('products').select('quantity, status').eq('id', it.product_id).single()
      if (p) await admin.from('products').update({ quantity: Number(p.quantity ?? 0) + Number(it.quantity ?? 1), ...(p.status === 'SOLD' ? { status: 'ACTIVE' } : {}) }).eq('id', it.product_id)
    }
  }
  if ((status === 'DELIVERED' || status === 'BUYER_CONFIRMED' || status === 'COMPLETED') && wasPaid) await releaseOrderFunds(admin, orderId)

  const words = LABEL[status] ?? status.toLowerCase()
  await Promise.all([
    notify(order.buyer_id, { type: 'ORDER_UPDATE', title: `Order ${order.order_number} ${words}`, body: refundNeeded ? `Your order was ${words}. Your refund of Rs. ${Number(order.total).toLocaleString()} goes back to your eSewa.` : `Your order is now ${words}.`, actionUrl: `/orders/${orderId}` }),
    notify(order.seller_id, { type: 'ORDER_UPDATE', title: `Order ${order.order_number} ${words}`, body: `StudentMarket updated this order: ${words}.${note ? ` ${note}` : ''}`, actionUrl: '/dashboard/orders' }),
  ])
  if (refundNeeded) {
    TelegramService.sendAdminNotification(`REFUND REQUIRED\nOrder: ${order.order_number}\nAmount: Rs. ${order.total}\nStatus: ${status}\nBy: ${profile.full_name ?? 'admin'}\nSend the refund through eSewa, then note it in the order.`).catch(() => {})
  }
  return { ok: true as const, refundNeeded, from: order.status, orderNumber: order.order_number as string }
}
