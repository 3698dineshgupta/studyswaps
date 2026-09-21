/**
 * Builds the site's brand images from the three source logos in public/brand/src-*.png.
 *   node scripts/make-brand-assets.cjs
 * Outputs: transparent logo + mark, favicon (png + ico), home-screen icons, social share image.
 */
const sharp = require('sharp')
const fs = require('fs')
const path = require('path')

const B = path.join(__dirname, '..', 'public', 'brand')
const PUB = path.join(__dirname, '..', 'public')
const APP = path.join(__dirname, '..', 'src', 'app')

/** Turn a picture on a white background into a transparent PNG ("colour to alpha"). */
async function whiteToAlpha(input) {
  const { data, info } = await sharp(input).removeAlpha().raw().toBuffer({ resolveWithObject: true })
  const out = Buffer.alloc(info.width * info.height * 4)
  for (let i = 0, j = 0; i < data.length; i += 3, j += 4) {
    const r = data[i], g = data[i + 1], b = data[i + 2]
    const a = 255 - Math.min(r, g, b)
    if (a < 6) { out[j + 3] = 0; continue }
    const k = 255 / a
    out[j] = Math.max(0, Math.min(255, 255 - (255 - r) * k))
    out[j + 1] = Math.max(0, Math.min(255, 255 - (255 - g) * k))
    out[j + 2] = Math.max(0, Math.min(255, 255 - (255 - b) * k))
    out[j + 3] = a
  }
  return sharp(out, { raw: { width: info.width, height: info.height, channels: 4 } })
}

/** Wrap PNG images in an .ico container (Windows/legacy favicons). */
function makeIco(pngs) {
  const head = Buffer.alloc(6); head.writeUInt16LE(0, 0); head.writeUInt16LE(1, 2); head.writeUInt16LE(pngs.length, 4)
  let offset = 6 + pngs.length * 16
  const dir = [], body = []
  for (const { size, buf } of pngs) {
    const e = Buffer.alloc(16)
    e.writeUInt8(size >= 256 ? 0 : size, 0); e.writeUInt8(size >= 256 ? 0 : size, 1)
    e.writeUInt16LE(1, 4); e.writeUInt16LE(32, 6); e.writeUInt32LE(buf.length, 8); e.writeUInt32LE(offset, 12)
    dir.push(e); body.push(buf); offset += buf.length
  }
  return Buffer.concat([head, ...dir, ...body])
}

;(async () => {
  // ---- 1. Full logo (source 2): trimmed, transparent
  const logoTrim = await sharp(path.join(B, 'src-logo.png')).trim({ threshold: 12 }).toBuffer()
  await (await whiteToAlpha(logoTrim)).extend({ top: 12, bottom: 12, left: 12, right: 12, background: { r: 0, g: 0, b: 0, alpha: 0 } }).png({ compressionLevel: 9 }).toFile(path.join(B, 'logo-full.png'))

  // ---- 2. Mark only (cap + books + arrows) cut from the full logo
  const cut = await sharp(path.join(B, 'src-logo.png')).extract({ left: 480, top: 150, width: 580, height: 428 }).toBuffer()
  const mark = await sharp(cut).trim({ threshold: 12 }).toBuffer()
  await (await whiteToAlpha(mark)).extend({ top: 6, bottom: 6, left: 6, right: 6, background: { r: 0, g: 0, b: 0, alpha: 0 } }).png({ compressionLevel: 9 }).toFile(path.join(B, 'logo-mark.png'))

  // ---- 3. Round icon (source 1): circle cut out on a transparent background -> favicon + app icons
  const S = 1002, L = 126, T = 120
  const circle = Buffer.from(`<svg width="${S}" height="${S}"><circle cx="${S / 2}" cy="${S / 2}" r="${S / 2}" fill="#fff"/></svg>`)
  const round = await sharp(path.join(B, 'src-icon.png')).extract({ left: L, top: T, width: S, height: S }).composite([{ input: circle, blend: 'dest-in' }]).png().toBuffer()
  const at = (n) => sharp(round).resize(n, n, { fit: 'cover' }).png({ compressionLevel: 9 }).toBuffer()
  const [i16, i32, i48, i192, i512] = await Promise.all([16, 32, 48, 192, 512].map(at))
  fs.writeFileSync(path.join(APP, 'favicon.ico'), makeIco([{ size: 16, buf: i16 }, { size: 32, buf: i32 }, { size: 48, buf: i48 }]))
  fs.writeFileSync(path.join(PUB, 'favicon.png'), i48)
  fs.writeFileSync(path.join(B, 'icon-192.png'), i192)
  fs.writeFileSync(path.join(B, 'icon-512.png'), i512)
  fs.writeFileSync(path.join(APP, 'icon.png'), i512)

  // ---- 4. Home-screen icon (source 3): the rounded tile, filled edge to edge (phones apply their own rounded mask)
  const tile = await sharp(path.join(B, 'src-app.png')).extract({ left: 345, top: 110, width: 850, height: 820 }).resize(1024, 1024, { fit: 'cover' }).png().toBuffer()
  const home = (n) => sharp(tile).resize(n, n).flatten({ background: '#effaf6' }).png({ compressionLevel: 9 }).toBuffer()
  fs.writeFileSync(path.join(APP, 'apple-icon.png'), await home(180))
  fs.writeFileSync(path.join(B, 'home-192.png'), await home(192))
  fs.writeFileSync(path.join(B, 'home-512.png'), await home(512))

  // ---- 5. Social share image 1200x630: logo on white
  const logoW = await sharp(path.join(B, 'logo-full.png')).resize({ height: 500 }).toBuffer()
  await sharp({ create: { width: 1200, height: 630, channels: 3, background: '#ffffff' } }).composite([{ input: logoW, gravity: 'centre' }]).png({ compressionLevel: 9 }).toFile(path.join(APP, 'opengraph-image.png'))

  console.log('brand assets written')
})().catch((e) => { console.error(e); process.exit(1) })
