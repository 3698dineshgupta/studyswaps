'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { LayoutGroup, motion } from 'motion/react'
import { Home, LayoutGrid, Plus, Package, User } from 'lucide-react'
import { SPRING } from '@/lib/motion'
import { cn } from '@/lib/utils'

const NAV_ITEMS = [
  { href: '/', label: 'Home', Icon: Home },
  { href: '/browse', label: 'Browse', Icon: LayoutGrid },
  { href: '/sell', label: 'Sell', Icon: Plus, primary: true },
  { href: '/orders', label: 'Orders', Icon: Package },
  { href: '/profile', label: 'Profile', Icon: User },
]

/** Mobile bottom navigation. Hidden on desktop, admin and auth screens. */
export function MobileNav() {
  const pathname = usePathname()
  // The product page has its own sticky buy bar instead of the bottom nav
  if (pathname.startsWith('/product/') || pathname.startsWith('/admin') || pathname.startsWith('/login') || pathname.startsWith('/register')) return null

  return (
    <nav aria-label="Primary" className="mobile-nav-safe fixed inset-x-0 bottom-0 z-40 border-t border-gray-200/70 bg-white/90 backdrop-blur-xl lg:hidden">
      <LayoutGroup id="mobile-nav">
        <div className="flex h-16 items-center justify-around px-2">
          {NAV_ITEMS.map(({ href, label, Icon, primary }) => {
            const isActive = href === '/' ? pathname === '/' : pathname.startsWith(href)

            if (primary) {
              return (
                <Link key={href} href={href} aria-label="Sell an item" className="-mt-7 flex flex-col items-center">
                  <motion.span whileTap={{ scale: 0.9 }} whileHover={{ scale: 1.05 }} transition={SPRING.bouncy} className="flex h-14 w-14 items-center justify-center rounded-2xl bg-green-600 text-white shadow-[0_12px_24px_-8px_rgba(22,163,74,0.75)]">
                    <Icon className="h-6 w-6" strokeWidth={2.5} />
                  </motion.span>
                  <span className="mt-1 text-[10px] font-semibold text-green-700">{label}</span>
                </Link>
              )
            }

            return (
              <Link key={href} href={href} aria-current={isActive ? 'page' : undefined} className={cn('relative flex min-w-0 flex-1 flex-col items-center gap-1 py-1.5 transition-colors', isActive ? 'text-green-700' : 'text-gray-400')}>
                {isActive && <motion.span layoutId="mobile-nav-dot" transition={SPRING.snappy} className="absolute -top-px h-0.5 w-8 rounded-full bg-green-600" />}
                <motion.span whileTap={{ scale: 0.85 }} transition={SPRING.snappy}>
                  <Icon className="h-[22px] w-[22px]" strokeWidth={isActive ? 2.4 : 1.8} />
                </motion.span>
                <span className={cn('truncate text-[10px] font-semibold', isActive ? 'text-green-700' : 'text-gray-500')}>{label}</span>
              </Link>
            )
          })}
        </div>
      </LayoutGroup>
    </nav>
  )
}

export default MobileNav
