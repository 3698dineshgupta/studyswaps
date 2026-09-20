import { rateLimit } from '@/lib/security/rateLimit'

// Runs only when REDIS_URL is set (e.g. REDIS_URL=... npx jest tests/security/redis.test.ts)
const maybe = process.env.REDIS_URL ? describe : describe.skip
maybe('Redis-backed rate limiting', () => {
  test('counts in Redis and returns 429 after the limit', async () => {
    const id = `t${Date.now()}`
    const req = new Request('http://localhost/x', { headers: { 'x-forwarded-for': '203.0.113.77' } })
    const rule = { name: `redis-test-${id}`, limit: 2, windowMs: 20_000 }
    expect(await rateLimit(req, rule)).toBeNull()
    expect(await rateLimit(req, rule)).toBeNull()
    expect((await rateLimit(req, rule))?.status).toBe(429)
  })
})
