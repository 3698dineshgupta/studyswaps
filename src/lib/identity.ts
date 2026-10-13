/**
 * Identity-document verification helpers — server-side ONLY.
 *
 * A seller uploads ONE photo of a real document (school ID, college/university ID, citizenship certificate or
 * national ID card) — no live camera, no selfie. Everything security-relevant (the verification id, the
 * timestamp, the storage path and the status) is decided here on the server; the browser only supplies which
 * document this is and the image bytes.
 */
import sharp from 'sharp'

export const IDENTITY_BUCKET = 'identity-verifications'
export const MAX_DOCUMENT_BYTES = 8 * 1024 * 1024 // 8 MB — a phone photo of a certificate can be large

export const ALLOWED_MIME = ['image/jpeg', 'image/png', 'image/webp'] as const
const ALLOWED_FORMATS = ['jpeg', 'png', 'webp']
// Same cap as the general upload checker (lib/security/imageCheck.ts): stops a small, highly-compressed file from
// decoding into a huge number of pixels ("decompression bomb") and burning CPU/memory before any size check can run.
const MAX_IMAGE_PIXELS = 40_000_000

/** Max verification uploads per user per hour. */
export const MAX_ATTEMPTS_PER_HOUR = 8

/** Any ONE of these proves the seller is a real student — the seller picks whichever they have. */
export const DOCUMENT_TYPES = [
  { id: 'COLLEGE_ID', label: 'College / University ID' },
  { id: 'SCHOOL_ID', label: 'School ID' },
  { id: 'CITIZENSHIP', label: 'Citizenship certificate' },
  { id: 'NATIONAL_ID', label: 'National ID card' },
] as const
export type DocumentType = (typeof DOCUMENT_TYPES)[number]['id']
export const DOCUMENT_TYPE_IDS = DOCUMENT_TYPES.map((d) => d.id) as DocumentType[]

export type ImageCheck =
  | { ok: true; buffer: Buffer; width: number; height: number }
  | { ok: false; error: 'INVALID_IMAGE' | 'FILE_TOO_LARGE' | 'IMAGE_TOO_SMALL' }

/**
 * Validate by content, not just the declared MIME type: the bytes must decode as
 * a real JPEG/PNG/WebP. Returns the raw bytes for further processing.
 */
export async function checkImage(file: File, opts: { maxBytes: number; minWidth?: number; minHeight?: number }): Promise<ImageCheck> {
  if (file.size > opts.maxBytes) return { ok: false, error: 'FILE_TOO_LARGE' }
  if (!(ALLOWED_MIME as readonly string[]).includes(file.type)) return { ok: false, error: 'INVALID_IMAGE' }

  const buffer = Buffer.from(await file.arrayBuffer())
  if (buffer.length > opts.maxBytes) return { ok: false, error: 'FILE_TOO_LARGE' }

  try {
    const meta = await sharp(buffer, { limitInputPixels: MAX_IMAGE_PIXELS, failOn: 'error' }).metadata()
    if (!meta.format || !ALLOWED_FORMATS.includes(meta.format)) {
      return { ok: false, error: 'INVALID_IMAGE' }
    }
    const { width = 0, height = 0 } = meta
    if (!width || !height) return { ok: false, error: 'INVALID_IMAGE' }
    if (width > 8000 || height > 8000) return { ok: false, error: 'INVALID_IMAGE' }
    if (width < (opts.minWidth ?? 0) || height < (opts.minHeight ?? 0)) return { ok: false, error: 'IMAGE_TOO_SMALL' }
    return { ok: true, buffer, width, height }
  } catch {
    return { ok: false, error: 'INVALID_IMAGE' }
  }
}

/** Re-encode to a clean JPEG: strips EXIF/GPS metadata and caps the size. */
export function normalizeCapture(buffer: Buffer): Promise<Buffer> {
  return sharp(buffer, { limitInputPixels: MAX_IMAGE_PIXELS })
    .rotate()
    .resize({ width: 1600, height: 1600, fit: 'inside', withoutEnlargement: true })
    .jpeg({ quality: 88 })
    .toBuffer()
}

export const documentImagePath = (userId: string, verificationId: string) =>
  `${userId}/${verificationId}/document.jpg`

/** User-facing messages for API error codes. */
export const IDENTITY_ERRORS: Record<string, { status: number; message: string }> = {
  UNAUTHORIZED: { status: 401, message: 'Please log in to continue.' },
  MISSING_DOCUMENT: { status: 400, message: 'Please choose a photo of your document.' },
  INVALID_DOCUMENT_TYPE: { status: 400, message: 'Choose which document you are uploading.' },
  INVALID_IMAGE: { status: 400, message: 'That file is not a valid photo. Please choose a JPG, PNG or WebP image.' },
  FILE_TOO_LARGE: { status: 413, message: 'The photo is too large (max 8 MB). Please choose a smaller file.' },
  IMAGE_TOO_SMALL: { status: 400, message: 'The photo resolution is too low. Use a clearer, larger photo.' },
  ALREADY_USED: { status: 409, message: 'This document was already submitted. Please upload it again.' },
  DOCUMENT_EXPIRED: { status: 400, message: 'Your uploaded document expired. Please upload it again.' },
  RATE_LIMITED: { status: 429, message: 'Too many attempts. Please wait a while before trying again.' },
  ALREADY_VERIFIED: { status: 409, message: 'Your identity is already verified.' },
  PENDING_REVIEW: { status: 409, message: 'A verification request is already pending review.' },
  STORAGE_ERROR: { status: 502, message: "We couldn't store your photo. Please try again." },
  SERVER_ERROR: { status: 500, message: 'Something went wrong on our side. Please try again.' },
}

let bucketReady = false
/** Create the private bucket on first use. */
export async function ensureIdentityBucket(admin: import('@supabase/supabase-js').SupabaseClient) {
  if (bucketReady) return
  const { error } = await admin.storage.createBucket(IDENTITY_BUCKET, {
    public: false,
    fileSizeLimit: MAX_DOCUMENT_BYTES,
    allowedMimeTypes: ['image/jpeg', 'image/png', 'image/webp'],
  })
  if (error && !/already exists|duplicate/i.test(error.message)) throw error
  bucketReady = true
}
