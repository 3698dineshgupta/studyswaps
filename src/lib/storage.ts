/**
 * Server-side storage helpers (service-role client — never import in browser code).
 */
import { randomBytes } from 'crypto'
import type { SupabaseClient } from '@supabase/supabase-js'

export const ALLOWED_UPLOAD_TYPES: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
}

export const MAX_UPLOAD_BYTES = 10 * 1024 * 1024

const ensured = new Set<string>()

/** Create the bucket on first use (idempotent). */
export async function ensureBucket(admin: SupabaseClient, name: string, isPublic: boolean) {
  if (ensured.has(name)) return
  const { error } = await admin.storage.createBucket(name, {
    public: isPublic,
    fileSizeLimit: MAX_UPLOAD_BYTES,
  })
  if (error && !/already exists|duplicate/i.test(error.message)) throw error
  ensured.add(name)
}

export function validateImageFiles(files: File[], opts: { min: number; max: number; label: string }): string | null {
  if (files.length < opts.min) return `Please upload at least ${opts.min} ${opts.label}`
  if (files.length > opts.max) return `You can upload at most ${opts.max} ${opts.label}`
  for (const f of files) {
    if (!ALLOWED_UPLOAD_TYPES[f.type]) return `${f.name}: only JPG, PNG or WebP images are allowed`
    if (f.size > MAX_UPLOAD_BYTES) return `${f.name}: file is larger than 10 MB`
  }
  return null
}

/** Upload one file under `${folder}/`; returns the path inside the bucket. */
export async function uploadFile(admin: SupabaseClient, bucket: string, folder: string, file: File): Promise<string> {
  const ext = ALLOWED_UPLOAD_TYPES[file.type]
  const path = `${folder}/${Date.now()}-${randomBytes(4).toString('hex')}.${ext}`
  const { error } = await admin.storage
    .from(bucket)
    .upload(path, Buffer.from(await file.arrayBuffer()), { contentType: file.type, cacheControl: '3600', upsert: false })
  if (error) throw error
  return path
}
