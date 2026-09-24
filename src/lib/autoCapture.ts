/**
 * Camera-frame checks behind "auto capture" in the identity verification steps.
 *
 * Everything here works on small grayscale/RGBA pixel buffers and needs no ML library, so it runs on any phone. It
 * answers three questions about the live picture: is the ID card lying inside the guide frame (its four edges line up
 * with the frame), is a face inside the oval, and is the picture steady. The camera component asks these a few times a
 * second and takes the photo once everything has been right for about a second.
 *
 * These checks only decide WHEN the picture is taken automatically. They are not proof of identity: every photo is
 * still reviewed by a person, and the server runs its own checks (size, real image, liveness movement).
 */

export interface Rect { x: number; y: number; w: number; h: number }

export const AUTO = {
  /** Analysis picture size (the visible camera area is scaled to this). */
  W: 320,
  H: 240,
  /** Consecutive good checks needed before the photo is taken. */
  readyTicks: 5,
  tickMs: 250,
}

/** Which part of the video is actually visible when it is shown with `object-fit: cover` in a box of another shape. */
export function visibleRegion(vw: number, vh: number, boxW: number, boxH: number) {
  const va = vw / vh, ba = boxW / boxH
  if (va > ba) { const sw = vh * ba; return { sx: (vw - sw) / 2, sy: 0, sw, sh: vh } }
  const sh = vw / ba
  return { sx: 0, sy: (vh - sh) / 2, sw: vw, sh }
}

export function toGray(rgba: Uint8ClampedArray | Uint8Array, count: number): Float32Array {
  const g = new Float32Array(count)
  for (let i = 0; i < count; i++) g[i] = 0.299 * rgba[i * 4] + 0.587 * rgba[i * 4 + 1] + 0.114 * rgba[i * 4 + 2]
  return g
}

/** Horizontal and vertical brightness change per pixel (absolute values). */
export function gradients(gray: Float32Array, w: number, h: number) {
  const gx = new Float32Array(w * h), gy = new Float32Array(w * h)
  for (let y = 1; y < h - 1; y++) {
    for (let x = 1; x < w - 1; x++) {
      const i = y * w + x
      gx[i] = Math.abs(gray[i + 1] - gray[i - 1]) / 2
      gy[i] = Math.abs(gray[i + w] - gray[i - w]) / 2
    }
  }
  return { gx, gy }
}

export interface CardReport {
  /** How many of the 4 frame sides have a card edge lying on them (0-4). */
  sides: number
  /** Share of pixels inside the frame that carry detail (text, photo, logo). */
  detail: number
  /** Focus: variance of the Laplacian inside the frame. */
  sharpness: number
  brightness: number
  /** Share of blown-out (glare) pixels inside the frame. */
  glare: number
  ok: boolean
}

const SEARCH = 9   // px either side of the frame line where an edge may sit
const OUTSIDE = [12, 24] // px beyond the frame line, used as the "background" level

/** Mean of a gradient plane along one side of the rect at a given offset from the side (positive = outward). */
function sideMean(plane: Float32Array, w: number, h: number, r: Rect, side: 'top' | 'bottom' | 'left' | 'right', offset: number) {
  let sum = 0, n = 0
  if (side === 'top' || side === 'bottom') {
    const y = Math.round(side === 'top' ? r.y - offset : r.y + r.h + offset)
    if (y < 1 || y >= h - 1) return null
    const x0 = Math.round(r.x + r.w * 0.15), x1 = Math.round(r.x + r.w * 0.85)
    for (let x = x0; x < x1; x++) { sum += plane[y * w + x]; n++ }
  } else {
    const x = Math.round(side === 'left' ? r.x - offset : r.x + r.w + offset)
    if (x < 1 || x >= w - 1) return null
    const y0 = Math.round(r.y + r.h * 0.15), y1 = Math.round(r.y + r.h * 0.85)
    for (let y = y0; y < y1; y++) { sum += plane[y * w + x]; n++ }
  }
  return n ? sum / n : null
}

/** Is an ID card lying inside `r`? Its edges must sit on the frame lines, and it must be in focus, evenly lit and detailed. */
export function checkCard(gray: Float32Array, w: number, h: number, r: Rect): CardReport {
  const { gx, gy } = gradients(gray, w, h)
  let sides = 0
  for (const side of ['top', 'bottom', 'left', 'right'] as const) {
    const plane = side === 'top' || side === 'bottom' ? gy : gx // an edge along a horizontal side changes brightness vertically
    let best = 0
    for (let o = -SEARCH; o <= SEARCH; o++) best = Math.max(best, sideMean(plane, w, h, r, side, o) ?? 0)
    const bg: number[] = []
    for (let o = OUTSIDE[0]; o <= OUTSIDE[1]; o += 4) { const m = sideMean(plane, w, h, r, side, o); if (m !== null) bg.push(m) }
    const outside = bg.length ? bg.reduce((a, b) => a + b, 0) / bg.length : 0
    // a genuine card edge is a clear step, and clearly stronger than whatever lies beyond it
    if (best >= 9 && best >= outside * 2 + 3) sides++
  }

  // detail, focus, exposure inside the frame
  let n = 0, edgy = 0, lapSum = 0, lapSq = 0, bright = 0, hot = 0
  const x0 = Math.max(2, Math.round(r.x)), x1 = Math.min(w - 2, Math.round(r.x + r.w))
  const y0 = Math.max(2, Math.round(r.y)), y1 = Math.min(h - 2, Math.round(r.y + r.h))
  for (let y = y0; y < y1; y++) {
    for (let x = x0; x < x1; x++) {
      const i = y * w + x
      n++
      if (gx[i] + gy[i] > 12) edgy++
      const lap = 4 * gray[i] - gray[i - 1] - gray[i + 1] - gray[i - w] - gray[i + w]
      lapSum += lap; lapSq += lap * lap
      bright += gray[i]
      if (gray[i] > 252) hot++
    }
  }
  const detail = n ? edgy / n : 0
  const sharpness = n ? lapSq / n - (lapSum / n) ** 2 : 0
  const brightness = n ? bright / n : 0
  const glare = n ? hot / n : 0
  const ok = sides >= 3 && detail >= 0.05 && sharpness >= 90 && brightness >= 50 && brightness <= 225 && glare <= 0.12
  return { sides, detail, sharpness, brightness, glare, ok }
}

/** Share of skin-coloured pixels inside an ellipse (a face is in the oval when this is high). */
export function skinShare(rgba: Uint8ClampedArray | Uint8Array, w: number, h: number, oval: Rect): number {
  const cx = oval.x + oval.w / 2, cy = oval.y + oval.h / 2, rx = oval.w / 2, ry = oval.h / 2
  let n = 0, skin = 0
  for (let y = Math.max(0, Math.floor(oval.y)); y < Math.min(h, Math.ceil(oval.y + oval.h)); y++) {
    for (let x = Math.max(0, Math.floor(oval.x)); x < Math.min(w, Math.ceil(oval.x + oval.w)); x++) {
      if (((x - cx) / rx) ** 2 + ((y - cy) / ry) ** 2 > 1) continue
      const i = (y * w + x) * 4
      const r = rgba[i], g = rgba[i + 1], b = rgba[i + 2]
      const cb = 128 - 0.168736 * r - 0.331264 * g + 0.5 * b
      const cr = 128 + 0.5 * r - 0.418688 * g - 0.081312 * b
      n++
      if (cb >= 77 && cb <= 127 && cr >= 133 && cr <= 173 && r > 60 && r > b) skin++
    }
  }
  return n ? skin / n : 0
}

/** Average brightness change between two frames inside a rect (0 = perfectly still). */
export function motion(prev: Float32Array | null, cur: Float32Array, w: number, r: Rect): number {
  if (!prev) return 255
  let sum = 0, n = 0
  for (let y = Math.round(r.y); y < Math.round(r.y + r.h); y += 2) {
    for (let x = Math.round(r.x); x < Math.round(r.x + r.w); x += 2) { sum += Math.abs(cur[y * w + x] - prev[y * w + x]); n++ }
  }
  return n ? sum / n : 255
}

/** Counts consecutive good checks; `hit()` becomes true once the picture has been right for long enough. */
export class Steady {
  private run = 0
  constructor(private need = AUTO.readyTicks) {}
  push(good: boolean) { this.run = good ? this.run + 1 : 0; return this.run >= this.need }
  get progress() { return Math.min(1, this.run / this.need) }
  reset() { this.run = 0 }
}
