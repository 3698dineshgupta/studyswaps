import sharp from 'sharp'
import { checkImage } from '@/lib/identity'

const file = (data: BlobPart, name: string, type: string) => new File([data], name, { type })

describe('identity-document upload reads real bytes, not the declared type', () => {
  test('a real photo within the bounds is accepted', async () => {
    const buf = await sharp({ create: { width: 800, height: 600, channels: 3, background: '#3a7' } }).jpeg().toBuffer()
    expect((await checkImage(file(buf, 'doc.jpg', 'image/jpeg'), { maxBytes: 8 * 1024 * 1024, minWidth: 480, minHeight: 320 })).ok).toBe(true)
  })

  test('HTML renamed to .png is rejected', async () => {
    expect((await checkImage(file('<html><script>alert(1)</script></html>', 'x.png', 'image/png'), { maxBytes: 8 * 1024 * 1024 })).ok).toBe(false)
  })

  // Regression test: a security review found this checker had no total-pixel cap — only a per-side limit of
  // 8000px — unlike the general upload checker, which caps at 40 megapixels. A 7999x7999 image (~64 MP) passed
  // the per-side check but could still make sharp do tens of millions of pixels of decode/resize work on a
  // small, highly-compressed file ("decompression bomb"). It must now be rejected the same way the general
  // checker rejects it.
  test('an image under the per-side limit but over the total-pixel cap is rejected', async () => {
    const buf = await sharp({ create: { width: 7999, height: 7999, channels: 3, background: '#000' } }).png({ compressionLevel: 9 }).toBuffer()
    const result = await checkImage(file(buf, 'bomb.png', 'image/png'), { maxBytes: 8 * 1024 * 1024 })
    expect(result.ok).toBe(false)
  })

  test('an oversized side is still rejected directly', async () => {
    const buf = await sharp({ create: { width: 9000, height: 100, channels: 3, background: '#000' } }).jpeg().toBuffer()
    expect((await checkImage(file(buf, 'wide.jpg', 'image/jpeg'), { maxBytes: 8 * 1024 * 1024 })).ok).toBe(false)
  })

  test('a too-small photo is rejected when a minimum is set', async () => {
    const buf = await sharp({ create: { width: 100, height: 80, channels: 3, background: '#3a7' } }).jpeg().toBuffer()
    const result = await checkImage(file(buf, 'small.jpg', 'image/jpeg'), { maxBytes: 8 * 1024 * 1024, minWidth: 480, minHeight: 320 })
    expect(result.ok).toBe(false)
    expect((result as { ok: false; error: string }).error).toBe('IMAGE_TOO_SMALL')
  })

  test('a file over the byte limit is rejected before any image decoding', async () => {
    const big = Buffer.alloc(200)
    expect((await checkImage(file(big, 'x.jpg', 'image/jpeg'), { maxBytes: 100 })).ok).toBe(false)
  })
})
