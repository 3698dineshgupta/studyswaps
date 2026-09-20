'use client'

import { useEffect, useRef, useState } from 'react'
import { usePathname, useSearchParams } from 'next/navigation'
import { AnimatePresence, motion } from 'motion/react'

/**
 * Instant click feedback: a slim green bar starts the moment an in-app link is pressed and finishes when the
 * next page arrives — so a navigation never feels dead, even while the next page is still loading.
 */
export default function NavigationProgress() {
  const pathname = usePathname()
  const search = useSearchParams()
  const [state, setState] = useState<'idle' | 'loading' | 'done'>('idle')
  const timer = useRef<ReturnType<typeof setTimeout>>()

  // New page arrived → finish the bar
  useEffect(() => {
    setState((s) => (s === 'loading' ? 'done' : s))
    clearTimeout(timer.current)
    timer.current = setTimeout(() => setState('idle'), 350)
    return () => clearTimeout(timer.current)
  }, [pathname, search])

  // Any press on an internal link starts it
  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return
      const a = (e.target as HTMLElement).closest?.('a[href]') as HTMLAnchorElement | null
      if (!a || a.target === '_blank' || a.hasAttribute('download')) return
      const url = new URL(a.href, location.href)
      if (url.origin !== location.origin) return
      if (url.pathname === location.pathname && url.search === location.search) return
      clearTimeout(timer.current)
      setState('loading')
    }
    document.addEventListener('click', onClick, true)
    return () => document.removeEventListener('click', onClick, true)
  }, [])

  return (
    <AnimatePresence>
      {state !== 'idle' && (
        <motion.div
          key="nav-progress"
          aria-hidden
          className="pointer-events-none fixed inset-x-0 top-0 z-[200] h-[3px] origin-left bg-green-500 shadow-[0_0_10px_rgba(34,197,94,0.7)]"
          initial={{ scaleX: 0, opacity: 1 }}
          animate={state === 'done' ? { scaleX: 1, opacity: 0 } : { scaleX: 0.85 }}
          exit={{ opacity: 0 }}
          transition={state === 'done' ? { duration: 0.25 } : { duration: 6, ease: [0.1, 0.6, 0.3, 1] }}
        />
      )}
    </AnimatePresence>
  )
}
