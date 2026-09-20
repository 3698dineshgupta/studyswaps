/**
 * StudentMarket motion vocabulary — the ONLY place animation timings live.
 * Every page and component imports from here so the whole product moves the same way.
 *
 *   fast   150ms  hover / press feedback, small UI (icons, chips)
 *   normal 250ms  most transitions (dropdowns, tabs, page fade)
 *   slow   400ms  entrances, scroll reveals
 */
import type { Transition, Variants } from 'motion/react'

export const DURATION = { fast: 0.15, normal: 0.25, slow: 0.4 } as const

/** Premium ease-out: fast start, long soft landing. */
export const EASE = [0.22, 1, 0.36, 1] as const
export const EASE_IN_OUT = [0.65, 0, 0.35, 1] as const

export const SPRING = {
  /** Calm, weighty — layout shifts, sliding indicators */
  soft: { type: 'spring', stiffness: 260, damping: 26 },
  /** Quick and precise — toggles, selection highlights */
  snappy: { type: 'spring', stiffness: 420, damping: 30 },
  /** A little overshoot — hearts, cart feedback, badges */
  bouncy: { type: 'spring', stiffness: 520, damping: 17 },
} as const satisfies Record<string, Transition>

/** Scroll-reveal defaults: animate once, slightly before the element is fully in view. */
export const VIEWPORT = { once: true, margin: '-60px' } as const

export const fadeUp: Variants = {
  hidden: { opacity: 0, y: 16 },
  show: { opacity: 1, y: 0, transition: { duration: DURATION.slow, ease: EASE } },
}

export const fadeIn: Variants = {
  hidden: { opacity: 0 },
  show: { opacity: 1, transition: { duration: DURATION.normal } },
}

export const scaleIn: Variants = {
  hidden: { opacity: 0, scale: 0.96 },
  show: { opacity: 1, scale: 1, transition: { duration: DURATION.normal, ease: EASE } },
}

/** Parent variant: children using fadeUp / scaleIn animate one after another. */
export const stagger = (gap = 0.06, delay = 0): Variants => ({
  hidden: {},
  show: { transition: { staggerChildren: gap, delayChildren: delay } },
})

/** Dropdowns / popovers */
export const popover: Variants = {
  hidden: { opacity: 0, y: -6, scale: 0.97 },
  show: { opacity: 1, y: 0, scale: 1, transition: { duration: DURATION.fast, ease: EASE } },
}

/** List items that can be removed (cart, wishlist) */
export const listItem = {
  initial: { opacity: 0, y: 12 },
  animate: { opacity: 1, y: 0, transition: { duration: DURATION.normal, ease: EASE } },
  exit: { opacity: 0, x: -24, scale: 0.98, transition: { duration: DURATION.normal, ease: EASE_IN_OUT } },
} as const
