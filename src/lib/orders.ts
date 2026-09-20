/**
 * Shared order query + response shaping. The DB schema uses `total`,
 * `delivery_charge` and `order_items.price`; the UI reads `total_amount`,
 * `order_items[].unit_price` and `order_items[].product`, so map once here.
 */

export const ORDER_SELECT = `
  id, order_number, status, subtotal, delivery_charge, platform_fee, total,
  delivery_method, delivery_address, meeting_location, created_at, updated_at,
  buyer_id, seller_id,
  buyer:profiles!orders_buyer_id_fkey(auth_user_id, full_name, phone, location),
  seller:profiles!orders_seller_id_fkey(auth_user_id, full_name, location, verification_status, profile_photo, seller_rating, seller_review_count),
  order_items(
    id, quantity, price, title, condition, product_id,
    products(id, title, location, original_price, product_images(storage_path, is_primary))
  ),
  payments(id, status, method, amount, created_at),
  deliveries(id, current_status, delivery_events(id, status, description, created_at, actor_type))
`

/** Same as ORDER_SELECT, but joins the buyer as required so a query can filter on `buyer.auth_user_id` in ONE round trip. */
export const ORDER_SELECT_MINE = ORDER_SELECT.replace('buyer:profiles!orders_buyer_id_fkey(', 'buyer:profiles!orders_buyer_id_fkey!inner(')

export const COMPLETED_STATUSES = ['COMPLETED', 'BUYER_CONFIRMED', 'CANCELLED', 'REFUNDED', 'RETURNED']

/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * `viewer` decides what the caller may see. StudentMarket is the mediator: the buyer's phone, address and landmark
 * are NEVER sent to the seller, and the seller's contact details are never sent to the buyer.
 */
export function shapeOrder(order: any, viewer: 'buyer' | 'seller' = 'buyer') {
  const payments: any[] = [...(order.payments ?? [])].sort(
    (a, b) => +new Date(b.created_at) - +new Date(a.created_at)
  )
  const latestPayment = payments[0]
  const delivery = Array.isArray(order.deliveries) ? order.deliveries[0] : order.deliveries

  // auth ids are only used server-side to decide who is asking; they are never sent to the browser
  const noId = (p: any) => (p ? (({ auth_user_id: _drop, ...rest }) => rest)(p) : p)
  order = { ...order, buyer: noId(order.buyer), seller: noId(order.seller) }
  const safe = viewer === 'seller'
    ? { ...order, delivery_address: null, meeting_location: null, buyer: order.buyer ? { full_name: String(order.buyer.full_name ?? 'Buyer').split(' ')[0] } : null }
    : { ...order, seller: order.seller ? { ...order.seller, phone: undefined } : null }
  return {
    ...safe,
    total_amount: Number(order.total),
    delivery_fee: Number(order.delivery_charge ?? 0),
    payment_method: latestPayment?.method ?? null,
    payment_status: latestPayment?.status ?? null,
    order_items: (order.order_items ?? []).map((item: any) => ({
      id: item.id,
      quantity: item.quantity,
      unit_price: Number(item.price),
      product: {
        id: item.products?.id ?? item.product_id,
        title: item.products?.title ?? item.title,
        condition: item.condition,
        location: item.products?.location ?? null,
        original_price: item.products?.original_price ?? null,
        product_images: item.products?.product_images ?? [],
      },
    })),
    delivery: delivery ?? null,
  }
}
