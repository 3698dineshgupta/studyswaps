'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { usePathname, useSearchParams } from 'next/navigation'
import { AnimatePresence, LayoutGroup, motion } from 'motion/react'
import { LayoutGrid, X } from 'lucide-react'
import { categoryMeta } from './categoryMeta'
import { CATEGORIES } from '@/lib/constants'
import { SPRING } from '@/lib/motion'
import { cn } from '@/lib/utils'

/** Bottom sheet listing every category at once (phones and small tablets, where the strip is cut off). */
function AllCategoriesSheet({ open, onClose, active }: { open: boolean; onClose: () => void; active: string | null }) {
  const [mounted, setMounted] = useState(false)
  useEffect(() => setMounted(true), [])
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onClose])
  if (!mounted) return null
  // Portal: the header uses backdrop-blur, which would otherwise trap a fixed-position sheet inside it
  return createPortal(
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-[70] lg:hidden">
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.2 }} className="absolute inset-0 bg-ink/40 backdrop-blur-[2px]" onClick={onClose} />
          <motion.div
            role="dialog" aria-modal="true" aria-label="All categories"
            initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%', transition: { duration: 0.2 } }} transition={SPRING.soft}
            className="absolute inset-x-0 bottom-0 rounded-t-3xl bg-white p-5 pb-[calc(1.5rem+env(safe-area-inset-bottom))] shadow-lift"
          >
            <div className="mx-auto mb-4 h-1 w-10 rounded-full bg-gray-200" aria-hidden />
            <div className="mb-4 flex items-center justify-between">
              <h2 className="font-display text-lg font-extrabold text-ink">All categories</h2>
              <button type="button" onClick={onClose} aria-label="Close" className="flex h-9 w-9 items-center justify-center rounded-full bg-gray-100 text-ink-soft"><X className="h-4 w-4" /></button>
            </div>
            <div className="grid grid-cols-3 gap-2.5">
              <Link href="/browse" onClick={onClose} className={cn('flex flex-col items-center gap-2 rounded-2xl border p-3 text-center text-xs font-semibold', !active ? 'border-green-300 bg-green-50 text-green-800' : 'border-gray-100 bg-gray-50 text-ink-soft')}>
                <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-white shadow-soft"><LayoutGrid className="h-5 w-5" /></span>All items
              </Link>
              {CATEGORIES.map((cat, i) => {
                const { Icon, tint } = categoryMeta(cat.slug)
                return (
                  <motion.div key={cat.slug} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.03 * (i + 1), duration: 0.25 }}>
                    <Link href={`/browse?category=${cat.slug}`} onClick={onClose} className={cn('flex h-full flex-col items-center gap-2 rounded-2xl border p-3 text-center text-xs font-semibold', active === cat.slug ? 'border-green-300 bg-green-50 text-green-800' : 'border-gray-100 bg-gray-50 text-ink-soft')}>
                      <span className={cn('flex h-10 w-10 items-center justify-center rounded-xl', tint)}><Icon className="h-5 w-5" /></span>
                      {cat.name}
                    </Link>
                  </motion.div>
                )
              })}
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>,
    document.body,
  )
}

/**
 * Category navigation as pills: icon + label, lift on hover, sliding highlight on the active one.
 * Scrolls horizontally on small screens.
 */
export default function CategoryPills({ className }: { className?: string }) {
  const pathname = usePathname()
  const active = useSearchParams().get('category')
  const onBrowse = pathname === '/browse'
  const [sheet, setSheet] = useState(false)

  return (
    <LayoutGroup id="category-pills">
      <div className="flex items-center gap-1">
      {/* Opens the full list — every category in one view, right beside the strip */}
      <button type="button" onClick={() => setSheet(true)} aria-haspopup="dialog" aria-label="Show all categories" className="flex shrink-0 items-center gap-1.5 rounded-full bg-green-600 px-3 py-2 text-sm font-semibold text-white shadow-[0_8px_18px_-8px_rgba(22,163,74,0.8)] transition-transform active:scale-95 lg:hidden">
        <LayoutGrid className="h-4 w-4" /> All
      </button>
      <nav aria-label="Categories" className={cn('no-scrollbar flex min-w-0 flex-1 items-center gap-1.5 overflow-x-auto py-2', className)}>
        {CATEGORIES.map((cat) => {
          const { Icon } = categoryMeta(cat.slug)
          const isActive = onBrowse && active === cat.slug
          return (
            <motion.div key={cat.slug} whileHover={{ y: -2 }} whileTap={{ scale: 0.96 }} transition={SPRING.snappy} className="shrink-0">
              <Link
                href={`/browse?category=${cat.slug}`}
                aria-current={isActive ? 'page' : undefined}
                className={cn(
                  'group relative flex items-center gap-2 rounded-full px-3.5 py-2 text-sm font-medium whitespace-nowrap transition-colors',
                  isActive ? 'text-green-800' : 'text-ink-soft hover:bg-white hover:text-ink hover:shadow-soft'
                )}
              >
                {isActive && <motion.span layoutId="category-active" transition={SPRING.snappy} className="absolute inset-0 rounded-full bg-green-100 ring-1 ring-green-200" />}
                <Icon className="relative h-4 w-4 transition-transform duration-300 group-hover:-rotate-12 group-hover:scale-110" strokeWidth={2} aria-hidden />
                <span className="relative">{cat.name}</span>
              </Link>
            </motion.div>
          )
        })}
      </nav>
      </div>
      <AllCategoriesSheet open={sheet} onClose={() => setSheet(false)} active={onBrowse ? active : null} />
    </LayoutGroup>
  )
}
