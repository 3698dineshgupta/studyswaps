/**
 * Server-side proof that an uploaded file really is a safe photo.
 * The browser-supplied Content-Type and file name mean nothing; we read the actual bytes.
 */
import sharp from 'sharp'

export const MAX_IMAGE_BYTES = 10 * 1024 * 1024
export const MAX_IMAGE_SIDE = 8000          // px
export const MAX_IMAGE_PIXELS = 40_000_000  // 40 MP — blocks "decompression bomb" images

const ALLOWED_FORMATS = new Set(['jpeg', 'png', 'webp'])

export type ImageVerdict = { ok: true; format: string; width: number; height: number } | { ok: false; error: string }

export async function verifyImage(file: File): Promise<ImageVerdict> {
  if (file.size === 0) return { ok: false, error: 'The file is empty' }
  if (file.size > MAX_IMAGE_BYTES) return { ok: false, error: 'Photos must be 10 MB or smaller' }
  try {
    const buf = Buffer.from(await file.arrayBuffer())
    // sharp reads the real header. limitInputPixels stops decompression bombs before any pixel work happens.
    const meta = await sharp(buf, { limitInputPixels: MAX_IMAGE_PIXELS, failOn: 'error' }).metadata()
    if (!meta.format || !ALLOWED_FORMATS.has(meta.format)) return { ok: false, error: 'Only JPG, PNG or WebP photos are allowed' }
    const { width = 0, height = 0 } = meta
    if (!width || !height) return { ok: false, error: 'This file is not a valid image' }
    if (width > MAX_IMAGE_SIDE || height > MAX_IMAGE_SIDE) return { ok: false, error: 'This photo is too large in pixels. Please resize it.' }
    if (width < 200 || height < 200) return { ok: false, error: 'This photo is too small. Use a clearer, larger photo.' }
    return { ok: true, format: meta.format, width, height }
  } catch {
    return { ok: false, error: 'This file is not a valid photo' }
  }
}
