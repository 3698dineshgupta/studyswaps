'use client'

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import { createPortal } from 'react-dom'
import { usePathname, useRouter } from 'next/navigation'
import { useQueryClient } from '@tanstack/react-query'
import { AnimatePresence, motion } from 'motion/react'
import { ArrowRight, MapPin } from 'lucide-react'
import { CITY_COOKIE, LAUNCH_CITIES, cityBySlug, type CitySlug } from '@/lib/cities'
import { SPRING } from '@/lib/motion'
import { cn } from '@/lib/utils'

interface CityState {
  /** The city whose listings this visitor sees (null until they choose) */
  city: CitySlug | null
  setCity: (c: CitySlug) => void
}

const Ctx = createContext<CityState | null>(null)

export function useCity() {
  const ctx = useContext(Ctx)
  if (!ctx) throw new Error('useCity must be used inside CityProvider')
  return ctx
}

// Pages that shouldn't be blocked by the city question
const QUIET = ['/login', '/register', '/forgot-password', '/policies', '/admin', '/auth', '/verify']

/**
 * We launched in Kathmandu and Butwal. Everyone shops in one of them and sees that city's listings.
 * The server decides the first answer (saved choice, else the city on their profile); if there is none,
 * a one-time popup asks. The choice is remembered in a cookie, so server pages can filter by it.
 */
export function CityProvider({ initialCity, children }: { initialCity: CitySlug | null; children: React.ReactNode }) {
  const [city, setCityState] = useState<CitySlug | null>(initialCity)
  const router = useRouter()
  const qc = useQueryClient()
  const pathname = usePathname() ?? '/'
  const [mounted, setMounted] = useState(false)
  useEffect(() => setMounted(true), [])
  useEffect(() => { setCityState(initialCity) }, [initialCity])

  const setCity = useCallback((c: CitySlug) => {
    document.cookie = `${CITY_COOKIE}=${c}; path=/; max-age=31536000; samesite=lax`
    setCityState(c)
    qc.invalidateQueries({ queryKey: ['products'] })
    router.refresh()
  }, [qc, router])

  const value = useMemo(() => ({ city, setCity }), [city, setCity])
  const ask = mounted && !city && !QUIET.some((p) => pathname.startsWith(p))

  return (
    <Ctx.Provider value={value}>
      {children}
      {mounted && createPortal(
        <AnimatePresence>
          {ask && (
            <div className="fixed inset-0 z-[100] flex items-end justify-center sm:items-center sm:p-6">
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="absolute inset-0 bg-ink/50 backdrop-blur-sm" />
              <motion.div role="dialog" aria-modal="true" aria-labelledby="city-title" initial={{ opacity: 0, y: 40, scale: 0.97 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: 20 }} transition={SPRING.soft}
                className="relative w-full max-w-md rounded-t-3xl bg-white p-6 pb-[calc(1.5rem+env(safe-area-inset-bottom))] shadow-lift sm:rounded-3xl">
                <span className="mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-green-100 text-green-700"><MapPin className="h-6 w-6" /></span>
                <h2 id="city-title" className="font-display text-2xl font-extrabold tracking-tight text-ink">Where are you shopping from?</h2>
                <p className="mt-1.5 text-sm text-ink-muted">We&apos;ve launched in two cities. You&apos;ll see listings from yours, so everything is close and quick to deliver.</p>
                <div className="mt-5 grid gap-3">
                  {LAUNCH_CITIES.map((c) => (
                    <motion.button key={c.slug} type="button" whileTap={{ scale: 0.98 }} onClick={() => setCity(c.slug)} className="group flex items-center justify-between rounded-2xl border-2 border-gray-200 p-4 text-left transition-colors hover:border-green-500 hover:bg-green-50/60">
                      <span><span className="block font-display text-lg font-bold text-ink">{c.name}</span><span className="text-xs text-ink-muted">{c.blurb}</span></span>
                      <ArrowRight className="h-5 w-5 text-gray-400 transition-transform group-hover:translate-x-1 group-hover:text-green-600" />
                    </motion.button>
                  ))}
                </div>
                <p className="mt-4 text-center text-xs text-ink-muted">More cities coming soon. You can switch any time from the top bar.</p>
              </motion.div>
            </div>
          )}
        </AnimatePresence>,
        document.body,
      )}
    </Ctx.Provider>
  )
}

/** Header control: shows the current city and lets you switch. */
export function CityPicker({ className }: { className?: string }) {
  const { city, setCity } = useCity()
  const [open, setOpen] = useState(false)
  const current = cityBySlug(city)

  return (
    <div className={cn('relative', className)}>
      <button type="button" onClick={() => setOpen((o) => !o)} aria-haspopup="listbox" aria-expanded={open} aria-label={`Change city. Current: ${current?.name ?? 'not chosen'}`} className="flex h-9 items-center gap-1.5 rounded-full border border-gray-200 bg-white/80 px-3 text-sm font-semibold text-ink-soft transition-colors hover:border-green-300 hover:text-ink active:scale-95">
        <MapPin className="h-4 w-4 text-green-600" />
        <span className="max-w-[5.5rem] truncate">{current?.name ?? 'Choose city'}</span>
      </button>
      <AnimatePresence>
        {open && (
          <>
            <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
            <motion.ul role="listbox" initial={{ opacity: 0, y: -6, scale: 0.97 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.12 }} className="absolute left-0 top-full z-20 mt-2 w-52 overflow-hidden rounded-2xl border border-gray-200/70 bg-white p-1.5 shadow-lift">
              {LAUNCH_CITIES.map((c) => (
                <li key={c.slug} role="option" aria-selected={c.slug === city}>
                  <button type="button" onClick={() => { setOpen(false); if (c.slug !== city) setCity(c.slug) }} className={cn('flex w-full items-center justify-between rounded-xl px-3 py-2.5 text-left text-sm transition-colors', c.slug === city ? 'bg-green-50 font-semibold text-green-800' : 'text-ink-soft hover:bg-gray-50')}>
                    <span>{c.name}<span className="block text-[11px] font-normal text-ink-muted">{c.blurb}</span></span>
                    {c.slug === city && <span className="h-2 w-2 rounded-full bg-green-600" />}
                  </button>
                </li>
              ))}
            </motion.ul>
          </>
        )}
      </AnimatePresence>
    </div>
  )
}
