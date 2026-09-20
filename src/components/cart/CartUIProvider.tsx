'use client'

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { usePathname } from 'next/navigation'
import { useReducedMotion } from 'motion/react'
import FlyingProductAnimation, { type Flight } from './FlyingProductAnimation'
import FloatingCartSummary from './FloatingCartSummary'

interface CartUI {
  /** The header cart icon registers itself here so flights know where to land */
  registerTarget: (el: HTMLElement) => () => void
  /** Start the photo-flies-to-cart animation. `origin` is where it takes off from; `photo` (optional) supplies the picture. Returns an id, or null if skipped. */
  fly: (origin: HTMLElement | null, photo?: HTMLImageElement | null) => string | null
  cancelFly: (id: string | null) => void
  /** Ticks each time something lands in the cart (drives the icon pulse) */
  pulseKey: number
  /** Ticks each time an item lands (the popup shows "Added to cart" briefly) */
  addedKey: number
  pulse: () => void
  /** Items still in the air — the badge waits for them to land before counting them */
  flyingCount: number
  popupOpen: boolean
  closePopup: () => void
}

const Ctx = createContext<CartUI | null>(null)

export function useCartUI() {
  const ctx = useContext(Ctx)
  if (!ctx) throw new Error('useCartUI must be used inside CartUIProvider')
  return ctx
}

// Pages that already show the cart in full — no popup there
const NO_POPUP = ['/cart', '/checkout', '/login', '/register', '/admin', '/verify']

/** Owns the transient cart UI: flights, header pulse, and the floating summary. Cart DATA stays in react-query ['cart']. */
export function CartUIProvider({ children }: { children: React.ReactNode }) {
  const reduced = useReducedMotion()
  const pathname = usePathname() ?? '/'
  // Desktop and mobile headers each have a cart icon; the visible one (non-zero size) is the landing spot
  const targets = useRef(new Set<HTMLElement>())
  const [flights, setFlights] = useState<Flight[]>([])
  const [pulseKey, setPulseKey] = useState(0)
  const [popupOpen, setPopupOpen] = useState(false)
  const [addedKey, setAddedKey] = useState(0)
  const [mounted, setMounted] = useState(false)
  useEffect(() => setMounted(true), [])

  const registerTarget = useCallback((el: HTMLElement) => { targets.current.add(el); return () => { targets.current.delete(el) } }, [])
  const pulse = useCallback(() => setPulseKey((k) => k + 1), [])
  const land = useCallback(() => { setPulseKey((k) => k + 1); setAddedKey((k) => k + 1); setPopupOpen(true) }, [])

  const fly = useCallback((origin: HTMLElement | null, photo?: HTMLImageElement | null) => {
    const r = origin?.getBoundingClientRect()
    let t: DOMRect | undefined
    for (const el of Array.from(targets.current)) { const b = el.getBoundingClientRect(); if (b.width > 0 && b.height > 0) { t = b; break } }
    // Reduced motion (or nothing to fly to): no travel — just the short pulse + popup
    if (reduced || !t || !r || !r.width) { land(); return null }

    const img = photo ?? (origin instanceof HTMLImageElement ? origin : origin?.querySelector('img'))
    const id = `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`
    setFlights((f) => [...f, {
      id,
      src: img?.currentSrc || img?.src || null,
      from: { x: r.left, y: r.top, w: r.width, h: r.height },
      to: { x: t.left + t.width / 2, y: t.top + t.height / 2 },
    }])
    return id
  }, [reduced, land])

  const cancelFly = useCallback((id: string | null) => {
    if (id) setFlights((f) => f.filter((x) => x.id !== id))
  }, [])

  const onLanded = useCallback((id: string) => {
    setFlights((f) => f.filter((x) => x.id !== id))
    land()
  }, [land])

  // Leaving for the cart / checkout closes the popup
  useEffect(() => { if (NO_POPUP.some((p) => pathname.startsWith(p))) setPopupOpen(false) }, [pathname])

  const value = useMemo<CartUI>(() => ({
    registerTarget, fly, cancelFly, pulseKey, addedKey, pulse, flyingCount: flights.length,
    popupOpen, closePopup: () => setPopupOpen(false),
  }), [registerTarget, fly, cancelFly, pulseKey, addedKey, pulse, flights.length, popupOpen])

  return (
    <Ctx.Provider value={value}>
      {children}
      {mounted && createPortal(
        <>
          {flights.map((f) => <FlyingProductAnimation key={f.id} flight={f} onDone={onLanded} />)}
          <FloatingCartSummary />
        </>,
        document.body,
      )}
    </Ctx.Provider>
  )
}

export default CartUIProvider
