'use client'

import { useCallback } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import toast from 'react-hot-toast'
import type { CardProduct } from '@/components/marketplace/ProductCard'

/* eslint-disable @typescript-eslint/no-explicit-any */

/** Same key as useCart / Header / cart page — one source of truth for the cart. */
export const CART_KEY = ['cart'] as const

export async function fetchCart() {
  const res = await fetch('/api/cart')
  if (!res.ok) throw new Error('Failed to fetch cart')
  return res.json()
}

const cartQuery = { queryKey: CART_KEY, queryFn: fetchCart, retry: false } as const

const sumQuantity = (cart: any): number => (cart?.items ?? []).reduce((n: number, it: any) => n + (Number(it.quantity) || 0), 0)

/** Total units in the cart (header badge, popup). Re-renders only when the number changes. */
export function useCartCount() {
  return useQuery({ ...cartQuery, select: sumQuantity }).data ?? 0
}

/** Quantity of ONE product in the cart. A product card subscribing to this re-renders only when its own quantity changes. */
export function useCartQuantity(productId: string) {
  return useQuery({
    ...cartQuery,
    select: (cart: any) => (cart?.items ?? []).find((it: any) => it.product?.id === productId)?.quantity ?? 0,
  }).data ?? 0
}

// ---- server calls -----------------------------------------------------------

class GuestError extends Error {}

async function call(method: 'POST' | 'PATCH' | 'DELETE', body: object) {
  const res = await fetch('/api/cart', { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
  if (res.status === 401) throw new GuestError('Please log in')
  if (!res.ok) {
    const j = await res.json().catch(() => ({}))
    throw new Error(j.error || 'Something went wrong')
  }
}

/** Requests for the same product run one after another, so a quick "+" right after "ADD" can't race it. */
const chains = new Map<string, Promise<unknown>>()
function enqueue(productId: string, job: () => Promise<void>) {
  const prev = chains.get(productId) ?? Promise.resolve()
  const next = prev.catch(() => undefined).then(job)
  chains.set(productId, next)
  const clear = () => { if (chains.get(productId) === next) chains.delete(productId) }
  next.then(clear, clear)
  return next
}

// ---- optimistic cache edits -------------------------------------------------

function optimisticItem(p: CardProduct, quantity: number) {
  const images = p.images ?? p.product_images ?? []
  return {
    id: `optimistic-${p.id}`,
    quantity,
    product: { id: p.id, title: p.title, price: p.price, original_price: p.original_price ?? null, status: 'ACTIVE', quantity: p.quantity ?? 1, location: p.location, product_images: images },
  }
}

function withQuantity(cart: any, p: CardProduct, quantity: number) {
  const items: any[] = cart?.items ?? []
  const has = items.some((it) => it.product?.id === p.id)
  const next = quantity <= 0
    ? items.filter((it) => it.product?.id !== p.id)
    : has ? items.map((it) => (it.product?.id === p.id ? { ...it, quantity } : it)) : [optimisticItem(p, quantity), ...items]
  const total = next.reduce((s, it) => s + (Number(it.product?.price) || 0) * it.quantity, 0)
  return { ...(cart ?? {}), items: next, total, itemCount: next.length }
}

export interface CartControls {
  quantity: number
  /** How many the seller has in stock (the "+" stops here). */
  stock: number
  /** Returns true when the add was accepted, so the caller can start its fly animation. */
  add: (onFail?: () => void) => boolean
  increment: () => void
  decrement: () => void
}

/**
 * Cart controls for one product card. Updates the shared ['cart'] cache instantly (optimistic),
 * confirms with the server, and rolls back with a message if the server says no.
 */
export function useCartControls(product: CardProduct): CartControls {
  const qc = useQueryClient()
  const router = useRouter()
  const pathname = usePathname()
  const quantity = useCartQuantity(product.id)
  const stock = Math.max(1, Number(product.quantity ?? 1))

  const goLogin = useCallback(() => {
    toast('Log in to add items to your cart')
    router.push(`/login?redirectTo=${encodeURIComponent(pathname || '/')}`)
  }, [router, pathname])

  const settle = useCallback(async (run: () => Promise<void>, rollback: any, onFail?: () => void) => {
    try {
      await run()
    } catch (err) {
      qc.setQueryData(CART_KEY, rollback)
      onFail?.()
      if (err instanceof GuestError) goLogin()
      else toast.error((err as Error).message)
    } finally {
      // Refetch only once the last in-flight change is done, so a slow reply can't undo a newer tap
      if (chains.size === 0) qc.invalidateQueries({ queryKey: CART_KEY })
    }
  }, [qc, goLogin])

  const current = () => (qc.getQueryData(CART_KEY) as any)

  const setTo = useCallback((q: number, request: () => Promise<void>, onFail?: () => void) => {
    // A refetch that started before this tap must not land afterwards and undo it
    void qc.cancelQueries({ queryKey: CART_KEY })
    const before = current()
    qc.setQueryData(CART_KEY, withQuantity(before, product, q))
    return settle(() => enqueue(product.id, request), before, onFail)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [qc, product, settle])

  const add = useCallback((onFail?: () => void) => {
    if (current()?.guest) {
      // The cached cart may date from before this person signed in. Ask the server again before sending them to log in.
      void qc.fetchQuery({ ...cartQuery, staleTime: 0 }).then((fresh: any) => {
        if (fresh?.guest) goLogin()
        else void setTo(1, () => call('POST', { productId: product.id, quantity: 1 }), onFail)
      }).catch(() => goLogin())
      return false
    }
    void setTo(1, () => call('POST', { productId: product.id, quantity: 1 }), onFail)
    return true
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [setTo, goLogin, product.id])

  const increment = useCallback(() => {
    if (quantity >= stock) { toast(stock === 1 ? 'Only 1 available — this is a one-of-a-kind find' : `Only ${stock} available`); return }
    void setTo(quantity + 1, () => call('PATCH', { productId: product.id, quantity: quantity + 1 }))
  }, [quantity, stock, setTo, product.id])

  const decrement = useCallback(() => {
    if (quantity <= 1) void setTo(0, () => call('DELETE', { productId: product.id }))
    else void setTo(quantity - 1, () => call('PATCH', { productId: product.id, quantity: quantity - 1 }))
  }, [quantity, setTo, product.id])

  return { quantity, stock, add, increment, decrement }
}
