import { cityFromText, cityOfPoint, cityOrFilter } from '@/lib/cities'
import { PLATFORM_FEE, SELLER_COMMISSION_RATE, commissionFor, deliveryFeeForKm, priceOrder } from '@/lib/pricing'
import { rateLimit } from '@/lib/security/rateLimit'
import { verifyImage } from '@/lib/security/imageCheck'
import sharp from 'sharp'

describe('city rules', () => {
  test('listing text maps to the right launch city', () => {
    expect(cityFromText('Baneshwor, Kathmandu')).toBe('kathmandu')
    expect(cityFromText('Traffic Chowk, Butwal-04')).toBe('butwal')
    expect(cityFromText('Pokhara')).toBeNull()
  })
  test('map points outside both cities are refused', () => {
    expect(cityOfPoint(27.7006, 83.4483)).toBe('butwal')
    expect(cityOfPoint(27.7172, 85.324)).toBe('kathmandu')
    expect(cityOfPoint(28.2096, 83.9856)).toBeNull() // Pokhara
    expect(cityOfPoint(27.0, 84.5)).toBeNull()
  })
  test('city filter contains only fixed keywords (no user input can reach it)', () => {
    expect(cityOrFilter('butwal')).toMatch(/^(location\.ilike\.%[a-z]+%,?)+$/)
  })
})

describe('server-side pricing (the browser never supplies money values)', () => {
  test('delivery: Rs 150 within 10 km, +Rs 25 per started km beyond', () => {
    expect(deliveryFeeForKm(3)).toBe(150)
    expect(deliveryFeeForKm(10)).toBe(150)
    expect(deliveryFeeForKm(10.1)).toBe(175)
    expect(deliveryFeeForKm(14.2)).toBe(150 + 5 * 25)
  })
  test('total = items + delivery + platform fee; seller net = price - 5%', () => {
    const p = priceOrder(1000, 4)
    expect(p.deliveryFee).toBe(150)
    expect(p.platformFee).toBe(PLATFORM_FEE)
    expect(p.total).toBe(1000 + 150 + PLATFORM_FEE)
    expect(p.sellerNet).toBe(1000 - commissionFor(1000))
    expect(commissionFor(1000)).toBeCloseTo(1000 * SELLER_COMMISSION_RATE)
  })
  test('the fee cannot be lowered by a negative distance', () => {
    expect(deliveryFeeForKm(-50)).toBeGreaterThanOrEqual(150)
  })
})

describe('rate limiting', () => {
  test('returns 429 after the limit, with Retry-After', async () => {
    const req = new Request('http://localhost/api/x', { headers: { 'x-forwarded-for': '203.0.113.9' } })
    const rule = { name: 'unit-test', limit: 3, windowMs: 60_000 }
    for (let i = 0; i < 3; i++) expect(await rateLimit(req, rule)).toBeNull()
    const blocked = await rateLimit(req, rule)
    expect(blocked?.status).toBe(429)
    expect(Number(blocked?.headers.get('Retry-After'))).toBeGreaterThan(0)
  })
  test('one IP being limited does not block another', async () => {
    const rule = { name: 'unit-test-2', limit: 1, windowMs: 60_000 }
    const a = new Request('http://localhost/', { headers: { 'x-forwarded-for': '198.51.100.1' } })
    const b = new Request('http://localhost/', { headers: { 'x-forwarded-for': '198.51.100.2' } })
    await rateLimit(a, rule); expect((await rateLimit(a, rule))?.status).toBe(429)
    expect(await rateLimit(b, rule)).toBeNull()
  })
})

describe('upload verification reads real bytes, not the declared type', () => {
  const file = (data: BlobPart, name: string, type: string) => new File([data], name, { type })
  test('HTML renamed to .png is rejected', async () => {
    expect((await verifyImage(file('<html><script>alert(1)</script></html>', 'x.png', 'image/png'))).ok).toBe(false)
  })
  test('SVG is rejected even with an image type', async () => {
    expect((await verifyImage(file('<svg xmlns="http://www.w3.org/2000/svg"><script>1</script></svg>', 'x.png', 'image/png'))).ok).toBe(false)
  })
  test('a real photo is accepted', async () => {
    const buf = await sharp({ create: { width: 400, height: 300, channels: 3, background: '#3a7' } }).jpeg().toBuffer()
    expect((await verifyImage(file(buf, 'p.jpg', 'image/jpeg'))).ok).toBe(true)
  })
  test('absurdly large dimensions are rejected (decompression bomb)', async () => {
    const buf = await sharp({ create: { width: 9000, height: 9000, channels: 3, background: '#000' } }).png({ compressionLevel: 9 }).toBuffer()
    expect((await verifyImage(file(buf, 'big.png', 'image/png'))).ok).toBe(false)
  })
})
