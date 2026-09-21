/**
 * Live identity-verification helpers — server-side ONLY.
 *
 * Security model: the browser never chooses the verification id, the challenge,
 * the timestamp, the storage path or the status. The server issues a signed,
 * short-lived session bound to the authenticated user; the upload must present
 * that session, and everything security-relevant is derived server-side.
 */
import { createHmac, randomInt, randomUUID, timingSafeEqual } from 'crypto'
import sharp from 'sharp'

export const IDENTITY_BUCKET = 'identity-verifications'
export const MAX_CAPTURE_BYTES = 5 * 1024 * 1024 // 5 MB
export const MAX_FRAME_BYTES = 1024 * 1024 // liveness frames are small

export const ALLOWED_MIME = ['image/jpeg', 'image/png', 'image/webp'] as const
const ALLOWED_FORMATS = ['jpeg', 'png', 'webp']

/** The capture must come at least this long after the session started (the challenge takes time). */
export const MIN_SESSION_AGE_MS = 3_000
export const SESSION_TTL_MS = 10 * 60 * 1000
/** Minimum mean pixel movement (0-255 scale, 64x48 grayscale) between frames to count as live movement. */
export const MIN_LIVENESS_SCORE = 2.0
/** Max capture attempts per user per hour. */
export const MAX_ATTEMPTS_PER_HOUR = 8

export const CHALLENGES = [
  { id: 'TURN_LEFT', text: 'Turn your head slightly left' },
  { id: 'TURN_RIGHT', text: 'Turn your head slightly right' },
] as const

export type ChallengeId = (typeof CHALLENGES)[number]['id']

interface SessionPayload {
  v: string // verification id
  u: string // authenticated user id
  c: ChallengeId
  iat: number
  exp: number
}

function secret(): string {
  const s = process.env.APP_SECRET || process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!s) throw new Error('APP_SECRET is not configured')
  return s
}

const b64url = (buf: Buffer | string) => Buffer.from(buf).toString('base64url')
const sign = (data: string) => createHmac('sha256', secret()).update(data).digest('base64url')

export function createSession(userId: string) {
  const now = Date.now()
  const challenge = CHALLENGES[randomInt(CHALLENGES.length)]
  const payload: SessionPayload = { v: randomUUID(), u: userId, c: challenge.id, iat: now, exp: now + SESSION_TTL_MS }
  const body = b64url(JSON.stringify(payload))
  return {
    token: `${body}.${sign(body)}`,
    verificationId: payload.v,
    challenge,
    expiresAt: new Date(payload.exp).toISOString(),
  }
}

export type SessionResult =
  | { ok: true; payload: SessionPayload }
  | { ok: false; error: 'INVALID_SESSION' | 'SESSION_EXPIRED' | 'SESSION_MISMATCH' | 'TOO_FAST' }

/** Verify signature, expiry, ownership and minimum elapsed time. */
export function verifySession(token: string, userId: string): SessionResult {
  const [body, sig] = String(token ?? '').split('.')
  if (!body || !sig) return { ok: false, error: 'INVALID_SESSION' }

  const expected = Buffer.from(sign(body))
  const actual = Buffer.from(sig)
  if (expected.length !== actual.length || !timingSafeEqual(expected, actual)) {
    return { ok: false, error: 'INVALID_SESSION' }
  }

  let payload: SessionPayload
  try {
    payload = JSON.parse(Buffer.from(body, 'base64url').toString('utf8'))
  } catch {
    return { ok: false, error: 'INVALID_SESSION' }
  }

  if (payload.u !== userId) return { ok: false, error: 'SESSION_MISMATCH' } // another user's session
  const now = Date.now()
  if (now > payload.exp) return { ok: false, error: 'SESSION_EXPIRED' }
  if (now - payload.iat < MIN_SESSION_AGE_MS) return { ok: false, error: 'TOO_FAST' }
  return { ok: true, payload }
}

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
    const meta = await sharp(buffer, { failOn: 'error' }).metadata()
    if (!meta.format || !ALLOWED_FORMATS.includes(meta.format) || !meta.width || !meta.height) {
      return { ok: false, error: 'INVALID_IMAGE' }
    }
    if (meta.width > 8000 || meta.height > 8000) return { ok: false, error: 'INVALID_IMAGE' }
    if (meta.width < (opts.minWidth ?? 0) || meta.height < (opts.minHeight ?? 0)) return { ok: false, error: 'IMAGE_TOO_SMALL' }
    return { ok: true, buffer, width: meta.width, height: meta.height }
  } catch {
    return { ok: false, error: 'INVALID_IMAGE' }
  }
}

/** Re-encode to a clean JPEG: strips EXIF/GPS metadata and caps the size. */
export function normalizeCapture(buffer: Buffer): Promise<Buffer> {
  return sharp(buffer)
    .rotate()
    .resize({ width: 1280, height: 1280, fit: 'inside', withoutEnlargement: true })
    .jpeg({ quality: 88 })
    .toBuffer()
}

async function thumb(buffer: Buffer): Promise<Buffer> {
  return sharp(buffer).rotate().resize(64, 48, { fit: 'fill' }).greyscale().blur(0.8).raw().toBuffer()
}

function meanAbsDiff(a: Buffer, b: Buffer): number {
  const n = Math.min(a.length, b.length)
  let sum = 0
  for (let i = 0; i < n; i++) sum += Math.abs(a[i] - b[i])
  return sum / n
}

/**
 * Basic server-side liveness signal: how much the picture changes between the
 * frames captured while the user performed the random head-turn. A held-up
 * photo or frozen feed changes ~0. This is ADDITIONAL evidence for reviewers —
 * it does not prove the person is real (a pre-recorded video would also move).
 */
export async function livenessScore(frames: Buffer[], capture: Buffer): Promise<number> {
  const all = await Promise.all([...frames, capture].map(thumb))
  let max = 0
  for (let i = 0; i < all.length; i++) {
    for (let j = i + 1; j < all.length; j++) max = Math.max(max, meanAbsDiff(all[i], all[j]))
  }
  return Math.round(max * 100) / 100
}

export const identityImagePath = (userId: string, verificationId: string) =>
  `${userId}/${verificationId}/identity_capture.jpg`

/** User-facing messages for API error codes. */
export const IDENTITY_ERRORS: Record<string, { status: number; message: string }> = {
  UNAUTHORIZED: { status: 401, message: 'Please log in to continue.' },
  INVALID_SESSION: { status: 400, message: 'Your verification session is invalid. Please retake the photo.' },
  SESSION_EXPIRED: { status: 400, message: 'Your verification session expired. Please retake the photo.' },
  SESSION_MISMATCH: { status: 403, message: 'This verification session does not belong to your account.' },
  TOO_FAST: { status: 400, message: 'The capture was too quick. Please complete the on-screen check and try again.' },
  MISSING_CAPTURE: { status: 400, message: 'No photo was received. Please retake the photo.' },
  INVALID_IMAGE: { status: 400, message: 'That image is not valid. Please retake the photo with your camera.' },
  FILE_TOO_LARGE: { status: 413, message: 'The photo is too large (max 5 MB). Please retake it.' },
  IMAGE_TOO_SMALL: { status: 400, message: 'The photo resolution is too low. Move to better light and retake it.' },
  LIVENESS_FAILED: { status: 400, message: "We couldn't detect live movement. Please retry and clearly follow the on-screen instruction." },
  ALREADY_USED: { status: 409, message: 'This capture was already submitted. Please start a new photo.' },
  RATE_LIMITED: { status: 429, message: 'Too many attempts. Please wait a while before trying again.' },
  ALREADY_VERIFIED: { status: 409, message: 'Your identity is already verified.' },
  PENDING_REVIEW: { status: 409, message: 'A verification request is already pending review.' },
  STORAGE_ERROR: { status: 502, message: "We couldn't store your photo. Please try again." },
  ID_CARD_MISSING: { status: 400, message: 'Please capture the front of your ID card first.' },
  ID_CARD_INVALID: { status: 400, message: 'Your ID card photo expired or could not be found. Please capture it again.' },
  SERVER_ERROR: { status: 500, message: 'Something went wrong on our side. Please try again.' },
}

// ---------------------------------------------------------------------------
// ID card (front) — captured live BEFORE the selfie-with-ID. It is uploaded on its own, then attached to the
// selfie's verification id by the server, so the two photos always travel together.
// ---------------------------------------------------------------------------

export const CARD_TOKEN_TTL_MS = 60 * 60 * 1000

/** Where a just-captured ID card waits until the selfie is uploaded. */
export const idCardTempPath = (userId: string, cardId: string) => `${userId}/cards/${cardId}.jpg`
/** Final location, next to the selfie of the same verification. */
export const idFrontPath = (userId: string, verificationId: string) => `${userId}/${verificationId}/id_front.jpg`

export function createCardToken(userId: string) {
  const cardId = randomUUID()
  const body = b64url(JSON.stringify({ k: cardId, u: userId, exp: Date.now() + CARD_TOKEN_TTL_MS }))
  return { cardId, token: `${body}.${sign(body)}` }
}

/** Returns the card id when the token is genuine, unexpired and belongs to this user. */
export function verifyCardToken(token: string, userId: string): string | null {
  const [body, sig] = String(token ?? '').split('.')
  if (!body || !sig) return null
  const expected = Buffer.from(sign(body))
  const actual = Buffer.from(sig)
  if (expected.length !== actual.length || !timingSafeEqual(expected, actual)) return null
  try {
    const p = JSON.parse(Buffer.from(body, 'base64url').toString('utf8')) as { k: string; u: string; exp: number }
    if (p.u !== userId || Date.now() > p.exp || !/^[0-9a-f-]{36}$/.test(p.k)) return null
    return p.k
  } catch {
    return null
  }
}

let bucketReady = false
/** Create the private bucket on first use. */
export async function ensureIdentityBucket(admin: import('@supabase/supabase-js').SupabaseClient) {
  if (bucketReady) return
  const { error } = await admin.storage.createBucket(IDENTITY_BUCKET, {
    public: false,
    fileSizeLimit: MAX_CAPTURE_BYTES,
    allowedMimeTypes: ['image/jpeg', 'image/png', 'image/webp'],
  })
  if (error && !/already exists|duplicate/i.test(error.message)) throw error
  bucketReady = true
}
