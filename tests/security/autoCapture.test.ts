/**
 * The auto-capture checks on synthetic pictures: a card lying in the frame is detected, an empty desk, a card that is
 * out of place, a blurry card and a moving picture are not.
 */
import { checkCard, motion, skinShare, Steady, visibleRegion, toGray } from '../../src/lib/autoCapture'

const W = 320, H = 240
const FRAME = { x: 29, y: 37, w: 262, h: 165 }

/** A grey "desk" with a little texture; optionally a light card with printed lines and a photo block at `rect`. */
function scene(card: { x: number; y: number; w: number; h: number } | null, opts: { blur?: boolean; seed?: number } = {}) {
  const g = new Float32Array(W * H)
  let s = opts.seed ?? 1
  const rnd = () => { s = (s * 16807) % 2147483647; return s / 2147483647 }
  for (let i = 0; i < g.length; i++) g[i] = 85 + rnd() * 6
  if (card) {
    for (let y = card.y; y < card.y + card.h; y++) for (let x = card.x; x < card.x + card.w; x++) g[y * W + x] = 205
    // printed text lines
    for (let line = 0; line < 9; line++) {
      const yy = card.y + 20 + line * 14
      for (let y = yy; y < yy + 4; y++) for (let x = card.x + 70; x < card.x + card.w - 14; x++) if (((x * 7 + line * 3) % 11) < 8) g[y * W + x] = 60
    }
    // photo block
    for (let y = card.y + 18; y < card.y + 88; y++) for (let x = card.x + 14; x < card.x + 58; x++) g[y * W + x] = 100 + ((x + y) % 5) * 12
  }
  if (opts.blur) {
    const out = new Float32Array(g.length)
    for (let y = 5; y < H - 5; y++) for (let x = 5; x < W - 5; x++) { let sum = 0; for (let dy = -5; dy <= 5; dy++) for (let dx = -5; dx <= 5; dx++) sum += g[(y + dy) * W + x + dx]; out[y * W + x] = sum / 121 }
    return out
  }
  return g
}

describe('checkCard', () => {
  it('accepts a card whose edges lie on the frame', () => {
    const r = checkCard(scene(FRAME), W, H, FRAME)
    expect(r.sides).toBe(4)
    expect(r.ok).toBe(true)
  })
  it('accepts a card a few pixels off the lines', () => {
    expect(checkCard(scene({ x: FRAME.x + 5, y: FRAME.y - 4, w: FRAME.w, h: FRAME.h }), W, H, FRAME).ok).toBe(true)
  })
  it('rejects an empty desk', () => {
    expect(checkCard(scene(null), W, H, FRAME).ok).toBe(false)
  })
  it('rejects a card that is far too small or badly placed', () => {
    expect(checkCard(scene({ x: 60, y: 60, w: 120, h: 76 }), W, H, FRAME).ok).toBe(false)
    expect(checkCard(scene({ x: FRAME.x + 60, y: FRAME.y + 40, w: FRAME.w, h: FRAME.h }), W, H, FRAME).ok).toBe(false)
  })
  it('rejects a blurry card', () => {
    expect(checkCard(scene(FRAME, { blur: true }), W, H, FRAME).ok).toBe(false)
  })
})

describe('other checks', () => {
  it('measures motion between frames', () => {
    const a = scene(FRAME, { seed: 1 }), b = scene(FRAME, { seed: 1 })
    expect(motion(a, b, W, FRAME)).toBeLessThan(1)
    expect(motion(scene(FRAME), scene({ x: FRAME.x + 30, y: FRAME.y, w: FRAME.w, h: FRAME.h }), W, FRAME)).toBeGreaterThan(8)
    expect(motion(null, a, W, FRAME)).toBe(255)
  })
  it('finds skin colours in the oval and not in a blue wall', () => {
    const oval = { x: 20, y: 20, w: 100, h: 140 }
    const px = (r: number, g: number, b: number) => { const d = new Uint8ClampedArray(W * H * 4); for (let i = 0; i < W * H; i++) { d[i * 4] = r; d[i * 4 + 1] = g; d[i * 4 + 2] = b; d[i * 4 + 3] = 255 } return d }
    expect(skinShare(px(210, 150, 120), W, H, oval)).toBeGreaterThan(0.8)
    expect(skinShare(px(40, 90, 200), W, H, oval)).toBeLessThan(0.05)
  })
  it('needs several good checks in a row', () => {
    const s = new Steady(3)
    expect([s.push(true), s.push(true), s.push(false), s.push(true), s.push(true), s.push(true)]).toEqual([false, false, false, false, false, true])
  })
  it('maps object-fit: cover to the visible part of the video', () => {
    const v = visibleRegion(1920, 1080, 400, 300) // 16:9 video shown in a 4:3 box: sides are cropped
    expect(Math.round(v.sw)).toBe(1440); expect(Math.round(v.sx)).toBe(240); expect(v.sy).toBe(0)
    const p = visibleRegion(1080, 1920, 400, 300) // portrait video in a landscape box: top and bottom cropped
    expect(p.sx).toBe(0); expect(Math.round(p.sh)).toBe(810)
  })
  it('converts RGBA to grey', () => {
    expect(Math.round(toGray(new Uint8Array([255, 255, 255, 255]), 1)[0])).toBe(255)
  })
})
