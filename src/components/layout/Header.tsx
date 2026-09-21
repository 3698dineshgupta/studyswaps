'use client'

import Link from 'next/link'
import { Suspense, useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { AnimatePresence, motion } from 'motion/react'
import {
  Bell, Search, ChevronDown, LogOut, Heart,
  Package, LayoutDashboard, Shield, ShieldCheck, User, Plus, X,
} from 'lucide-react'
import { getSupabase } from '@/lib/supabase/lazy'
import Avatar from '@/components/ui/Avatar'
import { VerifiedBadge } from '@/components/shared/VerifiedBadge'
import CategoryPills from '@/components/marketplace/CategoryPills'
import { useWishlist } from '@/hooks/useWishlist'
import { useAuthState } from '@/components/auth/AuthProvider'
import CartIconLink from '@/components/cart/CartIconLink'
import { CityPicker } from '@/components/city/CityProvider'
import { popover, SPRING } from '@/lib/motion'
import { BrandMark, Wordmark } from '@/components/brand/Logo'
import { cn } from '@/lib/utils'


/** Icon button with a count badge that pops when the number changes. */
function IconLink({ href, label, count, children, className }: { href: string; label: string; count?: number; children: React.ReactNode; className?: string }) {
  return (
    <motion.div whileTap={{ scale: 0.92 }} whileHover={{ y: -1 }} transition={SPRING.snappy} className={className}>
      <Link href={href} aria-label={count ? `${label} (${count})` : label} className="relative flex h-10 w-10 items-center justify-center rounded-full text-ink-soft transition-colors hover:bg-gray-100 hover:text-ink">
        {children}
        <AnimatePresence>
          {!!count && (
            <motion.span
              key={count}
              initial={{ scale: 0.4, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.4, opacity: 0 }}
              transition={SPRING.bouncy}
              className="absolute -right-0.5 -top-0.5 flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-green-600 px-1 text-[10px] font-bold text-white ring-2 ring-white"
            >
              {count > 9 ? '9+' : count}
            </motion.span>
          )}
        </AnimatePresence>
      </Link>
    </motion.div>
  )
}

export function Header() {
  const { profile, signOut, isAdmin } = useAuthState()
  const [notifCount, setNotifCount] = useState(0)
  const [query, setQuery] = useState('')
  const [menuOpen, setMenuOpen] = useState(false)
  const [mobileSearch, setMobileSearch] = useState(false)
  const [scrolled, setScrolled] = useState(false)
  const router = useRouter()
  const searchRef = useRef<HTMLInputElement>(null)
  const { count: wishCount } = useWishlist()

  // Unread notifications (the profile itself comes from the server, so it is there on first paint)
  useEffect(() => {
    if (!profile) { setNotifCount(0); return }
    let cancelled = false
    // After the page is interactive: the client library is fetched lazily, and only for signed-in visitors
    getSupabase().then((supabase) => supabase.from('notifications').select('id', { count: 'exact', head: true }).eq('profile_id', profile.id).eq('is_read', false))
      .then(({ count }) => { if (!cancelled) setNotifCount(count || 0) })
    return () => { cancelled = true }
  }, [profile])

  // Header turns from soft-transparent to frosted white once you scroll
  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8)
    onScroll()
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  // "/" focuses search, Esc closes menus
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const typing = /input|textarea|select/i.test((e.target as HTMLElement)?.tagName ?? '')
      if (e.key === '/' && !typing) { e.preventDefault(); searchRef.current?.focus() }
      if (e.key === 'Escape') { setMenuOpen(false); setMobileSearch(false) }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault()
    if (!query.trim()) return
    setMobileSearch(false)
    router.push(`/browse?q=${encodeURIComponent(query.trim())}`)
  }

  const handleSignOut = async () => {
    setMenuOpen(false)
    await signOut()
  }

  const menuLinks = [
    // Admins get the control panel right in their account menu; nobody else ever sees this item
    ...(isAdmin ? [{ href: '/admin', label: 'Admin panel', Icon: ShieldCheck, admin: true }] : []),
    { href: '/profile', label: 'My Profile', Icon: User },
    { href: '/orders', label: 'My Orders', Icon: Package },
    { href: '/wishlist', label: 'Wishlist', Icon: Heart },
    { href: '/dashboard', label: 'Seller Dashboard', Icon: LayoutDashboard },
    // Buyers never need this; it only appears for accounts that want to (or already tried to) sell
    ...(profile?.verification_status !== 'VERIFIED' && profile?.is_seller ? [{ href: '/verify', label: 'Verify to sell', Icon: Shield }] : []),
  ]

  return (
    <header
      className={cn(
        'sticky top-0 z-50 border-b transition-all duration-300',
        scrolled ? 'border-gray-200/70 bg-white/85 shadow-soft backdrop-blur-xl' : 'border-transparent bg-white/60 backdrop-blur-md'
      )}
    >
      <div className="page-container">
        <div className="flex h-16 items-center gap-3 lg:h-[68px]">
          {/* Logo */}
          <Link href="/" className="flex shrink-0 items-center gap-2.5" aria-label="StudySwaps home">
            <motion.span whileHover={{ rotate: -6, scale: 1.06 }} transition={SPRING.bouncy} className="flex">
              <BrandMark priority className="h-9 lg:h-10" />
            </motion.span>
            <Wordmark className="hidden text-xl sm:block" />
          </Link>

          <CityPicker />

          {/* Desktop search — the star of the header */}
          <form onSubmit={handleSearch} role="search" className="group mx-auto hidden min-w-0 flex-1 max-w-xl transition-[max-width] duration-300 focus-within:max-w-2xl md:block">
            <label className="sr-only" htmlFor="site-search">Search the marketplace</label>
            <div className="relative">
              <Search className="pointer-events-none absolute left-4 top-1/2 h-[18px] w-[18px] -translate-y-1/2 text-gray-400 transition-colors group-focus-within:text-green-600" />
              <input
                id="site-search"
                ref={searchRef}
                type="search"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search books, electronics, furniture, hostel items..."
                className="h-11 w-full rounded-full border border-gray-200 bg-white/90 pl-11 pr-14 text-sm text-ink shadow-sm outline-none transition-all duration-300 placeholder:text-gray-400 hover:border-gray-300 focus:border-green-500 focus:bg-white focus:shadow-lift focus:ring-4 focus:ring-green-500/10"
              />
              <kbd className="pointer-events-none absolute right-4 top-1/2 hidden -translate-y-1/2 rounded-md border border-gray-200 bg-gray-50 px-1.5 py-0.5 text-[11px] font-medium text-gray-400 transition-opacity group-focus-within:opacity-0 lg:block">/</kbd>
            </div>
          </form>

          {/* Actions */}
          <div className="ml-auto flex shrink-0 items-center gap-0.5 md:ml-0">
            <button onClick={() => setMobileSearch((v) => !v)} className="flex h-10 w-10 items-center justify-center rounded-full text-ink-soft hover:bg-gray-100 md:hidden" aria-label={mobileSearch ? 'Close search' : 'Search'} aria-expanded={mobileSearch}>
              {mobileSearch ? <X className="h-5 w-5" /> : <Search className="h-5 w-5" />}
            </button>

            <IconLink href="/wishlist" label="Wishlist" count={wishCount} className="hidden sm:block"><Heart className="h-[20px] w-[20px]" /></IconLink>
            <CartIconLink />
            {profile && <IconLink href="/notifications" label="Notifications" count={notifCount} className="hidden sm:block"><Bell className="h-[20px] w-[20px]" /></IconLink>}

            <motion.div whileHover={{ y: -1 }} whileTap={{ scale: 0.96 }} transition={SPRING.snappy} className="ml-1.5 hidden sm:block">
              <Link href="/sell" className="flex h-10 items-center gap-1.5 rounded-full bg-green-600 px-4 text-sm font-semibold text-white shadow-[0_8px_20px_-8px_rgba(22,163,74,0.8)] transition-colors hover:bg-green-700">
                <Plus className="h-4 w-4" strokeWidth={2.5} /> Sell
              </Link>
            </motion.div>

            {profile ? (
              <div className="relative ml-1">
                <button onClick={() => setMenuOpen((v) => !v)} aria-haspopup="menu" aria-expanded={menuOpen} aria-label="Account menu" className="flex items-center gap-1.5 rounded-full p-1 pr-2 transition-colors hover:bg-gray-100">
                  <Avatar name={profile.full_name} src={profile.profile_photo} size="sm" />
                  <ChevronDown className={cn('hidden h-3.5 w-3.5 text-gray-500 transition-transform duration-200 sm:block', menuOpen && 'rotate-180')} />
                </button>

                <AnimatePresence>
                  {menuOpen && (
                    <>
                      <div className="fixed inset-0 z-10" onClick={() => setMenuOpen(false)} />
                      <motion.div
                        role="menu"
                        variants={popover}
                        initial="hidden"
                        animate="show"
                        exit="hidden"
                        style={{ transformOrigin: 'top right' }}
                        className="absolute right-0 top-full z-20 mt-2 w-60 overflow-hidden rounded-2xl border border-gray-200/70 bg-white py-1.5 shadow-lift"
                      >
                        <div className="border-b border-gray-100 px-4 py-3">
                          <p className="truncate text-sm font-semibold text-ink">{profile.full_name}</p>
                          <div className="mt-1"><VerifiedBadge status={profile.verification_status} size="sm" /></div>
                        </div>
                        <nav className="py-1">
                          {menuLinks.map((item) => { const { href, label, Icon } = item; const adminItem = 'admin' in item; return (
                            <Link key={href} href={href} role="menuitem" onClick={() => setMenuOpen(false)} className={cn('group flex items-center gap-3 px-4 py-2.5 text-sm transition-colors', adminItem ? 'mx-1.5 my-1 rounded-xl bg-green-50 font-semibold text-green-800 hover:bg-green-100' : 'text-ink-soft hover:bg-gray-50 hover:text-ink')}>
                              <Icon className={cn('h-4 w-4 transition-transform group-hover:scale-110', adminItem ? 'text-green-700' : 'text-gray-400 group-hover:text-green-600')} /> {label}
                            </Link>
                          ) })}
                        </nav>
                        <div className="border-t border-gray-100 py-1">
                          <button onClick={handleSignOut} role="menuitem" className="flex w-full items-center gap-3 px-4 py-2.5 text-left text-sm text-red-600 transition-colors hover:bg-red-50">
                            <LogOut className="h-4 w-4" /> Sign out
                          </button>
                        </div>
                      </motion.div>
                    </>
                  )}
                </AnimatePresence>
              </div>
            ) : (
              <div className="ml-1 flex shrink-0 items-center gap-1.5">
                <Link href="/login" className="shrink-0 whitespace-nowrap rounded-full px-3.5 py-2 text-sm font-semibold text-ink-soft transition-colors hover:bg-gray-100 hover:text-ink">Log in</Link>
                <Link href="/register" className="hidden shrink-0 whitespace-nowrap rounded-full border border-gray-200 bg-white px-4 py-2 text-sm font-semibold text-ink shadow-sm transition-all hover:border-gray-300 hover:shadow-soft sm:block">Sign up</Link>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Mobile search (slides open) */}
      <AnimatePresence initial={false}>
        {mobileSearch && (
          <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.25 }} className="overflow-hidden md:hidden">
            <form onSubmit={handleSearch} role="search" className="px-4 pb-3">
              <div className="relative">
                <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
                <input type="search" autoFocus value={query} onChange={(e) => setQuery(e.target.value)} aria-label="Search" placeholder="Search books, electronics, furniture..." className="h-11 w-full rounded-full border border-gray-200 bg-white pl-11 pr-4 text-sm outline-none focus:border-green-500 focus:ring-4 focus:ring-green-500/10" />
              </div>
            </form>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Category pills — full row on desktop, horizontal scroll on mobile */}
      <div className="border-t border-gray-100/80">
        <div className="page-container">
          <Suspense fallback={<div className="h-[52px]" />}>
            <CategoryPills />
          </Suspense>
        </div>
      </div>
    </header>
  )
}

export default Header
