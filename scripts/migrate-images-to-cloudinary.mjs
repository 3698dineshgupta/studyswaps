// Moves listing photos stored in Supabase Storage to Cloudinary (resized + optimized),
// then points product_images.storage_path at the Cloudinary URL. Safe to re-run.
//   node --env-file=.env.local scripts/migrate-images-to-cloudinary.mjs
import { createClient } from '@supabase/supabase-js'
import { createHash } from 'crypto'

const cfg = new URL(process.env.CLOUDINARY_URL ?? '')
if (cfg.protocol !== 'cloudinary:') throw new Error('Set CLOUDINARY_URL in .env.local')
const cloud = cfg.hostname, apiKey = decodeURIComponent(cfg.username), secret = decodeURIComponent(cfg.password)

const supaUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const db = createClient(supaUrl, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } })

async function upload(buf, filename) {
  const timestamp = String(Math.floor(Date.now() / 1000))
  const params = { folder: 'studentmarket/products', timestamp, transformation: 'c_limit,w_1600,h_1600,q_auto' }
  const signature = createHash('sha1').update(Object.keys(params).sort().map((k) => `${k}=${params[k]}`).join('&') + secret).digest('hex')
  const body = new FormData()
  body.append('file', new Blob([buf]), filename)
  body.append('api_key', apiKey)
  body.append('signature', signature)
  for (const [k, v] of Object.entries(params)) body.append(k, v)
  const res = await fetch(`https://api.cloudinary.com/v1_1/${cloud}/image/upload`, { method: 'POST', body })
  const json = await res.json()
  if (!res.ok) throw new Error(json?.error?.message ?? `HTTP ${res.status}`)
  return json.secure_url
}

const { data: rows, error } = await db.from('product_images').select('id, storage_path')
if (error) throw error

let moved = 0, skipped = 0, failed = 0
for (const row of rows) {
  if (/^https?:\/\//.test(row.storage_path)) { skipped++; continue }
  try {
    const objectPath = row.storage_path.startsWith('product-images/') ? row.storage_path : `product-images/${row.storage_path}`
    const res = await fetch(`${supaUrl}/storage/v1/object/public/${objectPath}`)
    if (!res.ok) throw new Error(`download ${res.status}`)
    const url = await upload(Buffer.from(await res.arrayBuffer()), row.storage_path.split('/').pop())
    const { error: upErr } = await db.from('product_images').update({ storage_path: url }).eq('id', row.id)
    if (upErr) throw upErr
    moved++
  } catch (e) {
    failed++
    console.error(`  ${row.storage_path}: ${e.message}`)
  }
}
console.log(`Moved ${moved}, already on Cloudinary ${skipped}, failed ${failed}`)
