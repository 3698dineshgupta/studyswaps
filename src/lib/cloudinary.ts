/**
 * Cloudinary uploads — server-side ONLY (uses the API secret).
 * Signed upload over the REST API, so no extra dependency is needed.
 * Configure with CLOUDINARY_URL=cloudinary://<api_key>:<api_secret>@<cloud_name>
 */
import { createHash } from 'crypto'

interface CloudinaryConfig {
  cloudName: string
  apiKey: string
  apiSecret: string
}

function getConfig(): CloudinaryConfig | null {
  const raw = process.env.CLOUDINARY_URL
  if (!raw) return null
  try {
    const url = new URL(raw)
    if (url.protocol !== 'cloudinary:') return null
    return {
      cloudName: url.hostname,
      apiKey: decodeURIComponent(url.username),
      apiSecret: decodeURIComponent(url.password),
    }
  } catch {
    return null
  }
}

export function isCloudinaryConfigured(): boolean {
  return getConfig() !== null
}

/**
 * Incoming transformation applied once at upload time: cap the longest side
 * at 1600px and let Cloudinary pick the quality. Smaller variants for cards
 * and thumbnails are produced at delivery time (see getSupabaseImageUrl).
 */
const INCOMING_TRANSFORMATION = 'c_limit,w_1600,h_1600,q_auto'

export interface CloudinaryUpload {
  url: string
  publicId: string
  width: number
  height: number
  bytes: number
}

export async function uploadImageToCloudinary(file: File, folder: string): Promise<CloudinaryUpload> {
  const cfg = getConfig()
  if (!cfg) throw new Error('Cloudinary is not configured')

  const timestamp = String(Math.floor(Date.now() / 1000))
  // Every parameter except file/api_key must be signed, sorted alphabetically
  const toSign: Record<string, string> = { folder, timestamp, transformation: INCOMING_TRANSFORMATION }
  const signature = createHash('sha1')
    .update(
      Object.keys(toSign)
        .sort()
        .map((k) => `${k}=${toSign[k]}`)
        .join('&') + cfg.apiSecret
    )
    .digest('hex')

  const body = new FormData()
  body.append('file', file)
  body.append('api_key', cfg.apiKey)
  body.append('signature', signature)
  for (const [k, v] of Object.entries(toSign)) body.append(k, v)

  const res = await fetch(`https://api.cloudinary.com/v1_1/${cfg.cloudName}/image/upload`, {
    method: 'POST',
    body,
    signal: AbortSignal.timeout(60000),
  })
  const json = await res.json()
  if (!res.ok) throw new Error(`Cloudinary upload failed: ${json?.error?.message ?? res.status}`)

  return {
    url: json.secure_url,
    publicId: json.public_id,
    width: json.width,
    height: json.height,
    bytes: json.bytes,
  }
}

/** True only for images WE uploaded (our cloud, our products folder) — used to trust photo references sent by the browser. */
export function isOwnCloudinaryProductUrl(url: string): boolean {
  const cfg = getConfig()
  if (!cfg) return false
  return url.startsWith(`https://res.cloudinary.com/${cfg.cloudName}/image/upload/`) && url.includes('/studentmarket/products/')
}

/** True only for payout screenshots WE uploaded (our cloud, our payouts folder). */
export function isOwnCloudinaryPayoutUrl(url: string): boolean {
  const cfg = getConfig()
  if (!cfg) return false
  return url.startsWith(`https://res.cloudinary.com/${cfg.cloudName}/image/upload/`) && url.includes(`/studentmarket/payouts/`)
}
