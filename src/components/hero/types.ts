export type Breakpoint = 'mobile' | 'tablet' | 'desktop'

export type IllustrationKey =
  | 'textbook'
  | 'bookStack'
  | 'laptop'
  | 'tablet'
  | 'smartphone'
  | 'headphones'
  | 'calculator'
  | 'backpack'
  | 'stationery'
  | 'lamp'
  | 'keyboard'
  | 'productCard'
  | 'bicycle'

/**
 * One orbiting marketplace object. Everything about its motion comes from this
 * config — there is no per-object hand-written animation.
 */
export interface OrbitingProductConfig {
  /** Label shown on hover, e.g. "MacBook Air" */
  name: string
  /** Price label shown on hover, e.g. "Rs. 45,000" */
  price: string
  /**
   * Optional real image (URL or /public path). When set it replaces the built-in
   * illustration. Transparent PNG/WebP works best.
   */
  image?: string
  /** Built-in SVG placeholder used when `image` is not provided */
  illustration: IllustrationKey

  /** Orbit size as a fraction of the scene's max radius (0.5 = inner track, 1 = outer track) */
  orbitRadius: number
  /** Seconds for one full lap. Use 12–25 for a calm, premium feel. */
  duration: number
  /** Starting position on the orbit in degrees (0 = right, 90 = closest to viewer) */
  initialAngle: number
  /** 1 = clockwise, -1 = counter-clockwise */
  direction: 1 | -1
  /** Size multiplier for this object (1 = default size) */
  scale: number
  /** 0–1: how strongly this object reacts to mouse parallax (0 = far away, 1 = very close) */
  depth: number
  /** Degrees per second of continuous spin (keep small; most objects use 0) */
  rotationSpeed: number

  /** Tilt of the orbit ellipse in degrees (default 0) */
  tilt?: number
  /** Gentle floating amplitude as a fraction of object size (default 0.05) */
  bob?: number
  /** 1 = always shown, 2 = tablet and up, 3 = desktop only */
  tier: 1 | 2 | 3
}

/** Pixel measurements of the scene, updated on resize (not per frame). */
export interface SceneMetrics {
  /** Horizontal orbit radius at orbitRadius = 1 */
  rx: number
  /** Vertical orbit radius at orbitRadius = 1 */
  ry: number
  /** Base object size in px */
  item: number
}

/** Output of the orbit maths for one frame. */
export interface OrbitFrame {
  x: number
  y: number
  scale: number
  rotate: number
  rotateY: number
  /** 0 = far side of the orbit, 1 = nearest the viewer */
  front: number
  /** Vertical float offset for the artwork (px) */
  bobY: number
}
