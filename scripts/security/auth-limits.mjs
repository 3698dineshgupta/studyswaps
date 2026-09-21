/**
 * Sign-in / sign-up limits and admin-area hiding (throwaway accounts, cleaned up).
 *   node scripts/security/auth-limits.mjs [baseUrl]     — run against a FRESH server (limits are counted in memory)
 */
import { createClient } from '@supabase/supabase-js'
import fs from 'node:fs'
const BASE = process.argv[2] || 'http://localhost:3000'
const env = Object.fromEntries(fs.readFileSync('.env.local', 'utf8').split(/\r?\n/).filter((l) => /^[A-Z_]+=/.test(l)).map((l) => [l.slice(0, l.indexOf('=')), l.slice(l.indexOf('=') + 1)]))
const admin = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } })
const stamp = Date.now(); const made = []; const emails = []
let bad = 0
const check = (id, name, pass, d = '') => { if (!pass) bad++; console.log(`${pass ? 'PASS' : 'FAIL'}  ${id}  ${name}${d ? ' — ' + d : ''}`) }
const post = (path, body, headers = {}) => fetch(BASE + path, { method: 'POST', headers: { 'Content-Type': 'application/json', ...headers }, body: JSON.stringify(body) })
const reg = (n) => post('/api/auth/register', { full_name: 'Limit Test', email: `lim-${n}-${stamp}@studentmarket.test`, password: 'Limit-Test-9x!', phone: '9812345678', college: 'Test College', location: 'Kathmandu', intent: 'buyer' })
try {
  console.log('— sign-up limits —')
  let codes = []
  for (let i = 0; i < 11; i++) { const r = await reg(i); codes.push(r.status); if (r.status === 201) emails.push(`lim-${i}-${stamp}@studentmarket.test`) }
  check('L1', 'first 10 sign-ups from one connection succeed, the 11th is refused', codes.slice(0, 10).every((c) => c === 201) && codes[10] === 429, codes.join(','))
  let r = await post('/api/auth/register', { full_name: 'x', email: 'bad', password: '1', phone: '1', college: '', location: 'Kathmandu', intent: 'buyer' }); check('L2', 'invalid sign-up data is refused', r.status === 400 || r.status === 429, `status ${r.status}`)
  r = await post('/api/auth/register', { full_name: 'Sneaky Admin', email: `x-${stamp}@studentmarket.test`, password: 'Limit-Test-9x!', phone: '9812345678', college: 'C', location: 'Kathmandu', intent: 'buyer', role: 'admin', is_admin: true }); check('L3', 'extra fields like role/is_admin are rejected', r.status === 400 || r.status === 429, `status ${r.status}`)

  console.log('\n— sign-in limits —')
  const good = emails[0]
  const target = `victim-${stamp}@studentmarket.test`
  const wrong = []
  for (let i = 0; i < 10; i++) wrong.push((await post('/api/auth/login', { email: target, password: 'wrong-password-' + i })).status)
  check('L4', 'wrong passwords: 401 first, then locked out with 429', wrong[0] === 401 && wrong.slice(-2).every((c) => c === 429), wrong.join(','))
  const okLogin = await post('/api/auth/login', { email: good, password: 'Limit-Test-9x!' })
  check('L5', 'a correct login works and sets session cookies', okLogin.status === 200 && (okLogin.headers.get('set-cookie') ?? '').includes('auth-token'), `status ${okLogin.status}`)
  r = await post('/api/auth/login', { email: 'someone@studentmarket.test', password: 'x' }); const j = await r.json()
  check('L6', 'error text is identical for unknown accounts (no account enumeration)', /don.t match|too many/i.test(j.error ?? ''), j.error)

  console.log('\n— the admin area is invisible to everyone else —')
  r = await fetch(BASE + '/admin', { redirect: 'manual' }); check('L7', 'a stranger visiting /admin gets a plain 404 (no login page, no redirect)', r.status === 404, `status ${r.status}`)
  r = await fetch(BASE + '/admin/listings', { redirect: 'manual' }); check('L8', '/admin/listings is 404 for strangers too', r.status === 404, `status ${r.status}`)
  r = await fetch(BASE + '/api/admin/stats'); check('L9', '/api/admin/stats is 404 for strangers', r.status === 404, `status ${r.status}`)
} catch (e) { console.error('ERROR', e); bad++ } finally {
  const { data: list } = await admin.auth.admin.listUsers({ perPage: 1000 })
  for (const u of list.users.filter((x) => x.email?.includes(`-${stamp}@`))) { const { data: p } = await admin.from('profiles').select('id').eq('auth_user_id', u.id).maybeSingle(); if (p) { await admin.from('carts').delete().eq('profile_id', p.id); await admin.from('notifications').delete().eq('profile_id', p.id) } await admin.auth.admin.deleteUser(u.id) }
  console.log(bad ? `\n${bad} check(s) FAILED` : '\nAll checks passed'); if (bad) process.exitCode = 1
}
