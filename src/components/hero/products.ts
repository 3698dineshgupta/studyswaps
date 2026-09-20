import type { Breakpoint, OrbitingProductConfig } from './types'

/**
 * The orbiting objects. Edit this list to change what floats around the student.
 *
 *  - Speed:   `duration` (seconds per lap; bigger = slower)
 *  - Size of the path: `orbitRadius` (0.55 inner … 1 outer)
 *  - Image:   set `image: '/hero/macbook.png'` to use a real photo instead of the built-in SVG
 *  - Who sees it: `tier` 1 = everyone, 2 = tablet and up, 3 = desktop only
 *
 * Objects are spread over three "tracks" (inner / middle / outer) and their starting
 * angles are staggered, so they never bunch up.
 */
export const HERO_PRODUCTS: OrbitingProductConfig[] = [
  // ── tier 1: shown on every screen ────────────────────────────────────────
  { name: 'Engineering Mathematics', price: 'Rs. 299', illustration: 'textbook', orbitRadius: 0.92, duration: 19, initialAngle: 40, direction: 1, scale: 1.0, depth: 1, rotationSpeed: 0, tilt: -5, tier: 1 },
  { name: 'MacBook Air', price: 'Rs. 45,000', illustration: 'laptop', orbitRadius: 0.78, duration: 23, initialAngle: 130, direction: 1, scale: 1.15, depth: 0.9, rotationSpeed: 0, tilt: -5, bob: 0.04, tier: 1 },
  { name: 'Scientific Calculator', price: 'Rs. 699', illustration: 'calculator', orbitRadius: 0.62, duration: 15, initialAngle: 225, direction: 1, scale: 0.85, depth: 0.7, rotationSpeed: 0, tilt: -5, tier: 1 },
  { name: 'Campus Backpack', price: 'Rs. 1,200', illustration: 'backpack', orbitRadius: 0.95, duration: 24, initialAngle: 300, direction: 1, scale: 1.1, depth: 0.85, rotationSpeed: 0, tilt: -5, tier: 1 },

  // ── tier 2: tablet and up ────────────────────────────────────────────────
  { name: 'Redmi Note 12', price: 'Rs. 14,500', illustration: 'smartphone', orbitRadius: 0.7, duration: 17, initialAngle: 185, direction: 1, scale: 0.85, depth: 0.6, rotationSpeed: 0, tilt: -5, tier: 2 },
  { name: 'Wireless Headphones', price: 'Rs. 1,800', illustration: 'headphones', orbitRadius: 0.86, duration: 21, initialAngle: 85, direction: 1, scale: 0.95, depth: 0.8, rotationSpeed: 0, tilt: -5, tier: 2 },
  { name: 'Physics Notes Bundle', price: 'Rs. 450', illustration: 'bookStack', orbitRadius: 0.58, duration: 13, initialAngle: 350, direction: 1, scale: 0.9, depth: 0.5, rotationSpeed: 0, tilt: -5, tier: 2 },

  // ── tier 3: desktop only ─────────────────────────────────────────────────
  { name: 'iPad 9th Gen', price: 'Rs. 32,000', illustration: 'tablet', orbitRadius: 1.0, duration: 25, initialAngle: 165, direction: -1, scale: 1.0, depth: 0.9, rotationSpeed: 0, tilt: 4, bob: 0.04, tier: 3 },
  { name: 'Stationery Set', price: 'Rs. 350', illustration: 'stationery', orbitRadius: 0.66, duration: 14, initialAngle: 275, direction: 1, scale: 0.75, depth: 0.55, rotationSpeed: 0, tilt: -5, tier: 3 },
  { name: 'Study Lamp', price: 'Rs. 600', illustration: 'lamp', orbitRadius: 0.82, duration: 20, initialAngle: 15, direction: -1, scale: 0.95, depth: 0.7, rotationSpeed: 0, tilt: 4, tier: 3 },
  { name: 'Mechanical Keyboard', price: 'Rs. 2,500', illustration: 'keyboard', orbitRadius: 0.98, duration: 22, initialAngle: 255, direction: -1, scale: 1.0, depth: 0.85, rotationSpeed: 0, tilt: 4, tier: 3 },
  { name: 'Hostel Essentials Bundle', price: 'Rs. 999', illustration: 'productCard', orbitRadius: 0.72, duration: 16, initialAngle: 105, direction: -1, scale: 0.85, depth: 0.6, rotationSpeed: 0, tilt: 4, tier: 3 },
  { name: 'Hero Sprint Bicycle', price: 'Rs. 9,500', illustration: 'bicycle', orbitRadius: 0.9, duration: 18, initialAngle: 330, direction: -1, scale: 1.1, depth: 0.8, rotationSpeed: 0, tilt: 4, tier: 3 },
]

/** How many tiers each screen size shows: mobile 4, tablet 7, desktop 13. */
export function productsFor(bp: Breakpoint): OrbitingProductConfig[] {
  const maxTier = bp === 'mobile' ? 1 : bp === 'tablet' ? 2 : 3
  return HERO_PRODUCTS.filter((p) => p.tier <= maxTier)
}
