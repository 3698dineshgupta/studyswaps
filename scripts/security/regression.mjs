/**
 * StudySwaps security regression suite (safe: uses throwaway users + products it creates, then deletes them).
 *
 *   node scripts/security/regression.mjs [baseUrl]      (default http://localhost:3000; the server must be running)
 *
 * Every check states what an ATTACKER tries; PASS means the attack was refused.
 * Checks marked [DB] test database-level protections and need supabase/migrations/008_security_hardening.sql applied.
 */
import { createClient } from '@supabase/supabase-js'
import fs from 'node:fs'

const BASE = process.argv[2] || 'http://localhost:3000'
const env = Object.fromEntries(fs.readFileSync('.env.local', 'utf8').split(/\r?\n/).filter((l) => /^[A-Z_]+=/.test(l)).map((l) => [l.slice(0, l.indexOf('=')), l.slice(l.indexOf('=') + 1)]))
const URL_ = env.NEXT_PUBLIC_SUPABASE_URL
const admin = createClient(URL_, env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } })
const results = []
const check = (id, name, pass, detail = '') => { results.push({ id, name, pass }); console.log(`${pass ? 'PASS' : 'FAIL'}  ${id}  ${name}${detail ? '  — ' + detail : ''}`) }

const stamp = Date.now()
const made = { users: [], products: [], orders: [] }

async function mkUser(tag, { verified = false, seller = false } = {}) {
  const email = `sec-${tag}-${stamp}@studentmarket.test`
  const password = 'Sec-Test-9x!' + stamp
  const { data, error } = await admin.auth.admin.createUser({ email, password, email_confirm: true, user_metadata: { full_name: `Sec ${tag}` } })
  if (error) throw error
  made.users.push(data.user.id)
  await new Promise((r) => setTimeout(r, 500))
  const upd = { phone: '9800000000' }
  if (verified) upd.verification_status = 'VERIFIED'
  if (seller) upd.is_seller = true
  await admin.from('profiles').update(upd).eq('auth_user_id', data.user.id)
  const { data: profile } = await admin.from('profiles').select('id').eq('auth_user_id', data.user.id).single()
  const anon = createClient(URL_, env.NEXT_PUBLIC_SUPABASE_ANON_KEY, { auth: { persistSession: false } })
  const { data: s } = await anon.auth.signInWithPassword({ email, password })
  const ref = new URL(URL_).hostname.split('.')[0]
  const name = `sb-${ref}-auth-token`
  const enc = encodeURIComponent(JSON.stringify(s.session))
  const ch = []
  for (let i = 0; i < enc.length; i += 3180) ch.push(enc.slice(i, i + 3180))
  const cookie = ch.map((c, i) => `${ch.length === 1 ? name : `${name}.${i}`}=${c}`).join('; ')
  return { id: data.user.id, profileId: profile.id, email, client: anon, cookie }
}
const api = (u, path, init = {}) => fetch(BASE + path, {
  ...init,
  headers: { ...(init.headers || {}), ...(u ? { cookie: u.cookie } : {}), ...(init.body && typeof init.body === 'string' ? { 'Content-Type': 'application/json' } : {}) },
})
const post = (u, path, body) => api(u, path, { method: 'POST', body: JSON.stringify(body) })

try {
  const buyer = await mkUser('buyer')
  const buyer2 = await mkUser('other')
  const seller = await mkUser('seller', { verified: true, seller: true })
  const { data: cat } = await admin.from('categories').select('id').limit(1).single()
  const { data: prod } = await admin.from('products').insert({ seller_id: seller.profileId, category_id: cat.id, title: 'SecTest item', description: 'Throwaway security test item', condition: 'GOOD', price: 500, location: 'Kathmandu', status: 'ACTIVE', quantity: 1 }).select('id').single()
  made.products.push(prod.id)
  await admin.from('product_images').insert([0, 1, 2].map((i) => ({ product_id: prod.id, storage_path: `https://res.cloudinary.com/x/image/upload/studentmarket/products/sec${i}.jpg`, is_primary: i === 0, sort_order: i })))
  const { data: order } = await admin.from('orders').insert({ buyer_id: buyer.profileId, seller_id: seller.profileId, status: 'CREATED', subtotal: 500, delivery_charge: 150, platform_fee: 20, total: 670, delivery_method: 'LOCAL_DELIVERY', delivery_address: { address_line: 'Secret house 12', landmark: 'Secret landmark', contact: { phone: '9811111111' } }, meeting_location: 'Secret house 12' }).select('id').single()
  made.orders.push(order.id)

  console.log('\n— API: authentication & authorization —')
  const guestChecks = [['GET', '/api/orders'], ['GET', '/api/orders/' + order.id], ['GET', '/api/wallet'], ['POST', '/api/wallet/withdraw'], ['POST', '/api/payments/esewa/initiate'], ['POST', '/api/products'], ['POST', '/api/products/photos'], ['GET', '/api/geocode?q=thamel'], ['GET', '/api/admin/verification']]
  for (const [m, p] of guestChecks) {
    const r = await api(null, p, { method: m, body: m === 'POST' ? '{}' : undefined })
    check('A1', `unauthenticated ${m} ${p.split('?')[0].replace(order.id, ':id')} is refused`, r.status === 401 || [403, 404].includes(r.status), `status ${r.status}`)
  }
  let r = await api(null, '/api/cart'); const gj = await r.json().catch(() => ({}))
  check('A1', 'guest cart is simply empty (no data leak)', r.status === 200 && (gj.items ?? []).length === 0)
  r = await api(buyer2, `/api/orders/${order.id}`); check('A2', "IDOR: user B cannot read user A's order", r.status === 403 || r.status === 404, `status ${r.status}`)
  r = await api(buyer, `/api/orders/${order.id}`); check('A3', 'buyer can read own order', r.status === 200)
  r = await api(seller, `/api/orders/${order.id}`); const blob = await r.text()
  const leak = blob.match(/Secret house|Secret landmark|9811111111|9800000000/)
  check('A4', "seller cannot see buyer's delivery address / phone in the order API", r.status === 200 && !leak, leak ? leak[0] : '')
  r = await post(buyer2, `/api/orders/${order.id}/status`, { status: 'BUYER_CONFIRMED' }); check('A5', "stranger cannot change another order's status", [403, 404].includes(r.status), `status ${r.status}`)
  r = await post(buyer, `/api/orders/${order.id}/status`, { status: 'PAYMENT_CONFIRMED' }); check('A6', 'buyer cannot mark own order as paid', [400, 403, 409].includes(r.status), `status ${r.status}`)
  r = await post(seller, `/api/orders/${order.id}/status`, { status: 'PAYMENT_CONFIRMED' }); check('A7', 'seller cannot mark the order as paid', [400, 403, 409].includes(r.status), `status ${r.status}`)
  r = await api(buyer2, `/api/products/${prod.id}`, { method: 'PATCH', body: JSON.stringify({ price: 1 }) }); check('A8', "user B cannot edit user A's listing", r.status === 403 || r.status === 404, `status ${r.status}`)
  r = await api(buyer2, `/api/products/${prod.id}`, { method: 'DELETE' }); check('A9', "user B cannot delete user A's listing", r.status === 403 || r.status === 404, `status ${r.status}`)
  r = await api(seller, `/api/products/${prod.id}`, { method: 'PATCH', body: JSON.stringify({ price: 400, seller_id: buyer.profileId, role: 'admin' }) }); check('A10', 'mass assignment: unknown fields (seller_id, role) rejected', r.status === 400, `status ${r.status}`)
  r = await api(buyer, '/api/admin/verification'); check('A11', 'non-admin cannot use the admin API', [403, 404].includes(r.status), `status ${r.status}`)
  r = await post(buyer, '/api/wallet/release', { orderId: order.id }); check('A12', 'internal release endpoint refuses users', r.status === 401)
  r = await post(buyer, '/api/admin/users', { userId: buyer.profileId, action: 'activate' }); check('A13', 'non-admin cannot moderate users', r.status === 401 || r.status === 403 || r.status === 404, `status ${r.status}`)

  console.log('\n— API: payments & business logic —')
  r = await post(buyer2, '/api/payments/esewa/initiate', { orderId: order.id }); check('P1', "user B cannot start payment for user A's order", [403, 404].includes(r.status), `status ${r.status}`)
  const forged = Buffer.from(JSON.stringify({ transaction_uuid: 'x', total_amount: '670', status: 'COMPLETE', signature: 'forged', signed_field_names: 'a' })).toString('base64')
  r = await fetch(BASE + '/api/payments/esewa/verify?data=' + forged, { redirect: 'manual' })
  check('P2', 'forged payment callback does not confirm anything', r.status >= 300 && r.status < 400 && /error/.test(r.headers.get('location') || ''), r.headers.get('location') || '')
  r = await post(buyer, '/api/orders', { payment_method: 'esewa', total: 1, subtotal: 1, delivery: {}, contact: {} }); check('P3', 'order creation refuses client-supplied totals / incomplete data', r.status === 400, `status ${r.status}`)
  r = await post(buyer, '/api/cart', { productId: prod.id, quantity: 1 }); check('P4', 'unverified BUYER can add to cart (buying needs no ID check)', r.status === 201 || r.status === 409, `status ${r.status}`)
  r = await api(buyer, '/api/cart', { method: 'PATCH', body: JSON.stringify({ productId: prod.id, quantity: 500 }) }); check('P5', 'cart quantity above stock refused', r.status === 409 || r.status === 400, `status ${r.status}`)
  r = await api(buyer, '/api/cart', { method: 'PATCH', body: JSON.stringify({ productId: prod.id, quantity: -3 }) }); check('P6', 'negative quantity refused', r.status === 400, `status ${r.status}`)

  console.log('\n— API: listings, photos, uploads —')
  const form = (obj) => { const fd = new FormData(); fd.append('data', JSON.stringify(obj)); return fd }
  const base = { category: 'books', title: 'Sec listing', description: 'Long enough description here', condition: 'GOOD', price: 100, negotiable: false }
  const list = (u, refs) => fetch(BASE + '/api/products', { method: 'POST', headers: { cookie: u.cookie }, body: form({ ...base, photo_refs: refs }) })
  const ok = (i) => `${seller.profileId}/x${i}.jpg`
  r = await list(seller, []); check('L1', 'listing with 0 photos refused', r.status === 400, `status ${r.status}`)
  r = await list(seller, [ok(1), ok(2)]); check('L2', 'listing with 2 photos refused', r.status === 400, `status ${r.status}`)
  r = await list(seller, [1, 2, 3, 4, 5, 6, 7].map(ok)); check('L3', 'listing with 7 photos refused', r.status === 400, `status ${r.status}`)
  r = await list(seller, ['a', 'b', 'c'].map((n) => `${buyer.profileId}/${n}.jpg`)); check('L4', "cannot attach ANOTHER user's uploaded photos", r.status === 400, `status ${r.status}`)
  r = await list(seller, [`${seller.profileId}/../${buyer.profileId}/a.jpg`, ok(2), ok(3)]); check('L5', 'path traversal in a photo reference refused', r.status === 400, `status ${r.status}`)
  r = await list(buyer, []); check('L6', 'unverified user cannot create listings', [403, 404].includes(r.status), `status ${r.status}`)
  const fd = new FormData(); fd.append('file', new Blob(['<html><script>alert(1)</script></html>'], { type: 'image/png' }), 'evil.png')
  r = await fetch(BASE + '/api/products/photos', { method: 'POST', headers: { cookie: seller.cookie }, body: fd }); check('L7', 'HTML disguised as a PNG is refused by the photo endpoint', r.status === 400 || r.status === 415, `status ${r.status}`)
  r = await fetch(BASE + '/api/upload', { method: 'POST', headers: { cookie: seller.cookie }, body: new FormData() }); check('L8', 'legacy /api/upload endpoint no longer exists', r.status === 404 || r.status === 405, `status ${r.status}`)

  console.log('\n— Web: headers, CSRF, input caps —')
  r = await fetch(BASE + '/login'); const h = r.headers
  const csp = h.get('content-security-policy') || ''
  check('H1', "CSP has frame-ancestors 'none' and object-src 'none'", /frame-ancestors 'none'/.test(csp) && /object-src 'none'/.test(csp))
  check('H2', 'nosniff + referrer-policy + permissions-policy set', h.get('x-content-type-options') === 'nosniff' && !!h.get('referrer-policy') && !!h.get('permissions-policy'))
  check('H3', 'X-Frame-Options DENY', h.get('x-frame-options') === 'DENY')
  check('H4', 'X-Powered-By hidden', !h.get('x-powered-by'))
  r = await fetch(BASE + '/api/cart', { method: 'POST', headers: { cookie: buyer.cookie, origin: 'https://evil.example', 'Content-Type': 'application/json' }, body: JSON.stringify({ productId: prod.id, quantity: 1 }) }); check('C1', 'cross-site POST (foreign Origin) refused (CSRF)', [403, 404].includes(r.status), `status ${r.status}`)
  r = await fetch(BASE + '/api/products?q=' + 'a'.repeat(5000)); check('I1', 'huge search query is bounded', r.status === 200 || r.status === 400, `status ${r.status}`)
  r = await fetch(BASE + '/api/products?pageSize=100000&page=99999999'); const pj = await r.json().catch(() => ({})); check('I2', 'page size is capped', r.status === 200 && (pj.products?.length ?? 0) <= 50, `${pj.products?.length}`)
  r = await fetch(BASE + '/api/products?q=' + encodeURIComponent("x'),title.ilike.%")); check('I3', 'search filter-injection characters do not break the query', r.status === 200, `status ${r.status}`)
  r = await fetch(BASE + '/api/tiles/13/1/1'); check('I4', 'tile proxy refuses tiles outside our launch cities', [400, 403, 404].includes(r.status), `status ${r.status}`)

  console.log('\n— DB-level (direct PostgREST with the public anon key) [DB] —')
  await buyer.client.from('profiles').update({ verification_status: 'VERIFIED' }).eq('auth_user_id', buyer.id)
  const { data: pAfter } = await admin.from('profiles').select('verification_status').eq('auth_user_id', buyer.id).single()
  check('D1', '[DB] user cannot grant themselves VERIFIED status', pAfter.verification_status !== 'VERIFIED', `now ${pAfter.verification_status}`)
  await buyer.client.from('profiles').update({ total_sales: 999 }).eq('auth_user_id', buyer.id)
  const { data: p2 } = await admin.from('profiles').select('total_sales').eq('auth_user_id', buyer.id).single()
  check('D2', '[DB] user cannot fake their own sales / rating', Number(p2.total_sales) !== 999, `total_sales ${p2.total_sales}`)
  const anonC = createClient(URL_, env.NEXT_PUBLIC_SUPABASE_ANON_KEY, { auth: { persistSession: false } })
  let res = await anonC.from('profiles').select('phone').limit(5)
  check('D3', '[DB] phone numbers are not readable with the public key', !!res.error || !(res.data ?? []).some((p) => p.phone), res.error ? 'refused' : 'READABLE')
  res = await buyer.client.from('orders').insert({ buyer_id: buyer.profileId, seller_id: seller.profileId, status: 'PAYMENT_CONFIRMED', subtotal: 1, total: 1, delivery_method: 'LOCAL_DELIVERY' }).select('id')
  if (res.data?.[0]) made.orders.push(res.data[0].id)
  check('D4', '[DB] user cannot insert an already-"paid" order directly', !!res.error, res.error ? 'refused' : 'CREATED A PAID ORDER')
  res = await seller.client.from('orders').select('delivery_address, meeting_location').eq('id', order.id)
  check('D5', "[DB] seller cannot read the buyer's address columns directly", !!res.error || !(res.data ?? []).some((o) => o.delivery_address), res.error ? 'refused' : 'READABLE')
  const { data: w } = await admin.from('wallets').select('id').eq('seller_id', seller.profileId).maybeSingle()
  if (w) {
    let rp = await seller.client.rpc('credit_seller_pending', { p_seller_id: seller.profileId, p_amount: 1000, p_order_id: order.id })
    check('D6', '[DB] user cannot call the wallet-credit function on themselves', !!rp.error, rp.error ? 'refused' : 'CREDITED')
    rp = await buyer.client.rpc('deduct_wallet_balance', { p_seller_id: seller.profileId, p_amount: 1, p_order_id: order.id, p_transaction_type: 'WITHDRAWAL' })
    check('D7', '[DB] user cannot call the wallet-deduct function on someone else', !!rp.error, rp.error ? 'refused' : 'DEDUCTED')
    rp = await seller.client.rpc('release_pending_to_available', { p_seller_id: seller.profileId, p_amount: 1, p_order_id: order.id })
    check('D8', '[DB] user cannot move pending earnings to available', !!rp.error, rp.error ? 'refused' : 'MOVED')
    res = await seller.client.from('withdrawals').insert({ seller_id: seller.profileId, wallet_id: w.id, amount: 99999, payout_method: 'ESEWA', payout_details: {}, status: 'REQUESTED' }).select('id')
    check('D9', '[DB] user cannot insert a withdrawal row directly', !!res.error, res.error ? 'refused' : 'INSERTED')
  } else check('D6-9', '[DB] wallet checks skipped (no wallet was created)', false)
  await seller.client.from('products').update({ quantity: 5000 }).eq('id', prod.id)
  const { data: pr } = await admin.from('products').select('quantity').eq('id', prod.id).single()
  check('D10', '[DB] seller cannot edit protected product fields (status / stock) directly', pr.quantity !== 5000, `stock ${pr.quantity}`)
  await seller.client.from('product_images').delete().eq('product_id', prod.id)
  const { count } = await admin.from('product_images').select('id', { count: 'exact', head: true }).eq('product_id', prod.id)
  check('D11', '[DB] seller cannot delete photos to dodge the 3-photo minimum', (count ?? 0) >= 3, `${count} photos left`)
  res = await buyer.client.from('audit_logs').insert({ action: 'FORGED', entity_type: 'x' })
  check('D12', '[DB] user cannot write audit logs', !!res.error)
} catch (e) {
  console.error('SUITE ERROR', e)
  process.exitCode = 2
} finally {
  for (const id of made.orders) {
    const dels = (await admin.from('deliveries').select('id').eq('order_id', id)).data ?? []
    if (dels.length) await admin.from('delivery_events').delete().in('delivery_id', dels.map((d) => d.id))
    await admin.from('deliveries').delete().eq('order_id', id)
    await admin.from('order_items').delete().eq('order_id', id)
    await admin.from('wallet_ledger').delete().eq('order_id', id)
    await admin.from('orders').delete().eq('id', id)
  }
  for (const id of made.products) {
    await admin.from('cart_items').delete().eq('product_id', id)
    await admin.from('product_images').delete().eq('product_id', id)
    await admin.from('products').delete().eq('id', id)
  }
  for (const uid of made.users) {
    const { data: p } = await admin.from('profiles').select('id').eq('auth_user_id', uid).maybeSingle()
    if (p) {
      await admin.from('withdrawals').delete().eq('seller_id', p.id)
      await admin.from('wallet_ledger').delete().eq('seller_id', p.id)
      await admin.from('wallets').delete().eq('seller_id', p.id)
      await admin.from('notifications').delete().eq('profile_id', p.id)
    }
    await admin.auth.admin.deleteUser(uid)
  }
  const failed = results.filter((x) => !x.pass)
  console.log(`\n${results.length - failed.length}/${results.length} checks passed${failed.length ? ' — FAILED: ' + failed.map((f) => f.id).join(', ') : ''}`)
  if (failed.length) process.exitCode = 1
}
