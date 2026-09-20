'use client'

import { motion } from 'motion/react'
import { ProductCard, type CardProduct } from './ProductCard'
import EmptyState from '@/components/ui/EmptyState'
import { ProductGridSkeleton } from '@/components/ui/Skeleton'
import { fadeUp, stagger, VIEWPORT } from '@/lib/motion'

interface ProductGridProps {
  products: CardProduct[]
  loading?: boolean
  emptyMessage?: string
  /** Animate when scrolled into view instead of on mount (for sections below the fold) */
  onView?: boolean
  /** How many of the first cards load eagerly (above the fold) */
  priorityCount?: number
  className?: string
}

const GRID = 'grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4 lg:grid-cols-4 xl:grid-cols-5'

export function ProductGrid({ products, loading, emptyMessage, priorityCount = 4, className, onView }: ProductGridProps) {
  if (loading) return <ProductGridSkeleton className={className} />

  if (!products || products.length === 0) {
    return (
      <EmptyState
        illustration="bookStack"
        title="Nothing here yet"
        text={emptyMessage || 'Try different filters, or check back soon — new listings appear all the time.'}
        action={{ label: 'Explore Marketplace', href: '/browse' }}
      />
    )
  }

  return (
    <motion.div className={className ?? GRID} variants={stagger(0.045)} {...(onView ? { initial: "hidden", whileInView: "show", viewport: VIEWPORT } : { initial: false, animate: "show" })}>
      {products.map((product, i) => (
        <motion.div key={product.id} variants={fadeUp} className="h-full">
          <ProductCard product={product} priority={i < priorityCount} />
        </motion.div>
      ))}
    </motion.div>
  )
}

export default ProductGrid
