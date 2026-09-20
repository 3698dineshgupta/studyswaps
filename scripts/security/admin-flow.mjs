/**
 * End-to-end check of the listing approval flow and the admin API permissions (throwaway users, cleaned up).
 *   node scripts/security/admin-flow.mjs [baseUrl]
 */
import { createClient } from '@supabase/supabase-js'
import fs from 'node:fs'

const BASE = process.argv[2] || 'http://localhost:3000'
const env = Object.fromEntries(fs.readFileSync('.env.local', 'utf8').split(/\r?\n/).filter((l) => /^[A-Z_]+=/.test(l)).map((l) => [l.slice(0, l.indexOf('=')), l.slice(l.indexOf('=') + 1)]))
const URL_ = env.NEXT_PUBLIC_SUPABASE_URL
const admin = createClient(URL_, env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } })
const results = []
const check = (id, name, pass, detail = '') => { results.push(pass); console.log(`${pass ? 'PASS' : 'FAIL'}  ${id}  ${name}${detail ? '  — ' + detail : ''}`) }
const stamp = Date.now()
const made = []

async function mkUser(tag, { verified = false, role = null } = {}) {
  const email = `flow-${tag}-${stamp}@studentmarket.test`
  const password = 'Flow-Test-9x!' + stamp
  const { data, error } = await admin.auth.admin.createUser({ email, password, email_confirm: true, user_metadata: { full_name: `Flow ${tag}` } })
  if (error) throw error
  made.push(data.user.id)
  await new Promise((r) => setTimeout(r, 500))
  await admin.from('profiles').update({ phone: '9800000001', location: 'Kathmandu', ...(verified ? { verification_status: 'VERIFIED', is_seller: true } : {}) }).eq('auth_user_id', data.user.id)
  const { data: p } = await admin.from('profiles').select('id').eq('auth_user_id', data.user.id).single()
  if (role) await admin.from('admin_roles').insert({ profile_id: p.id, role, is_active: true })
  const anon = createClient(URL_, env.NEXT_PUBLIC_SUPABASE_ANON_KEY, { auth: { persistSession: false } })
  const { data: s } = await anon.auth.signInWithPassword({ email, password })
  const ref = new URL(URL_).hostname.split('.')[0]
  const name = `sb-${ref}-auth-token`
  const enc = encodeURIComponent(JSON.stringify(s.session))
  const ch = []
  for (let i = 0; i < enc.length; i += 3180) ch.push(enc.slice(i, i + 3180))
  return { profileId: p.id, cookie: ch.map((c, i) => `${ch.length === 1 ? name : `${name}.${i}`}=${c}`).join('; ') }
}
const call = (u, path, init = {}) => fetch(BASE + path, { ...init, headers: { ...(init.headers || {}), cookie: u.cookie, ...(typeof init.body === 'string' ? { 'Content-Type': 'application/json' } : {}) } })
const post = (u, path, body) => call(u, path, { method: 'POST', body: JSON.stringify(body) })

let listingId
try {
  const seller = await mkUser('seller', { verified: true })
  const buyer = await mkUser('buyer')
  const boss = await mkUser('admin', { role: 'ADMIN' })

  console.log('\n— seller posts a listing —')
  const fd = new FormData()
  fd.append('data', JSON.stringify({
    category: 'books', title: 'Flow test book', description: 'A description long enough to be valid', condition: 'GOOD', price: 250, negotiable: false,
    location: 'Baneshwor, Kathmandu', photo_refs: [1, 2, 3].map((i) => `${seller.profileId}/flow${i}.jpg`),
    pickup: undefined,
  }))
  let r = await fetch(BASE + '/api/products', { method: 'POST', headers: { cookie: seller.cookie }, body: fd })
  const created = await r.json().catch(() => ({}))
  listingId = created.id
  check('F1', 'listing is accepted and comes back as PENDING_REVIEW', r.status === 201 && created.status === 'PENDING_REVIEW', `status ${r.status} ${created.error ?? ''}`)
  const { data: row } = await admin.from('products').select('status').eq('id', listingId).single()
  check('F2', 'database row is PENDING_REVIEW (not live)', row?.status === 'PENDING_REVIEW')
  r = await fetch(BASE + '/api/products?city=all&q=Flow%20test%20book'); let j = await r.json()
  check('F3', 'NOT visible on the public marketplace while pending', !(j.products ?? []).some((p) => p.id === listingId))

  console.log('\n— admin queue and permissions —')
  r = await call(buyer, '/api/admin/listings'); check('F4', 'a normal user cannot open the moderation queue', [403, 404].includes(r.status), `status ${r.status}`)
  r = await call(seller, '/api/admin/listings'); check('F5', 'the seller cannot open the moderation queue either', [403, 404].includes(r.status))
  r = await post(seller, '/api/admin/listings', { id: listingId, action: 'approve' }); check('F6', 'the seller cannot approve their own listing', [403, 404].includes(r.status))
  r = await call(boss, '/api/admin/listings?status=PENDING_REVIEW'); j = await r.json()
  check('F7', 'admin sees it in the queue', r.status === 200 && (j.listings ?? []).some((l) => l.id === listingId), `status ${r.status}`)
  r = await post(boss, '/api/admin/listings', { id: listingId, action: 'reject' }); check('F8', 'rejecting needs a reason', r.status === 400)
  r = await post(boss, '/api/admin/listings', { id: listingId, action: 'approve', extra: 'x' }); check('F9', 'unknown fields are rejected', r.status === 400)

  console.log('\n— approve —')
  r = await post(boss, '/api/admin/listings', { id: listingId, action: 'approve' }); check('F10', 'admin approves', r.status === 200, `status ${r.status}`)
  const { data: row2 } = await admin.from('products').select('status').eq('id', listingId).single()
  check('F11', 'listing is now ACTIVE', row2?.status === 'ACTIVE')
  r = await fetch(BASE + '/api/products?city=all&q=Flow%20test%20book'); j = await r.json()
  check('F12', 'now visible on the marketplace', (j.products ?? []).some((p) => p.id === listingId))
  const { data: notes } = await admin.from('notifications').select('title').eq('profile_id', seller.profileId)
  check('F13', 'seller got an in-app notification', (notes ?? []).some((n) => /live/i.test(n.title)), (notes ?? []).map((n) => n.title).join(' | '))
  const { data: logs } = await admin.from('audit_logs').select('action').eq('entity_id', listingId)
  check('F14', 'approval is in the audit log', (logs ?? []).some((l) => l.action === 'LISTING_APPROVE'))
  r = await post(boss, '/api/admin/listings', { id: listingId, action: 'approve' }); check('F15', 'approving twice is refused (no double action)', r.status === 409, `status ${r.status}`)
  r = await post(boss, '/api/admin/listings', { id: listingId, action: 'suspend', reason: 'testing take-down' }); check('F16', 'admin can take a live listing down', r.status === 200)
  r = await fetch(BASE + '/api/products?city=all&q=Flow%20test%20book'); j = await r.json()
  check('F17', 'taken-down listing disappears from the marketplace', !(j.products ?? []).some((p) => p.id === listingId))

  console.log('\n— other admin tools: admin allowed, normal user refused —')
  for (const p of ['/api/admin/stats', '/api/admin/orders', '/api/admin/withdrawals', '/api/admin/disputes', '/api/admin/audit', '/api/admin/users']) {
    const a = await call(boss, p), u = await call(buyer, p)
    check('F18', `${p}: admin ${a.status}, normal user ${u.status}`, a.status === 200 && [403, 404].includes(u.status))
  }
  r = await post(buyer, '/api/admin/users', { userId: seller.profileId, action: 'ban' }); check('F19', 'a normal user cannot ban anyone', [403, 404].includes(r.status))
  r = await post(boss, '/api/admin/users', { userId: boss.profileId, action: 'ban' }); check('F20', 'an admin cannot ban themselves', r.status === 400)
  r = await post(boss, '/api/admin/orders', { id: listingId, status: 'PAYMENT_CONFIRMED' }); check('F21', 'admins cannot mark an order "paid" by hand', r.status === 400)
} catch (e) {
  console.error('FLOW ERROR', e)
  process.exitCode = 2
} finally {
  if (listingId) { await admin.from('product_images').delete().eq('product_id', listingId); await admin.from('products').delete().eq('id', listingId) }
  for (const uid of made) {
    const { data: p } = await admin.from('profiles').select('id').eq('auth_user_id', uid).maybeSingle()
    if (p) { await admin.from('admin_roles').delete().eq('profile_id', p.id); await admin.from('notifications').delete().eq('profile_id', p.id); await admin.from('audit_logs').delete().eq('actor_id', p.id) }
    await admin.auth.admin.deleteUser(uid)
  }
  const failed = results.filter((x) => !x).length
  console.log(`\n${results.length - failed}/${results.length} checks passed`)
  if (failed) process.exitCode = 1
}
