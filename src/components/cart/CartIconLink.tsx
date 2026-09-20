'use client'

import Link from 'next/link'
import { useEffect, useRef } from 'react'
import { AnimatePresence, motion, useAnimate, useReducedMotion } from 'motion/react'
import { ShoppingBag } from 'lucide-react'
import CartBadge from './CartBadge'
import { useCartUI } from './CartUIProvider'
import { useCartCount } from '@/hooks/useCartItem'
import { SPRING } from '@/lib/motion'

/**
 * The header cart icon: the landing target for flying products, pulses when one arrives,
 * and shows the live count (which waits for items still in the air, so it ticks up on landing).
 */
export function CartIconLink({ className }: { className?: string }) {
  const { registerTarget, pulseKey, flyingCount } = useCartUI()
  const reduced = useReducedMotion()
  const count = Math.max(0, useCartCount() - flyingCount)
  const [scope, animateScope] = useAnimate()
  const linkRef = useRef<HTMLAnchorElement>(null)
  useEffect(() => (linkRef.current ? registerTarget(linkRef.current) : undefined), [registerTarget])

  // 1 → 1.15 → 1 every time something lands
  useEffect(() => {
    if (!pulseKey || reduced || !scope.current) return
    animateScope(scope.current, { scale: [1, 1.15, 1] }, { duration: 0.38, ease: [0.22, 1, 0.36, 1] })
  }, [pulseKey, reduced, scope, animateScope])

  return (
    <motion.div whileTap={{ scale: 0.92 }} whileHover={{ y: -1 }} transition={SPRING.snappy}>
      <div ref={scope}>
        <Link
          ref={linkRef}
          href="/cart"
          aria-label={count ? `Cart (${count})` : 'Cart'}
          className={className ?? 'relative flex h-10 w-10 items-center justify-center rounded-full text-ink-soft transition-colors hover:bg-gray-100 hover:text-ink'}
        >
          <ShoppingBag className="h-[20px] w-[20px]" />
          {/* soft green ring that expands and fades on each landing */}
          <AnimatePresence>
            {pulseKey > 0 && (
              <motion.span
                key={pulseKey}
                aria-hidden
                className="pointer-events-none absolute inset-0 rounded-full border-2 border-green-500"
                initial={{ scale: 0.8, opacity: 0.55 }}
                animate={{ scale: reduced ? 1 : 1.7, opacity: 0 }}
                transition={{ duration: 0.6, ease: 'easeOut' }}
              />
            )}
          </AnimatePresence>
          <CartBadge count={count} />
        </Link>
      </div>
    </motion.div>
  )
}

export default CartIconLink
