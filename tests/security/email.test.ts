import { renderEmail, sendEmail } from '@/lib/email'

describe('emails', () => {
  test('user-controlled text is HTML-escaped (no injected markup in a listing title / reason)', () => {
    const { html } = renderEmail({ name: '<b>Eve</b>', title: 'Listing <script>alert(1)</script>', body: 'Reason: "><img src=x onerror=alert(1)>', ctaPath: '/product/1' })
    expect(html).not.toContain('<script>')
    expect(html).not.toContain('<img src=x')
    expect(html).toContain('&lt;script&gt;')
  })
  test('the button links to our own site', () => {
    expect(renderEmail({ title: 't', body: 'b', ctaPath: '/sell' }).html).toContain('href="http://localhost:3000/sell"')
  })
  test('sends through Resend with a single-line subject (no header injection)', async () => {
    process.env.RESEND_API_KEY = 'test-key'
    const calls: { url: string; body: any }[] = []
    const realFetch = global.fetch
    global.fetch = (async (url: string, init: any) => { calls.push({ url, body: JSON.parse(init.body) }); return { ok: true } }) as any
    const ok = await sendEmail({ to: 'a@b.co', subject: 'Hello\r\nBcc: attacker@evil.com', html: '<p>x</p>', text: 'x' })
    global.fetch = realFetch
    delete process.env.RESEND_API_KEY
    expect(ok).toBe(true)
    expect(calls[0].url).toBe('https://api.resend.com/emails')
    expect(calls[0].body.subject).not.toMatch(/[\r\n]/)
  })
  test('with no provider configured it does nothing and does not throw', async () => {
    expect(await sendEmail({ to: 'a@b.co', subject: 's', html: 'h', text: 't' })).toBe(false)
  })
})
