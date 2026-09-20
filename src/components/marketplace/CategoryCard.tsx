'use client'

import Link from 'next/link'
import { motion } from 'motion/react'
import { ArrowUpRight } from 'lucide-react'
import { categoryMeta } from './categoryMeta'
import { SPRING } from '@/lib/motion'
import { cn } from '@/lib/utils'

interface CategoryCardProps {
  slug: string
  name: string
  /** Live number of active listings (omit while unknown) */
  count?: number
  className?: string
}

/** Home-page category tile: tinted icon, name, live listing count. */
export default function CategoryCard({ slug, name, count, className }: CategoryCardProps) {
  const { Icon, tint } = categoryMeta(slug)
  return (
    <motion.div whileHover={{ y: -4 }} whileTap={{ scale: 0.98 }} transition={SPRING.soft} className={cn('h-full', className)}>
      <Link
        href={`/browse?category=${slug}`}
        className="group relative flex h-full flex-col items-start gap-3 rounded-2xl border border-gray-200/70 bg-white p-4 shadow-soft transition-shadow duration-300 hover:shadow-lift sm:gap-4 sm:p-5"
      >
        <span className={cn('flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl transition-all duration-300 group-hover:-rotate-6 group-hover:scale-110', tint)}>
          <Icon className="h-6 w-6" strokeWidth={1.8} />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block font-display text-[15px] font-semibold text-ink">{name}</span>
          <span className="block text-xs text-ink-muted">
            {typeof count === 'number' ? `${count.toLocaleString()} ${count === 1 ? 'listing' : 'listings'}` : 'Browse'}
          </span>
        </span>
        <ArrowUpRight className="absolute right-3.5 top-3.5 h-4 w-4 text-gray-300 transition-all duration-300 group-hover:-translate-y-0.5 group-hover:translate-x-0.5 group-hover:text-green-600" aria-hidden />
      </Link>
    </motion.div>
  )
}
