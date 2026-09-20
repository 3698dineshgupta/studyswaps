'use client'

import { AnimatePresence, motion } from 'motion/react'
import { SPRING } from '@/lib/motion'

/** Green count bubble on the cart icon. Only exists while there is something in the cart; pops on every change. */
export function CartBadge({ count }: { count: number }) {
  return (
    <AnimatePresence>
      {count > 0 && (
        <motion.span
          key={count}
          data-cart-badge
          initial={{ scale: 0.4, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0.4, opacity: 0 }}
          transition={SPRING.bouncy}
          className="absolute -right-0.5 -top-0.5 flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-green-600 px-1 text-[10px] font-bold text-white ring-2 ring-white"
        >
          {count > 9 ? '9+' : count}
        </motion.span>
      )}
    </AnimatePresence>
  )
}

export default CartBadge
