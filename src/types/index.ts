// ============================================================
// STUDENTMARKET — Core TypeScript Types
// ============================================================

export type VerificationStatus =
  | 'UNVERIFIED' | 'PENDING' | 'UNDER_REVIEW' | 'VERIFIED' | 'REJECTED' | 'EXPIRED' | 'SUSPENDED'

export type VerificationMethod = 'COLLEGE_ID' | 'SCHOOL_ID' | 'SELFIE_WITH_ID'

export type DocumentType =
  | 'COLLEGE_ID_FRONT' | 'COLLEGE_ID_BACK' | 'SCHOOL_ID_FRONT' | 'SCHOOL_ID_BACK' | 'SELFIE_WITH_ID'

export type AccountStatus =
  | 'ACTIVE' | 'SUSPENDED' | 'BANNED' | 'PENDING_VERIFICATION' | 'DEACTIVATED'

export type ProductCondition = 'NEW' | 'LIKE_NEW' | 'GOOD' | 'FAIR' | 'POOR'

export type ProductStatus =
  | 'DRAFT' | 'PENDING_REVIEW' | 'ACTIVE' | 'SOLD' | 'SUSPENDED' | 'REJECTED' | 'ARCHIVED'

export type OrderStatus =
  | 'CREATED' | 'PAYMENT_PENDING' | 'PAYMENT_CONFIRMED' | 'SELLER_NOTIFIED'
  | 'SELLER_ACCEPTED' | 'PACKING' | 'READY_FOR_PICKUP' | 'PICKED_UP'
  | 'IN_TRANSIT' | 'OUT_FOR_DELIVERY' | 'DELIVERED' | 'BUYER_CONFIRMED'
  | 'COMPLETED' | 'CANCELLED' | 'RETURN_REQUESTED' | 'RETURN_APPROVED'
  | 'RETURNED' | 'REFUNDED' | 'DISPUTED'

export type PaymentStatus = 'PENDING' | 'PROCESSING' | 'CONFIRMED' | 'FAILED' | 'REFUNDED' | 'CANCELLED'

export type PaymentMethod = 'ESEWA' | 'CASH_ON_PICKUP' | 'BANK_TRANSFER' | 'KHALTI'

export type DeliveryMethod = 'MEET_SELLER' | 'CAMPUS_PICKUP' | 'LOCAL_DELIVERY'

export type WalletTransactionType =
  | 'SALE_PENDING' | 'SALE_RELEASED' | 'REFUND' | 'WITHDRAWAL_REQUESTED'
  | 'WITHDRAWAL_COMPLETED' | 'WITHDRAWAL_FAILED' | 'ADJUSTMENT' | 'FEE'

export type WithdrawalStatus = 'REQUESTED' | 'PROCESSING' | 'COMPLETED' | 'FAILED' | 'CANCELLED'

export type DisputeStatus =
  | 'OPEN' | 'UNDER_REVIEW' | 'WAITING_FOR_BUYER' | 'WAITING_FOR_SELLER'
  | 'RESOLVED' | 'REJECTED' | 'REFUNDED'

export type DisputeReason =
  | 'NOT_RECEIVED' | 'WRONG_ITEM' | 'DAMAGED' | 'NOT_AS_DESCRIBED' | 'SELLER_ISSUE' | 'OTHER'

export type AdminRole =
  | 'SUPER_ADMIN' | 'ADMIN' | 'VERIFICATION_REVIEWER' | 'MODERATOR'
  | 'FINANCE_ADMIN' | 'SUPPORT_AGENT' | 'LOGISTICS_ADMIN'

export type NotificationType =
  | 'VERIFICATION_STATUS' | 'ORDER_UPDATE' | 'PAYMENT_UPDATE' | 'DELIVERY_UPDATE'
  | 'NEW_MESSAGE' | 'WITHDRAWAL_UPDATE' | 'DISPUTE_UPDATE' | 'LISTING_STATUS'
  | 'REVIEW_RECEIVED' | 'SYSTEM'

export type TelegramSyncStatus = 'PENDING' | 'SENT' | 'FAILED' | 'RETRYING'

// ============================================================
// MODELS
// ============================================================

export interface Profile {
  id: string
  auth_user_id: string
  full_name: string
  phone?: string
  phone_verified: boolean
  profile_photo?: string
  bio?: string
  college_id?: string
  college_name?: string
  location?: string
  verification_status: VerificationStatus
  account_status: AccountStatus
  is_seller: boolean
  seller_rating: number
  seller_review_count: number
  total_sales: number
  created_at: string
  updated_at: string
}

export interface Category {
  id: string
  name: string
  slug: string
  description?: string
  icon?: string
  parent_id?: string
  sort_order: number
  is_active: boolean
  created_at: string
}

export interface Product {
  id: string
  listing_number: string
  seller_id: string
  category_id?: string
  title: string
  description?: string
  brand?: string
  model?: string
  condition: ProductCondition
  price: number
  original_price?: number
  is_negotiable: boolean
  quantity: number
  location: string
  preferred_meeting_point?: string
  delivery_available: boolean
  delivery_charge: number
  status: ProductStatus
  view_count: number
  wishlist_count: number
  is_reserved: boolean
  year_purchased?: number
  created_at: string
  updated_at: string
  // Joined fields
  seller?: Profile
  category?: Category
  images?: ProductImage[]
  is_wishlisted?: boolean
}

export interface ProductImage {
  id: string
  product_id: string
  storage_path: string
  is_primary: boolean
  sort_order: number
  uploaded_at: string
}

export interface CartItem {
  id: string
  cart_id: string
  product_id: string
  quantity: number
  delivery_method: DeliveryMethod
  added_at: string
  product?: Product
}

export interface Order {
  id: string
  order_number: string
  buyer_id: string
  seller_id: string
  status: OrderStatus
  subtotal: number
  delivery_charge: number
  platform_fee: number
  total: number
  currency: string
  delivery_method: DeliveryMethod
  delivery_address?: DeliveryAddress
  meeting_location?: string
  buyer_notes?: string
  seller_notes?: string
  cancelled_at?: string
  completed_at?: string
  created_at: string
  updated_at: string
  // Joined
  buyer?: Profile
  seller?: Profile
  items?: OrderItem[]
  payment?: Payment
  delivery?: Delivery
}

export interface DeliveryAddress {
  full_name: string
  phone: string
  address_line1: string
  address_line2?: string
  city: string
  district: string
}

export interface OrderItem {
  id: string
  order_id: string
  product_id: string
  title: string
  condition: ProductCondition
  price: number
  quantity: number
  seller_id: string
}

export interface Payment {
  id: string
  order_id: string
  transaction_id?: string
  method: PaymentMethod
  status: PaymentStatus
  amount: number
  currency: string
  esewa_transaction_uuid?: string
  verified_at?: string
  verified_by_server: boolean
  refund_amount?: number
  refunded_at?: string
  created_at: string
  updated_at: string
}

export interface Wallet {
  id: string
  seller_id: string
  available_balance: number
  pending_balance: number
  total_earned: number
  total_withdrawn: number
  currency: string
  updated_at: string
}

export interface WalletLedgerEntry {
  id: string
  seller_id: string
  wallet_id: string
  order_id?: string
  transaction_type: WalletTransactionType
  amount: number
  currency: string
  balance_before: number
  balance_after: number
  pending_before?: number
  pending_after?: number
  status: string
  reference?: string
  description?: string
  created_at: string
}

export interface Withdrawal {
  id: string
  seller_id: string
  wallet_id: string
  amount: number
  currency: string
  status: WithdrawalStatus
  payout_method: string
  payout_details: Record<string, unknown>
  admin_notes?: string
  processed_at?: string
  failure_reason?: string
  created_at: string
  updated_at: string
}

export interface Delivery {
  id: string
  order_id: string
  current_status: OrderStatus
  estimated_delivery?: string
  actual_delivery?: string
  tracking_notes?: string
  created_at: string
  updated_at: string
  events?: DeliveryEvent[]
}

export interface DeliveryEvent {
  id: string
  delivery_id: string
  status: OrderStatus
  description?: string
  location?: string
  actor_type?: string
  metadata?: Record<string, unknown>
  created_at: string
}

export interface Conversation {
  id: string
  buyer_id: string
  seller_id: string
  product_id?: string
  order_id?: string
  last_message_at?: string
  buyer_unread_count: number
  seller_unread_count: number
  is_blocked: boolean
  created_at: string
  buyer?: Profile
  seller?: Profile
  product?: Product
  last_message?: Message
}

export interface Message {
  id: string
  conversation_id: string
  sender_id: string
  content: string
  message_type: string
  attachment_url?: string
  is_read: boolean
  read_at?: string
  is_deleted: boolean
  created_at: string
  sender?: Profile
}

export interface Review {
  id: string
  order_id: string
  reviewer_id: string
  seller_id: string
  rating: number
  title?: string
  content?: string
  is_verified_purchase: boolean
  is_public: boolean
  seller_reply?: string
  seller_replied_at?: string
  created_at: string
  updated_at: string
  reviewer?: Profile
}

export interface Dispute {
  id: string
  order_id: string
  opened_by: string
  reason: DisputeReason
  description: string
  status: DisputeStatus
  resolution?: string
  resolved_by?: string
  resolved_at?: string
  refund_amount?: number
  created_at: string
  updated_at: string
  evidence?: DisputeEvidence[]
}

export interface DisputeEvidence {
  id: string
  dispute_id: string
  submitted_by: string
  description?: string
  storage_path: string
  file_type?: string
  created_at: string
}

export interface Notification {
  id: string
  profile_id: string
  type: NotificationType
  title: string
  body: string
  data?: Record<string, unknown>
  is_read: boolean
  read_at?: string
  action_url?: string
  created_at: string
}

export interface VerificationRequest {
  id: string
  profile_id: string
  verification_number: string
  method: VerificationMethod
  status: VerificationStatus
  full_name: string
  date_of_birth?: string
  college_name: string
  student_id: string
  roll_number?: string
  submitted_at: string
  reviewed_at?: string
  review_notes?: string
  rejection_reason?: string
  expires_at?: string
  created_at: string
  updated_at: string
  documents?: VerificationDocument[]
  reviewer?: Profile
}

export interface VerificationDocument {
  id: string
  verification_request_id: string
  document_type: DocumentType
  storage_path: string
  file_size?: number
  mime_type?: string
  uploaded_at: string
}

// ============================================================
// API TYPES
// ============================================================

export interface ApiResponse<T = unknown> {
  data?: T
  error?: string
  message?: string
  status: number
}

export interface PaginatedResponse<T> {
  data: T[]
  total: number
  page: number
  pageSize: number
  totalPages: number
}

export interface ProductFilters {
  search?: string
  category?: string
  minPrice?: number
  maxPrice?: number
  condition?: ProductCondition
  location?: string
  isNegotiable?: boolean
  sort?: 'newest' | 'price_asc' | 'price_desc' | 'popular'
  page?: number
  pageSize?: number
}

// ============================================================
// ESEWA TYPES
// ============================================================

export interface EsewaPaymentConfig {
  amount: number
  tax_amount: number
  total_amount: number
  transaction_uuid: string
  product_code: string
  product_service_charge: number
  product_delivery_charge: number
  success_url: string
  failure_url: string
  signed_field_names: string
  signature: string
}

export interface EsewaVerificationResponse {
  product_code: string
  transaction_uuid: string
  total_amount: string
  status: string
  transaction_code: string
  signed_field_names: string
  signature: string
}

// ============================================================
// FORM TYPES
// ============================================================

export interface LoginForm {
  email: string
  password: string
}

export interface RegisterForm {
  full_name: string
  email: string
  password: string
  confirmPassword: string
  phone?: string
}

export interface VerificationForm {
  method: VerificationMethod
  full_name: string
  date_of_birth?: string
  college_name: string
  student_id: string
  roll_number?: string
  id_front?: File
  id_back?: File
  selfie?: File
}

export interface ListingForm {
  category_id: string
  title: string
  description: string
  brand?: string
  model?: string
  condition: ProductCondition
  price: string
  original_price?: string
  is_negotiable: boolean
  location: string
  preferred_meeting_point?: string
  delivery_available: boolean
  delivery_charge?: string
  year_purchased?: string
  images: File[]
}

export interface CheckoutForm {
  delivery_method: DeliveryMethod
  delivery_address?: DeliveryAddress
  meeting_location?: string
  payment_method: PaymentMethod
  buyer_notes?: string
}

export interface WithdrawalForm {
  amount: number
  payout_method: string
  esewa_id?: string
  bank_name?: string
  account_number?: string
  account_holder?: string
}
