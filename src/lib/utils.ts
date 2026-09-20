import { type ClassValue, clsx } from 'clsx'
import { twMerge } from 'tailwind-merge'
import { CURRENCY_SYMBOL } from './constants'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatPrice(amount: number): string {
  return `${CURRENCY_SYMBOL} ${amount.toLocaleString('en-NP')}`
}

export function formatDate(dateString: string): string {
  return new Date(dateString).toLocaleDateString('en-NP', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  })
}

export function formatDateTime(dateString: string): string {
  return new Date(dateString).toLocaleString('en-NP', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

export function formatRelativeTime(dateString: string): string {
  const now = new Date()
  const date = new Date(dateString)
  const diffMs = now.getTime() - date.getTime()
  const diffSecs = Math.floor(diffMs / 1000)
  const diffMins = Math.floor(diffSecs / 60)
  const diffHours = Math.floor(diffMins / 60)
  const diffDays = Math.floor(diffHours / 24)

  if (diffSecs < 60) return 'Just now'
  if (diffMins < 60) return `${diffMins}m ago`
  if (diffHours < 24) return `${diffHours}h ago`
  if (diffDays < 7) return `${diffDays}d ago`
  return formatDate(dateString)
}

export function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^\w\s-]/g, '')
    .replace(/[\s_-]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

export function truncate(text: string, length: number): string {
  if (text.length <= length) return text
  return text.slice(0, length) + '...'
}

export function generateIdempotencyKey(): string {
  return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
}

export function isCloudinaryUrl(url: string): boolean {
  return url.startsWith('https://res.cloudinary.com/')
}

/**
 * Resolves a stored image path to a URL. Cloudinary photos are stored as full
 * URLs; pass `width` to get a small, auto-format/auto-quality variant that
 * loads much faster than the 1600px original. Older photos live in Supabase.
 */
export function getSupabaseImageUrl(path: string, width?: number): string {
  if (!path) return '/placeholder-product.png'

  if (path.startsWith('blob:') || path.startsWith('data:')) return path

  if (/^https?:\/\//.test(path)) {
    return width && isCloudinaryUrl(path)
      ? path.replace('/image/upload/', `/image/upload/f_auto,q_auto,c_limit,w_${width}/`)
      : path
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  if (!supabaseUrl) return '/placeholder-product.png'
  // Uploads store the path inside the bucket; tolerate a bucket-prefixed path too
  const objectPath = path.startsWith('product-images/') ? path : `product-images/${path}`
  return `${supabaseUrl}/storage/v1/object/public/${objectPath}`
}

export function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 B'
  const k = 1024
  const sizes = ['B', 'KB', 'MB', 'GB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(2))} ${sizes[i]}`
}

export function validateImageFile(file: File): string | null {
  const maxSize = 10 * 1024 * 1024 // 10MB
  const allowedTypes = ['image/jpeg', 'image/png', 'image/webp']

  if (!allowedTypes.includes(file.type)) {
    return 'Only JPG, PNG, and WebP images are allowed'
  }
  if (file.size > maxSize) {
    return 'Image must be smaller than 10MB'
  }
  return null
}

export function maskPhone(phone: string): string {
  if (!phone || phone.length < 7) return phone
  return phone.slice(0, 2) + '****' + phone.slice(-4)
}

export function maskEmail(email: string): string {
  const [user, domain] = email.split('@')
  if (!user || !domain) return email
  return user.slice(0, 2) + '****@' + domain
}

export function getInitials(name: string): string {
  return name
    .split(' ')
    .map((n) => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2)
}

export function isValidNepalPhone(phone: string): boolean {
  return /^(97|98)\d{8}$/.test(phone.replace(/[\s-]/g, ''))
}

export function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
}

export function calculateDiscount(original: number, current: number): number {
  if (!original || original <= current) return 0
  return Math.round(((original - current) / original) * 100)
}

export function safeJsonParse<T>(json: string, fallback: T): T {
  try {
    return JSON.parse(json) as T
  } catch {
    return fallback
  }
}

export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

export function getExponentialBackoff(attempt: number, baseMs = 1000): number {
  return Math.min(baseMs * Math.pow(2, attempt), 60000) // max 60s
}
