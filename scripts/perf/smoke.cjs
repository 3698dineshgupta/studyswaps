/** Functional smoke test of the optimized site (run against a production build): node scripts/perf/smoke.cjs http://localhost:3200 */
const { chromium } = require('@playwright/test'); const { createClient } = require('@supabase/supabase-js'); const fs = require('fs')
const BASE = process.argv[2] || 'http://localhost:3000'
;(async () => {
  const env = Object.fromEntries(fs.readFileSync('.env.local', 'utf8').split(/\r?\n/).filter((l) => /^[A-Z_]+=/.test(l)).map((l) => [l.slice(0, l.indexOf('=')), l.slice(l.indexOf('=') + 1)]))
  const admin = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } })
  const anon = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_ANON_KEY, { auth: { persistSession: false } })
  const { data } = await anon.auth.signInWithPassword({ email: 'buyer@studentmarket.test', password: process.env.DEMO_PASSWORD })
  const name = `sb-${new URL(env.NEXT_PUBLIC_SUPABASE_URL).hostname.split('.')[0]}-auth-token`, enc = encodeURIComponent(JSON.stringify(data.session)), ch = []
  for (let i = 0; i < enc.length; i += 3180) ch.push(enc.slice(i, i + 3180))
  const cookies = [...ch.map((c, i) => ({ name: ch.length === 1 ? name : `${name}.${i}`, value: c, url: BASE })), { name: 'sm_city', value: 'kathmandu', url: BASE }]
  const { data: prof } = await admin.from('profiles').select('id').eq('auth_user_id', data.user.id).single()
  const { data: cart } = await admin.from('carts').select('id').eq('profile_id', prof.id).maybeSingle()
  const before = cart ? (await admin.from('cart_items').select('product_id').eq('cart_id', cart.id)).data.map((r) => r.product_id) : []
  const b = await chromium.launch(); const errs = []
  const ok = (n, p, d = '') => console.log(`${p ? 'PASS' : 'FAIL'}  ${n}${d ? ' — ' + d : ''}`)
  try {
    const g = await (await b.newContext({ viewport: { width: 1440, height: 900 } })).newPage(); g.on('pageerror', (e) => errs.push(e.message.slice(0, 100))); g.on('console', (m) => m.type() === 'error' && errs.push(m.text().slice(0, 120)))
    await g.context().addCookies([{ name: 'sm_city', value: 'kathmandu', url: BASE }])
    await g.goto(BASE + '/', { waitUntil: 'networkidle' }); await g.waitForTimeout(800)
    ok('home renders hero + cards', (await g.locator('h1').innerText()).includes('Everything Students Need') && (await g.locator('article').count()) > 0, `${await g.locator('article').count()} cards`)
    ok('guest home: browser Supabase client NOT downloaded', !(await g.evaluate(() => performance.getEntriesByType('resource').some((r) => /GoTrue|supabase/i.test(r.name)))))
    await g.goto(BASE + '/browse', { waitUntil: 'networkidle' })
    ok('browse arrives with first results already in the page', (await g.locator('article').count()) > 0)
    let reqs = 0; g.on('request', (r) => r.url().includes('/api/products?') && reqs++)
    await g.getByPlaceholder('Search within results…').pressSequentially('lamp', { delay: 70 }); await g.waitForTimeout(1500)
    ok('typing "lamp" makes ONE search request (debounced)', reqs === 1, `${reqs} request(s)`)
    ok('search results correct', (await g.locator('article').allInnerTexts()).some((t) => /lamp/i.test(t)))
    await g.goto(BASE + '/browse', { waitUntil: 'networkidle' }); const href = await g.locator('article a[href^="/product/"]').first().getAttribute('href')
    await g.goto(BASE + href, { waitUntil: 'domcontentloaded' })
    ok('product page: title + price are in the server-rendered HTML', /Rs\./.test(await g.content()) && (await g.locator('h1').count()) > 0)
    await g.waitForLoadState('networkidle'); ok('product gallery shows a photo', (await g.locator('img[data-current-photo]').count()) > 0)
    const ctx = await b.newContext({ viewport: { width: 1440, height: 900 } }); await ctx.addCookies(cookies); const p = await ctx.newPage(); p.on('pageerror', (e) => errs.push(e.message.slice(0, 100))); p.on('console', (m) => m.type() === 'error' && errs.push(m.text().slice(0, 120)))
    await p.goto(BASE + '/browse', { waitUntil: 'networkidle' }); await p.waitForTimeout(800)
    ok('signed in: avatar menu on first paint', (await p.getByRole('button', { name: 'Account menu' }).count()) === 1 && (await p.getByRole('link', { name: 'Log in' }).count()) === 0)
    await p.getByRole('button', { name: /^Add .* to cart$/ }).first().click(); await p.waitForTimeout(2500)
    ok('add to cart works (popup shown)', (await p.getByRole('status', { name: 'Cart summary' }).count()) === 1)
    await p.goto(BASE + '/wishlist', { waitUntil: 'networkidle' }); ok('wishlist page loads', (await p.getByRole('heading', { name: /wishlist/i }).count()) > 0)
    await p.goto(BASE + '/notifications', { waitUntil: 'networkidle' }); ok('notifications page loads', (await p.getByRole('heading', { name: /notifications/i }).count()) > 0)
    await p.goto(BASE + '/cart', { waitUntil: 'networkidle' }); ok('cart page loads with items', (await p.locator('li').count()) > 0)
    const mctx = await b.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true }); await mctx.addCookies(cookies); const m = await mctx.newPage()
    await m.goto(BASE + href, { waitUntil: 'networkidle' }); ok('mobile product page: swipe strip + sticky buy bar', (await m.locator('div.snap-x').count()) === 1 && (await m.locator('[data-bottom-bar]').count()) === 1)
    ok('no console errors (CSP nonce, hydration)', errs.length === 0, errs.slice(0, 3).join(' | '))
  } finally {
    await b.close()
    if (cart) { const { data: now } = await admin.from('cart_items').select('id,product_id').eq('cart_id', cart.id); const extra = now.filter((r) => !before.includes(r.product_id)).map((r) => r.id); if (extra.length) await admin.from('cart_items').delete().in('id', extra) }
  }
})().catch((e) => console.error('ERR', e.message))
