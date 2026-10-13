import { verifyWebhookSecretToken, webhookSecretToken, generateLinkCode } from '@/lib/telegram/link'

// Regression test: a security review found the webhook route compared the incoming header with plain `!==`,
// a non-constant-time comparison that can leak the secret one byte at a time via response timing. It must now
// go through verifyWebhookSecretToken, which uses crypto.timingSafeEqual.
describe('Telegram webhook secret check', () => {
  const realToken = webhookSecretToken

  beforeEach(() => { process.env.APP_SECRET = 'test-app-secret-for-telegram-webhook' })

  test('the correct secret is accepted', () => {
    expect(verifyWebhookSecretToken(realToken())).toBe(true)
  })

  test('a missing header is rejected', () => {
    expect(verifyWebhookSecretToken(null)).toBe(false)
  })

  test('an empty string is rejected', () => {
    expect(verifyWebhookSecretToken('')).toBe(false)
  })

  test('a wrong token of the same length is rejected without throwing', () => {
    const wrong = '0'.repeat(realToken().length)
    expect(() => verifyWebhookSecretToken(wrong)).not.toThrow()
    expect(verifyWebhookSecretToken(wrong)).toBe(false)
  })

  test('a token of a different length is rejected without throwing (crypto.timingSafeEqual would otherwise throw)', () => {
    expect(() => verifyWebhookSecretToken(realToken() + 'x')).not.toThrow()
    expect(verifyWebhookSecretToken(realToken() + 'x')).toBe(false)
    expect(verifyWebhookSecretToken(realToken().slice(0, -1))).toBe(false)
  })

  test('the token changes if APP_SECRET changes (not a fixed, guessable value)', () => {
    const a = webhookSecretToken()
    process.env.APP_SECRET = 'a-completely-different-secret'
    const b = webhookSecretToken()
    expect(a).not.toBe(b)
  })
})

describe('Telegram link code', () => {
  test('codes only use the unambiguous alphabet (no 0/O/1/I confusion) and are 8 characters', () => {
    for (let i = 0; i < 50; i++) {
      const code = generateLinkCode()
      expect(code).toHaveLength(8)
      expect(code).toMatch(/^[23456789ABCDEFGHJKLMNPQRSTUVWXYZ]+$/)
    }
  })
})
