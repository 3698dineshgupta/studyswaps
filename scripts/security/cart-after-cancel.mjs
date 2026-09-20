/** Checks: placing an order keeps the items in the cart until payment is confirmed. (throwaway data, cleaned up) */
import { createClient } from '@supabase/supabase-js'
import { createHmac } from 'node:crypto'
import fs from 'node:fs'
const BASE = process.argv[2] || 'http://localhost:3000'
const env = Object.fromEntries(fs.readFileSync('.env.local', 'utf8').split(/\r?\n/).filter((l) => /^[A-Z_]+=/.test(l)).map((l) => [l.slice(0, l.indexOf('=')), l.slice(l.indexOf('=') + 1)]))
const admin = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } })
const stamp = Date.now(); const made = []; let productId, orderIds = []
const ok = (n, p, d = '') => console.log(`${p ? 'PASS' : 'FAIL'}  ${n}${d ? ' — ' + d : ''}`)
async function mk(tag) {
  const email = `cart-${tag}-${stamp}@studentmarket.test`, password = 'Cart-Test-9x!' + stamp
  const { data } = await admin.auth.admin.createUser({ email, password, email_confirm: true, user_metadata: { full_name: `Cart ${tag}` } })
  made.push(data.user.id); await new Promise((r) => setTimeout(r, 500))
  await admin.from('profiles').update({ phone: '9800000002', location: 'Kathmandu', ...(tag === 'seller' ? { verification_status: 'VERIFIED', is_seller: true } : {}) }).eq('auth_user_id', data.user.id)
  const { data: p } = await admin.from('profiles').select('id').eq('auth_user_id', data.user.id).single()
  const anon = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_ANON_KEY, { auth: { persistSession: false } })
  const { data: s } = await anon.auth.signInWithPassword({ email, password })
  const name = `sb-${new URL(env.NEXT_PUBLIC_SUPABASE_URL).hostname.split('.')[0]}-auth-token`, enc = encodeURIComponent(JSON.stringify(s.session)), ch = []
  for (let i = 0; i < enc.length; i += 3180) ch.push(enc.slice(i, i + 3180))
  return { id: p.id, cookie: ch.map((c, i) => `${ch.length === 1 ? name : `${name}.${i}`}=${c}`).join('; ') }
}
const call = (u, path, body, method = 'POST') => fetch(BASE + path, { method, headers: { cookie: u.cookie, ...(body ? { 'Content-Type': 'application/json' } : {}) }, body: body ? JSON.stringify(body) : undefined })
try {
  const seller = await mk('seller'), buyer = await mk('buyer')
  const { data: cat } = await admin.from('categories').select('id').limit(1).single()
  const { data: prod } = await admin.from('products').insert({ seller_id: seller.id, category_id: cat.id, title: 'Cart flow item', description: 'Throwaway item for a test', condition: 'GOOD', price: 400, location: 'Kathmandu', status: 'ACTIVE', quantity: 1 }).select('id').single()
  productId = prod.id
  await admin.from('product_images').insert([0, 1, 2].map((i) => ({ product_id: productId, storage_path: `x/c${i}.jpg`, is_primary: i === 0, sort_order: i })))
  await call(buyer, '/api/cart', { productId, quantity: 1 })
  const label = 'Baneshwor, Kathmandu', lat = 27.6915, lon = 85.3420
  const sig = createHmac('sha256', env.APP_SECRET || env.SUPABASE_SERVICE_ROLE_KEY).update(`${label}|${lat.toFixed(5)}|${lon.toFixed(5)}`).digest('base64url')
  const body = { payment_method: 'esewa', contact: { full_name: 'Cart Buyer', phone: '9812345678' }, delivery: { place: { label, lat, lon, sig }, address_line: 'House 12, Lane 3', landmark: 'Near the temple' } }
  let r = await call(buyer, '/api/orders', body); let j = await r.json(); orderIds.push(j.order_id)
  ok('order placed (awaiting payment)', r.status === 201, `status ${r.status} ${j.error ?? ''}`)
  r = await call(buyer, '/api/cart', null, 'GET'); j = await r.json()
  ok('items are STILL in the cart after placing the order (cancel-safe)', (j.items ?? []).length === 1, `${(j.items ?? []).length} item(s)`)
  r = await call(buyer, '/api/orders', body); j = await r.json(); orderIds.push(j.order_id)
  const { data: o1 } = await admin.from('orders').select('status').eq('id', orderIds[0]).single()
  ok('trying again closes the abandoned first attempt', r.status === 201 && o1.status === 'CANCELLED', `first order is ${o1.status}`)
} catch (e) { console.error('ERROR', e); process.exitCode = 2 } finally {
  for (const id of orderIds.filter(Boolean)) { const d = (await admin.from('deliveries').select('id').eq('order_id', id)).data ?? []; if (d.length) await admin.from('delivery_events').delete().in('delivery_id', d.map((x) => x.id)); await admin.from('deliveries').delete().eq('order_id', id); await admin.from('order_items').delete().eq('order_id', id); await admin.from('payments').delete().eq('order_id', id); await admin.from('orders').delete().eq('id', id) }
  if (productId) { await admin.from('cart_items').delete().eq('product_id', productId); await admin.from('product_images').delete().eq('product_id', productId); await admin.from('products').delete().eq('id', productId) }
  for (const uid of made) { const { data: p } = await admin.from('profiles').select('id').eq('auth_user_id', uid).maybeSingle(); if (p) { await admin.from('notifications').delete().eq('profile_id', p.id); await admin.from('carts').delete().eq('profile_id', p.id) } await admin.auth.admin.deleteUser(uid) }
}
