// ============================================================
// STUDENTMARKET — Application Constants
// ============================================================

export const APP_NAME = process.env.NEXT_PUBLIC_APP_NAME || 'StudySwaps'
export const APP_URL = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'
export const APP_TAGLINE = 'Buy • Sell • Reuse • Study'

export const PLATFORM_FEE_PERCENT = 0 // 0% for now (student friendly)
export const ESEWA_ENVIRONMENT = process.env.ESEWA_ENVIRONMENT || 'sandbox'

export const ESEWA_URLS = {
  sandbox: 'https://rc-epay.esewa.com.np/api/epay/main/v2/form',
  production: 'https://epay.esewa.com.np/api/epay/main/v2/form',
}

export const ESEWA_VERIFY_URLS = {
  sandbox: 'https://rc.esewa.com.np/api/epay/transaction/status/',
  production: 'https://esewa.com.np/api/epay/transaction/status/',
}

export const PRODUCT_CONDITIONS = [
  { value: 'NEW', label: 'New', color: 'bg-blue-100 text-blue-800' },
  { value: 'LIKE_NEW', label: 'Like New', color: 'bg-green-100 text-green-800' },
  { value: 'GOOD', label: 'Good', color: 'bg-emerald-100 text-emerald-800' },
  { value: 'FAIR', label: 'Fair', color: 'bg-yellow-100 text-yellow-800' },
  { value: 'POOR', label: 'Poor', color: 'bg-red-100 text-red-800' },
] as const

export const ORDER_STATUS_LABELS: Record<string, string> = {
  CREATED: 'Order Placed',
  PAYMENT_PENDING: 'Payment Pending',
  PAYMENT_CONFIRMED: 'Payment Confirmed',
  SELLER_NOTIFIED: 'Seller Notified',
  SELLER_ACCEPTED: 'Seller Accepted',
  PACKING: 'Packing',
  READY_FOR_PICKUP: 'Ready for Pickup',
  PICKED_UP: 'Picked Up',
  IN_TRANSIT: 'In Transit',
  OUT_FOR_DELIVERY: 'Out for Delivery',
  DELIVERED: 'Delivered',
  BUYER_CONFIRMED: 'Delivery Confirmed',
  COMPLETED: 'Completed',
  CANCELLED: 'Cancelled',
  RETURN_REQUESTED: 'Return Requested',
  RETURN_APPROVED: 'Return Approved',
  RETURNED: 'Returned',
  REFUNDED: 'Refunded',
  DISPUTED: 'Disputed',
}

export const VERIFICATION_STATUS_LABELS: Record<string, string> = {
  UNVERIFIED: 'Not Verified',
  PENDING: 'Verification Pending',
  UNDER_REVIEW: 'Under Review',
  VERIFIED: 'Verified Student',
  REJECTED: 'Rejected',
  EXPIRED: 'Expired',
  SUSPENDED: 'Suspended',
}

export const CATEGORIES = [
  { slug: 'books', name: 'Books & Notes', icon: '📚' },
  { slug: 'electronics', name: 'Electronics', icon: '💻' },
  { slug: 'furniture', name: 'Furniture', icon: '🪑' },
  { slug: 'clothing', name: 'Clothing', icon: '👕' },
  { slug: 'bicycles', name: 'Bicycles', icon: '🚲' },
  { slug: 'hostel-items', name: 'Hostel Items', icon: '🏠' },
  { slug: 'lab-equipment', name: 'Lab Equipment', icon: '🧪' },
  { slug: 'agricultural-equipment', name: 'Agri Equipment', icon: '🌾' },
  { slug: 'other', name: 'Other', icon: '📦' },
]

// See lib/delivery.ts for the checkout delivery options, fees and pickup points
export const DELIVERY_METHODS = [
  { value: 'CAMPUS_PICKUP', label: 'Pickup Point', description: 'Collect from a StudySwaps pickup point in the city' },
  { value: 'LOCAL_DELIVERY', label: 'Home Delivery', description: 'Delivered to your address within the city' },
]

// eSewa is the only payment method (no cash on delivery, no Khalti)
export const PAYMENT_METHODS = [
  { value: 'ESEWA', label: 'eSewa', icon: '💚', description: 'Pay securely with eSewa' },
]

export const MAX_PRODUCT_IMAGES = 5
export const MAX_IMAGE_SIZE_MB = 10
export const MAX_IMAGE_SIZE_BYTES = MAX_IMAGE_SIZE_MB * 1024 * 1024
export const ALLOWED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp']

export const PAGINATION_PAGE_SIZE = 20

export const WALLET_RELEASE_DAYS = 3 // Days after delivery to release funds

export const ADMIN_ROLES_DISPLAY: Record<string, string> = {
  SUPER_ADMIN: 'Super Admin',
  ADMIN: 'Admin',
  VERIFICATION_REVIEWER: 'Verification Reviewer',
  MODERATOR: 'Moderator',
  FINANCE_ADMIN: 'Finance Admin',
  SUPPORT_AGENT: 'Support Agent',
  LOGISTICS_ADMIN: 'Logistics Admin',
}

export const CURRENCY = 'NPR'
export const CURRENCY_SYMBOL = 'Rs.'

export const CONDITION_CONFIG: Record<string, { label: string; color: string }> = Object.fromEntries(
  PRODUCT_CONDITIONS.map((c) => [c.value, { label: c.label, color: c.color }])
)


/** Customer support on WhatsApp (buyers and sellers never chat directly — support is the single point of contact). */
export const SUPPORT_WHATSAPP = '9779812969636'
export const SUPPORT_PHONE_DISPLAY = '+977 981-2969636'
export const supportWhatsAppUrl = (message?: string) => `https://wa.me/${SUPPORT_WHATSAPP}${message ? `?text=${encodeURIComponent(message)}` : ''}`
