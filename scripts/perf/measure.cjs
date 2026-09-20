/**
 * Repeatable performance measurement (real numbers, no estimates).
 *
 *   node scripts/perf/measure.cjs [baseUrl] [label]
 *
 * Use a PRODUCTION build (next build && next start), otherwise the numbers are dominated by dev-mode compilation.
 * Pages are loaded cold (empty cache) in two profiles:
 *   • desktop  : no throttling
 *   • mobile   : Fast-4G network (1.6 Mbps down, 150 ms RTT) + 4x slower CPU + phone viewport  (low-end Android)
 * Reports TTFB, FCP, LCP, CLS, load time, requests, transferred KB by type. Also API latency (median of 7).
 */
const { chromium } = require('@playwright/test')
const { createClient } = require('@supabase/supabase-js')
const fs = require('fs')

const BASE = process.argv[2] || 'http://localhost:3000'
const LABEL = process.argv[3] || 'run'
const env = Object.fromEntries(fs.readFileSync('.env.local', 'utf8').split(/\r?\n/).filter((l) => /^[A-Z_]+=/.test(l)).map((l) => [l.slice(0, l.indexOf('=')), l.slice(l.indexOf('=') + 1)]))

async function session() {
  const anon = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_ANON_KEY, { auth: { persistSession: false } })
  const { data } = await anon.auth.signInWithPassword({ email: 'buyer@studentmarket.test', password: process.env.DEMO_PASSWORD })
  if (!data?.session) return null
  const name = `sb-${new URL(env.NEXT_PUBLIC_SUPABASE_URL).hostname.split('.')[0]}-auth-token`
  const enc = encodeURIComponent(JSON.stringify(data.session)), ch = []
  for (let i = 0; i < enc.length; i += 3180) ch.push(enc.slice(i, i + 3180))
  return { cookies: ch.map((c, i) => ({ name: ch.length === 1 ? name : `${name}.${i}`, value: c, url: BASE })), header: ch.map((c, i) => `${ch.length === 1 ? name : `${name}.${i}`}=${c}`).join('; ') }
}

const median = (a) => { const s = [...a].sort((x, y) => x - y); return s[Math.floor(s.length / 2)] }

async function measurePage(browser, profile, path, sess) {
  const ctx = await browser.newContext(profile.context)
  await ctx.addCookies([{ name: 'sm_city', value: 'kathmandu', url: BASE }, ...(sess ? sess.cookies : [])])
  const page = await ctx.newPage()
  const cdp = await ctx.newCDPSession(page)
  if (profile.throttle) {
    await cdp.send('Network.enable')
    await cdp.send('Network.emulateNetworkConditions', { offline: false, latency: 150, downloadThroughput: (1.6 * 1024 * 1024) / 8, uploadThroughput: (750 * 1024) / 8 })
    await cdp.send('Emulation.setCPUThrottlingRate', { rate: 4 })
  }
  const stats = { requests: 0, js: 0, css: 0, img: 0, font: 0, api: 0, other: 0, total: 0 }
  page.on('response', async (r) => {
    try {
      const len = Number(r.headers()['content-length'] || 0) || (await r.body().catch(() => Buffer.alloc(0))).length
      const t = r.request().resourceType(); stats.requests++; stats.total += len
      if (t === 'script') stats.js += len; else if (t === 'stylesheet') stats.css += len; else if (t === 'image') stats.img += len; else if (t === 'font') stats.font += len
      else if (r.url().includes('/api/')) stats.api += len; else stats.other += len
    } catch { /* ignore */ }
  })
  await page.addInitScript(() => {
    window.__m = { lcp: 0, cls: 0, fcp: 0 }
    new PerformanceObserver((l) => { for (const e of l.getEntries()) window.__m.lcp = e.startTime }).observe({ type: 'largest-contentful-paint', buffered: true })
    new PerformanceObserver((l) => { for (const e of l.getEntries()) if (!e.hadRecentInput) window.__m.cls += e.value }).observe({ type: 'layout-shift', buffered: true })
    new PerformanceObserver((l) => { for (const e of l.getEntries()) if (e.name === 'first-contentful-paint') window.__m.fcp = e.startTime }).observe({ type: 'paint', buffered: true })
  })
  const t0 = Date.now()
  await page.goto(BASE + path, { waitUntil: 'load', timeout: 180000 }).catch(() => {})
  await page.waitForLoadState('networkidle', { timeout: 60000 }).catch(() => {})
  await page.waitForTimeout(800)
  const m = await page.evaluate(() => { const n = performance.getEntriesByType('navigation')[0]; return { ...window.__m, ttfb: n.responseStart, dcl: n.domContentLoadedEventEnd, load: n.loadEventEnd } })
  await ctx.close()
  return { ttfb: Math.round(m.ttfb), fcp: Math.round(m.fcp), lcp: Math.round(m.lcp), cls: +m.cls.toFixed(3), load: Math.round(m.load), reqs: stats.requests, totalKB: Math.round(stats.total / 1024), jsKB: Math.round(stats.js / 1024), imgKB: Math.round(stats.img / 1024), fontKB: Math.round(stats.font / 1024), cssKB: Math.round(stats.css / 1024), apiKB: +(stats.api / 1024).toFixed(1), wall: Date.now() - t0 }
}

;(async () => {
  const sess = await session()
  const list = await (await fetch(BASE + '/api/products?city=kathmandu&limit=5')).json()
  const pid = list.products?.[0]?.id
  const browser = await chromium.launch()
  const profiles = {
    desktop: { context: { viewport: { width: 1440, height: 900 } }, throttle: false },
    mobile: { context: { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2, userAgent: 'Mozilla/5.0 (Linux; Android 11; SM-A125F) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120 Mobile Safari/537.36' }, throttle: true },
  }
  const pages = [['home (guest)', '/', false], ['browse (guest)', '/browse', false], ['product page (guest)', `/product/${pid}`, false], ['login', '/login', false], ['home (signed in)', '/', true], ['cart (signed in)', '/cart', true]]
  const out = { label: LABEL, base: BASE, pages: {}, api: {} }
  for (const [pname, p] of Object.entries(profiles)) {
    for (const [name, path, auth] of pages) {
      if (auth && !sess) continue
      const runs = []
      for (let i = 0; i < 3; i++) runs.push(await measurePage(browser, p, path, auth ? sess : null))
      const pick = (k) => median(runs.map((r) => r[k]))
      const row = Object.fromEntries(Object.keys(runs[0]).map((k) => [k, k === 'cls' ? runs[0].cls : pick(k)]))
      out.pages[`${pname} · ${name}`] = row
      console.log(`${pname.padEnd(8)} ${name.padEnd(22)} TTFB ${String(row.ttfb).padStart(5)}ms  FCP ${String(row.fcp).padStart(5)}  LCP ${String(row.lcp).padStart(5)}  load ${String(row.load).padStart(5)}  CLS ${row.cls}  reqs ${row.reqs}  ${row.totalKB}KB (js ${row.jsKB} img ${row.imgKB} font ${row.fontKB} css ${row.cssKB} api ${row.apiKB})`)
    }
  }
  const apis = [['GET /api/products (list)', '/api/products?city=kathmandu&limit=20', false], ['GET /api/products?q=', '/api/products?city=kathmandu&q=lamp', false], ['GET /api/products/:id', `/api/products/${pid}`, false], ['GET /api/cart (guest)', '/api/cart', false], ['GET /api/cart (signed in)', '/api/cart', true], ['GET /api/orders (signed in)', '/api/orders', true]]
  for (const [name, path, auth] of apis) {
    if (auth && !sess) continue
    const t = []
    for (let i = 0; i < 7; i++) { const s = performance.now(); const r = await fetch(BASE + path, { headers: auth ? { cookie: sess.header } : {} }); const b = await r.arrayBuffer(); t.push({ ms: performance.now() - s, kb: b.byteLength / 1024 }) }
    out.api[name] = { medianMs: Math.round(median(t.map((x) => x.ms))), kb: +median(t.map((x) => x.kb)).toFixed(1) }
    console.log(`${name.padEnd(30)} median ${out.api[name].medianMs}ms  ${out.api[name].kb} KB`)
  }
  fs.mkdirSync('scripts/perf/results', { recursive: true }); fs.writeFileSync(`scripts/perf/results/${LABEL}.json`, JSON.stringify(out, null, 2))
  await browser.close()
})().catch((e) => { console.error('ERR', e); process.exit(1) })
