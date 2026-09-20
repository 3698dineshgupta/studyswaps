/**
 * Orbit maths — pure functions, no React, no DOM.
 *
 * An object travels round an ellipse seen from slightly above:
 *   - the far half of the ellipse is HIGHER on screen, smaller and fainter (behind the student)
 *   - the near half is LOWER on screen, bigger and sharper (in front of the student)
 * On top of the steady lap we layer small, deterministic variations (speed drift, radius
 * breathing, float, wobble) so the motion feels organic rather than mechanical.
 */
import type { OrbitFrame, OrbitingProductConfig, SceneMetrics } from './types'

const TAU = Math.PI * 2
const DEG = Math.PI / 180

/** Deterministic pseudo-random number in [0, 1) from a small integer seed. */
export function seeded(seed: number): number {
  let t = (seed + 0x6d2b79f5) | 0
  t = Math.imul(t ^ (t >>> 15), t | 1)
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296
}

const smooth = (v: number) => v * v * (3 - 2 * v)

/** Per-object variation derived from its index, so re-renders never change the look. */
export interface Variation {
  driftAmp: number
  driftPhase: number
  breathePhase: number
  bobPhase: number
  bobPeriod: number
  wobbleAmp: number
  wobblePhase: number
  wobblePeriod: number
}

export function variationFor(index: number): Variation {
  const r = (n: number) => seeded(index * 17 + n)
  return {
    driftAmp: 0.05 + r(1) * 0.07, // radians of speed drift
    driftPhase: r(2) * TAU,
    breathePhase: r(3) * TAU,
    bobPhase: r(4) * TAU,
    bobPeriod: 3.2 + r(5) * 2.6, // seconds
    wobbleAmp: 4 + r(6) * 6, // degrees
    wobblePhase: r(7) * TAU,
    wobblePeriod: 5 + r(8) * 4,
  }
}

/** Far / near range of the perspective scale. Near objects are ~2.4x bigger than far ones. */
const SCALE_FAR = 0.52
const SCALE_NEAR = 1.22

/**
 * @param phase seconds of *orbit time* elapsed (advances slower when the object is hovered)
 */
export function orbitFrame(
  cfg: OrbitingProductConfig,
  v: Variation,
  phase: number,
  m: SceneMetrics,
  out: OrbitFrame = { x: 0, y: 0, scale: 1, rotate: 0, rotateY: 0, front: 0, bobY: 0 }
): OrbitFrame {
  // Steady lap + a slow drift in speed (objects speed up / ease off a little)
  const lap = (phase / cfg.duration) * TAU * cfg.direction
  const drift = v.driftAmp * Math.sin((phase / (cfg.duration * 0.63)) * TAU + v.driftPhase)
  const a = cfg.initialAngle * DEG + lap + drift

  // The orbit "breathes" slightly in size
  const breathe = 1 + 0.04 * Math.sin((phase / (cfg.duration * 0.8)) * TAU + v.breathePhase)
  const R = cfg.orbitRadius * breathe

  const cosA = Math.cos(a)
  const sinA = Math.sin(a)

  // Tilted ellipse
  const ex = cosA * R * m.rx
  const ey = sinA * R * m.ry
  const t = (cfg.tilt ?? 0) * DEG
  out.x = ex * Math.cos(t) - ey * Math.sin(t)
  out.y = ex * Math.sin(t) + ey * Math.cos(t)

  // Depth: sinA = +1 at the point nearest the viewer
  out.front = (sinA + 1) / 2
  out.scale = cfg.scale * (SCALE_FAR + (SCALE_NEAR - SCALE_FAR) * smooth(out.front))

  // Slight spin + wobble, and a turntable-style lean towards the direction of travel
  out.rotate =
    cfg.rotationSpeed * phase + v.wobbleAmp * Math.sin((phase / v.wobblePeriod) * TAU + v.wobblePhase)
  out.rotateY = -cosA * 14 * cfg.direction

  out.bobY = Math.sin((phase / v.bobPeriod) * TAU + v.bobPhase) * (cfg.bob ?? 0.05) * m.item
  return out
}

/** Pixel metrics for a scene of the given size. */
export function sceneMetrics(width: number, height: number, bp: 'mobile' | 'tablet' | 'desktop'): SceneMetrics {
  const ryFactor = bp === 'mobile' ? 0.24 : 0.3
  const itemBase = bp === 'mobile' ? width * 0.235 : bp === 'tablet' ? width * 0.15 : width * 0.11
  const item = Math.max(72, Math.min(itemBase, 150))
  // Widest reach = orbitRadius(≤1) * breathing(1.04) * rx + half of the biggest object.
  // Solve for rx so the outer track just touches the edge instead of overflowing it.
  const rx = Math.min((width / 2 - item * 0.6) / 1.04, 640)
  return { rx, ry: Math.min(height * ryFactor, 200), item }
}

/** z-index rule: far half behind the student (fixed at STUDENT_Z), near half in front. */
export const STUDENT_Z = 500
export function zIndexFor(front: number, index: number, hovered: boolean): number {
  if (hovered) return 900
  return front >= 0.5 ? STUDENT_Z + 50 + Math.round((front - 0.5) * 200) + index : 100 + Math.round(front * 200) + index
}
