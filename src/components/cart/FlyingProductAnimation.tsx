'use client'

import { useEffect } from 'react'
import { animate, motion, useMotionValue } from 'motion/react'
import { ShoppingBag } from 'lucide-react'

export interface Flight {
  id: string
  /** Product photo to clone (null → a green bubble with a bag icon) */
  src: string | null
  /** Where the photo is on screen right now */
  from: { x: number; y: number; w: number; h: number }
  /** Centre of the header cart icon */
  to: { x: number; y: number }
}

const SIZE = 84

/**
 * A temporary copy of the product photo that arcs from the card to the cart icon.
 * Moves with transforms only (x / y / scale / rotate / opacity), driven by one 0→1 progress value along a
 * quadratic Bézier curve, so it stays on the compositor and never touches layout.
 */
export function FlyingProductAnimation({ flight, onDone }: { flight: Flight; onDone: (id: string) => void }) {
  const x = useMotionValue(0)
  const y = useMotionValue(0)
  const scale = useMotionValue(1)
  const rotate = useMotionValue(0)
  const opacity = useMotionValue(1)

  useEffect(() => {
    const { from, to } = flight
    const x0 = from.x + from.w / 2
    const y0 = from.y + from.h / 2
    const dx = to.x - x0
    const dy = to.y - y0
    // Control point pulls the path up and out, so it swoops instead of sliding in a straight line
    const cx = dx * 0.35 - (Math.abs(dx) < 160 ? 70 : 0) // near-vertical trips still swoop sideways
    const cy = Math.min(0, dy) - Math.min(160, 60 + Math.abs(dx) * 0.12)
    const spin = dx < 0 ? -1 : 1
    const startScale = Math.min(1.15, Math.max(0.7, from.w / SIZE))

    const controls = animate(0, 1, {
      duration: Math.min(0.9, Math.max(0.6, 0.55 + Math.hypot(dx, dy) / 3200)), // 600–900 ms
      ease: [0.45, 0, 0.25, 1],
      onUpdate: (t) => {
        const u = 1 - t
        x.set(2 * u * t * cx + t * t * dx)
        y.set(2 * u * t * cy + t * t * dy)
        scale.set(startScale + (0.16 - startScale) * t)
        rotate.set(spin * 24 * t)
        opacity.set(t < 0.82 ? 1 : Math.max(0, 1 - (t - 0.82) / 0.18))
      },
      onComplete: () => onDone(flight.id),
    })
    return () => controls.stop()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [flight.id])

  return (
    <motion.div
      aria-hidden
      data-fly
      className="pointer-events-none fixed z-[120] overflow-hidden rounded-2xl bg-green-50 shadow-[0_18px_40px_-10px_rgba(20,23,28,0.45)] ring-2 ring-white will-change-transform"
      style={{
        left: flight.from.x + flight.from.w / 2 - SIZE / 2,
        top: flight.from.y + flight.from.h / 2 - SIZE / 2,
        width: SIZE,
        height: SIZE,
        x, y, scale, rotate, opacity,
      }}
    >
      {flight.src ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={flight.src} alt="" className="h-full w-full object-cover" draggable={false} />
      ) : (
        <span className="flex h-full w-full items-center justify-center bg-green-600 text-white"><ShoppingBag className="h-8 w-8" /></span>
      )}
    </motion.div>
  )
}

export default FlyingProductAnimation
