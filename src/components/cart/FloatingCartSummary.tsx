'use client'

import Link from 'next/link'
import Image from 'next/image'
import { useEffect, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { AnimatePresence, motion, useReducedMotion } from 'motion/react'
import { ArrowRight, Check, ImageOff, X } from 'lucide-react'
import { CART_KEY, fetchCart } from '@/hooks/useCartItem'
import { useCartUI } from './CartUIProvider'
import { SPRING } from '@/lib/motion'
import { formatPrice, getSupabaseImageUrl, isCloudinaryUrl } from '@/lib/utils'

/* eslint-disable @typescript-eslint/no-explicit-any */

const MAX_THUMBS = 3

/**
 * The one floating cart summary. Bottom-right on desktop, a bar above the bottom nav on mobile.
 * Appears after each add (even if it was closed before), reads the real cart, and links to /cart.
 */
export function FloatingCartSummary() {
  const { popupOpen, closePopup, addedKey } = useCartUI()
  // "Added to cart" headline for a few seconds after each add, then the plain item count
  const [fresh, setFresh] = useState(false)
  useEffect(() => {
    if (!addedKey) return
    setFresh(true)
    const t = setTimeout(() => setFresh(false), 3200)
    return () => clearTimeout(t)
  }, [addedKey])
  const reduced = useReducedMotion()
  const { data: cart } = useQuery({ queryKey: CART_KEY, queryFn: fetchCart, retry: false })

  // Sit above the mobile bottom nav when this page has one; otherwise hug the bottom edge
  const [inset, setInset] = useState<'nav' | 'bar' | 'none'>('nav')
  useEffect(() => {
    if (!popupOpen) return
    setInset(document.querySelector('[data-bottom-bar]') ? 'bar' : document.querySelector('nav[aria-label="Primary"]') ? 'nav' : 'none')
  }, [popupOpen])

  const items: any[] = cart?.items ?? []
  const units = items.reduce((n, it) => n + (Number(it.quantity) || 0), 0)
  const total = items.reduce((s, it) => s + (Number(it.product?.price) || 0) * (Number(it.quantity) || 0), 0)
  const show = popupOpen && units > 0
  const extra = Math.max(0, items.length - MAX_THUMBS)

  return (
    <AnimatePresence>
      {show && (
        <motion.aside
          key="cart-summary"
          role="status"
          aria-live="polite"
          aria-label="Cart summary"
          initial={reduced ? { opacity: 0 } : { opacity: 0, y: 20, scale: 0.96 }}
          animate={reduced ? { opacity: 1 } : { opacity: 1, y: 0, scale: 1 }}
          exit={reduced ? { opacity: 0, transition: { duration: 0.12 } } : { opacity: 0, y: 12, scale: 0.98, transition: { duration: 0.18, ease: 'easeIn' } }}
          transition={reduced ? { duration: 0.15 } : SPRING.soft}
          // Mobile: full-width bar just above the bottom nav (64px) + safe area. Desktop: card, bottom-right.
          className={`fixed inset-x-3 z-50 lg:inset-x-auto lg:bottom-6 lg:right-6 lg:w-[400px] ${inset === 'nav' ? 'bottom-[calc(4.75rem+env(safe-area-inset-bottom))]' : inset === 'bar' ? 'bottom-[calc(5.75rem+env(safe-area-inset-bottom))]' : 'bottom-[calc(0.75rem+env(safe-area-inset-bottom))]'}`}
        >
          <div className="relative flex items-center gap-3 rounded-2xl border border-gray-200/80 bg-white/95 p-2.5 shadow-lift sm:p-3 backdrop-blur-xl">
            <div className="flex shrink-0 items-center pl-1" aria-hidden>
              {items.slice(0, MAX_THUMBS).map((it, i) => {
                const p = it.product ?? {}
                const img = p.product_images?.find((x: any) => x.is_primary) ?? p.product_images?.[0]
                const src = img ? getSupabaseImageUrl(img.storage_path, 96) : null
                return (
                  <span key={it.id} className="relative -ml-3 block h-8 w-8 sm:h-10 sm:w-10 overflow-hidden rounded-xl bg-gray-100 ring-2 ring-white first:ml-0" style={{ zIndex: MAX_THUMBS - i }}>
                    {src ? <Image src={src} alt="" fill sizes="40px" unoptimized={isCloudinaryUrl(src)} className="object-cover" /> : <span className="flex h-full w-full items-center justify-center text-gray-300"><ImageOff className="h-4 w-4" /></span>}
                  </span>
                )
              })}
              {extra > 0 && (
                <span className="relative -ml-3 flex h-8 min-w-8 sm:h-10 sm:min-w-10 items-center justify-center rounded-xl bg-green-50 px-1.5 text-xs font-bold text-green-700 ring-2 ring-white">+{extra}</span>
              )}
            </div>

            <div className="min-w-0 flex-1">
              <p className="flex items-center gap-1.5 whitespace-nowrap text-[13px] font-semibold text-ink">
                <AnimatePresence mode="wait" initial={false}>
                  <motion.span key={fresh ? 'added' : 'count'} initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -4 }} transition={{ duration: 0.15 }} className={fresh ? 'flex items-center gap-1 text-green-700' : ''}>
                    {fresh ? <><Check className="h-3.5 w-3.5" strokeWidth={3} /> Added to cart</> : <>{units} {units === 1 ? 'item' : 'items'}<span className="hidden font-normal text-ink-muted sm:inline"> in cart</span></>}
                  </motion.span>
                </AnimatePresence>
              </p>
              <p className="whitespace-nowrap font-display text-base font-extrabold leading-tight text-ink">{fresh ? <>{units} {units === 1 ? 'item' : 'items'} · </> : null}{formatPrice(total)}</p>
            </div>

            <motion.div whileTap={{ scale: 0.96 }} transition={SPRING.snappy}>
              <Link href="/cart" onClick={closePopup} className="group flex h-10 items-center gap-1.5 whitespace-nowrap rounded-full bg-green-600 px-3.5 text-sm sm:px-4 font-bold text-white shadow-[0_8px_20px_-8px_rgba(22,163,74,0.8)] transition-colors hover:bg-green-700">
                View Cart <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
              </Link>
            </motion.div>

            <button type="button" onClick={closePopup} aria-label="Close cart summary" className="absolute -right-1.5 -top-2 flex h-6 w-6 items-center justify-center rounded-full border border-gray-200 bg-white text-gray-500 shadow-soft transition-colors hover:text-ink">
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        </motion.aside>
      )}
    </AnimatePresence>
  )
}

export default FloatingCartSummary
