'use client'

import { useRef } from 'react'
import { AnimatePresence, motion } from 'motion/react'
import { Plus } from 'lucide-react'
import QuantityControl from './QuantityControl'
import { useCartUI } from './CartUIProvider'
import { useCartControls } from '@/hooks/useCartItem'
import type { CardProduct } from '@/components/marketplace/ProductCard'
import { SPRING } from '@/lib/motion'

/**
 * "+ ADD" on a product card. One tap: the card's photo flies to the cart, the button springs into [ − 1 + ].
 * Cart state is the shared react-query cache, and this component subscribes only to ITS product's quantity,
 * so adding something never re-renders the rest of the grid.
 */
export function AddToCartButton({ product }: { product: CardProduct }) {
  const { quantity, stock, add, increment, decrement } = useCartControls(product)
  const { fly, cancelFly, pulse } = useCartUI()
  const ref = useRef<HTMLDivElement>(null)

  const onAdd = () => {
    // The photo the buyer is looking at: the image area of this card
    const image = ref.current?.closest('article')?.querySelector<HTMLElement>('img') ?? null
    let id: string | null = null
    // If the server refuses (e.g. your own listing) the flight is called back and the cache rolls back
    if (!add(() => cancelFly(id))) return
    id = fly(image)
  }

  if (stock <= 0) return null

  return (
    <div ref={ref} className="relative z-10 flex justify-end">
      <AnimatePresence mode="wait" initial={false}>
        {quantity === 0 ? (
          <motion.button
            key="add"
            type="button"
            onClick={onAdd}
            aria-label={`Add ${product.title} to cart`}
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.8 }}
            whileHover={{ y: -1 }}
            whileTap={{ scale: 0.93 }}
            transition={SPRING.bouncy}
            style={{ originX: 1 }}
            className="flex h-9 items-center gap-1 rounded-full border border-green-600 bg-white px-3.5 text-[13px] font-extrabold uppercase tracking-wide text-green-700 shadow-soft transition-colors hover:bg-green-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-green-500 focus-visible:ring-offset-2"
          >
            <Plus className="h-3.5 w-3.5" strokeWidth={3} /> Add
          </motion.button>
        ) : (
          <motion.div
            key="qty"
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.8 }}
            transition={SPRING.bouncy}
            style={{ originX: 1 }}
          >
            <QuantityControl
              quantity={quantity}
              max={stock}
              title={product.title}
              onIncrement={() => { increment(); if (quantity < stock) pulse() }}
              onDecrement={decrement}
            />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

export default AddToCartButton
