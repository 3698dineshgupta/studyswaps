/**
 * Seller earnings: held → withdrawable. Server-side (service role) ONLY.
 *
 *  1. Buyer pays            → seller's PENDING balance += (item price − 5% commission)
 *  2. Order marked DELIVERED (by StudySwaps) → PENDING → AVAILABLE immediately
 *  3. Seller withdraws from AVAILABLE to eSewa.
 */
import type { SupabaseClient } from '@supabase/supabase-js'
import { commissionFor } from '@/lib/pricing'
import { notify } from '@/lib/notify'

export interface ReleaseOutcome { released: boolean; amount?: number; reason?: string }

const fmt = (n: number) => `Rs. ${n.toLocaleString('en-NP')}`

/** Move one order's held earnings to the seller's available balance (idempotent). */
export async function releaseOrderFunds(admin: SupabaseClient, orderId: string): Promise<ReleaseOutcome> {
  const { data: order } = await admin
    .from('orders')
    .select('id, order_number, seller_id, subtotal')
    .eq('id', orderId)
    .single()
  if (!order) return { released: false, reason: 'order_not_found' }

  // Only orders whose payment was credited can be released, and only once
  const { data: ledger } = await admin
    .from('wallet_ledger')
    .select('transaction_type')
    .eq('order_id', orderId)
    .in('transaction_type', ['SALE_PENDING', 'SALE_RELEASED'])
  const types = new Set((ledger ?? []).map((l) => l.transaction_type))
  if (types.has('SALE_RELEASED')) return { released: false, reason: 'already_released' }
  if (!types.has('SALE_PENDING')) return { released: false, reason: 'not_credited' }

  const subtotal = Number(order.subtotal)
  const net = Math.round((subtotal - commissionFor(subtotal)) * 100) / 100

  const { error } = await admin.rpc('release_pending_to_available', {
    p_seller_id: order.seller_id,
    p_amount: net,
    p_order_id: orderId,
  })
  if (error) {
    console.error('[wallet] release failed:', error.message)
    return { released: false, reason: 'rpc_failed' }
  }

  await admin
    .from('wallet_ledger')
    .update({ reference: `Order ${order.order_number} released`, description: `${fmt(net)} is now available to withdraw` })
    .eq('order_id', orderId)
    .eq('transaction_type', 'SALE_RELEASED')

  await notify(order.seller_id, {
    type: 'PAYMENT_UPDATE',
    title: `${fmt(net)} is ready to withdraw`,
    body: `Earnings from order ${order.order_number} are now in your available balance.`,
    actionUrl: '/dashboard/wallet',
    email: { subject: `${fmt(net)} is ready to withdraw`, cta: 'Open my wallet' },
  })

  return { released: true, amount: net }
}

/**
 * Release for a seller: every order that has been DELIVERED (or confirmed/completed) becomes withdrawable.
 * Called whenever the seller opens their wallet or dashboard, so it also catches up on orders delivered earlier.
 */
export async function releaseDueFunds(admin: SupabaseClient, sellerId: string): Promise<number> {
  const { data: orders } = await admin
    .from('orders')
    .select('id')
    .eq('seller_id', sellerId)
    .in('status', ['DELIVERED', 'BUYER_CONFIRMED', 'COMPLETED'])
    .limit(100)

  let count = 0
  for (const o of orders ?? []) {
    const r = await releaseOrderFunds(admin, o.id)
    if (r.released) count++
  }
  return count
}

/** Kept for callers that show an unlock date: earnings unlock the moment the order is delivered. */
export function releaseDateFor(deliveredAt: string | Date): Date {
  return new Date(deliveredAt)
}
