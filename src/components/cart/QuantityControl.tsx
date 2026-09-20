'use client'

import { AnimatePresence, motion } from 'motion/react'
import { Minus, Plus } from 'lucide-react'
import { SPRING } from '@/lib/motion'
import { cn } from '@/lib/utils'

interface QuantityControlProps {
  quantity: number
  max: number
  title: string
  onIncrement: () => void
  onDecrement: () => void
  className?: string
}

/** [ − 1 + ] pill. The number rolls up/down; "+" dims at the stock limit; "−" at 1 removes the item. */
export function QuantityControl({ quantity, max, title, onIncrement, onDecrement, className }: QuantityControlProps) {
  const atMax = quantity >= max
  const btn = 'flex h-8 w-8 items-center justify-center rounded-full text-white transition-colors hover:bg-white/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white'

  return (
    <div role="group" aria-label={`Quantity of ${title}`} className={cn('flex h-9 items-center rounded-full bg-green-600 px-0.5 shadow-[0_8px_18px_-8px_rgba(22,163,74,0.9)]', className)}>
      <motion.button type="button" whileTap={{ scale: 0.82 }} transition={SPRING.snappy} onClick={onDecrement} aria-label={quantity <= 1 ? `Remove ${title} from cart` : `Decrease quantity of ${title}`} className={btn}>
        <Minus className="h-4 w-4" strokeWidth={2.75} />
      </motion.button>

      <span className="relative flex h-8 w-6 items-center justify-center overflow-hidden text-sm font-bold text-white" aria-live="polite" aria-atomic="true">
        <AnimatePresence mode="popLayout" initial={false}>
          <motion.span key={quantity} initial={{ y: 12, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: -12, opacity: 0 }} transition={SPRING.snappy} className="absolute">
            {quantity}
          </motion.span>
        </AnimatePresence>
      </span>

      <motion.button
        type="button"
        whileTap={atMax ? undefined : { scale: 0.82 }}
        transition={SPRING.snappy}
        onClick={onIncrement}
        aria-label={`Increase quantity of ${title}`}
        aria-disabled={atMax}
        title={atMax ? (max === 1 ? 'Only 1 available' : `Only ${max} available`) : undefined}
        className={cn(btn, atMax && 'cursor-not-allowed opacity-45 hover:bg-transparent')}
      >
        <Plus className="h-4 w-4" strokeWidth={2.75} />
      </motion.button>
    </div>
  )
}

export default QuantityControl
