'use client'

import Link from 'next/link'
import { motion, useReducedMotion } from 'motion/react'
import { Armchair, BadgeCheck, Bike, BookOpen, Laptop, Lightbulb, Shirt, ShieldCheck, Truck, Wallet } from 'lucide-react'
import { APP_NAME } from '@/lib/constants'
import { EASE } from '@/lib/motion'

// Decorative floating "listings" — icons only, no fake products or prices
const FLOATERS = [
  { Icon: BookOpen, x: '8%', y: '14%', size: 56, delay: 0, tint: 'from-sky-400/30 to-sky-500/10 text-sky-200' },
  { Icon: Laptop, x: '74%', y: '10%', size: 64, delay: 0.6, tint: 'from-violet-400/30 to-violet-500/10 text-violet-200' },
  { Icon: Bike, x: '84%', y: '46%', size: 52, delay: 1.2, tint: 'from-emerald-400/30 to-emerald-500/10 text-emerald-200' },
  { Icon: Lightbulb, x: '76%', y: '27%', size: 48, delay: 0.3, tint: 'from-amber-400/30 to-amber-500/10 text-amber-200' },
  { Icon: Armchair, x: '62%', y: '78%', size: 56, delay: 0.9, tint: 'from-orange-400/30 to-orange-500/10 text-orange-200' },
  { Icon: Shirt, x: '20%', y: '82%', size: 46, delay: 1.5, tint: 'from-rose-400/30 to-rose-500/10 text-rose-200' },
]

const POINTS = [
  { Icon: Truck, t: 'We collect & deliver', d: 'Buyer and seller never have to meet.' },
  { Icon: Wallet, t: 'Pay safely with eSewa', d: 'Sellers are paid once you confirm delivery.' },
  { Icon: BadgeCheck, t: 'Sellers are ID-verified', d: 'Real students, checked once before they sell.' },
]

/** Left brand panel for sign-in / sign-up (desktop only). */
export default function AuthShowcase() {
  const reduced = useReducedMotion()
  return (
    <aside className="relative hidden overflow-hidden bg-ink text-white lg:flex lg:flex-col lg:justify-between lg:p-12">
      {/* soft green glows */}
      <div className="pointer-events-none absolute -left-32 -top-32 h-[28rem] w-[28rem] rounded-full bg-green-500/25 blur-3xl" />
      <div className="pointer-events-none absolute -bottom-40 -right-24 h-[30rem] w-[30rem] rounded-full bg-emerald-400/15 blur-3xl" />
      <div className="pointer-events-none absolute inset-0 opacity-[0.07]" style={{ backgroundImage: 'radial-gradient(#fff 1px, transparent 1px)', backgroundSize: '24px 24px' }} />

      {FLOATERS.map(({ Icon, x, y, size, delay, tint }, i) => (
        <motion.div
          key={i}
          aria-hidden
          initial={{ opacity: 0, scale: 0.8 }}
          animate={reduced ? { opacity: 1, scale: 1 } : { opacity: 1, scale: 1, y: [0, -14, 0] }}
          transition={reduced ? { duration: 0.3 } : { opacity: { duration: 0.6, delay }, scale: { duration: 0.6, delay }, y: { duration: 6 + i, repeat: Infinity, ease: 'easeInOut', delay } }}
          className={`absolute flex items-center justify-center rounded-3xl bg-gradient-to-br ${tint} shadow-[0_20px_50px_-20px_rgba(0,0,0,0.6)] ring-1 ring-white/10 backdrop-blur-sm`}
          style={{ left: x, top: y, width: size, height: size }}
        >
          <Icon className="h-1/2 w-1/2" />
        </motion.div>
      ))}

      <Link href="/" className="relative z-10 flex w-fit items-center gap-2.5" aria-label={`${APP_NAME} home`}>
        <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-green-500 shadow-[0_8px_22px_-8px_rgba(34,197,94,0.9)]"><BookOpen className="h-5 w-5 text-white" /></span>
        <span className="font-display text-xl font-bold tracking-tight">Student<span className="text-green-400">Market</span></span>
      </Link>

      <div className="relative z-10 max-w-md">
        <motion.h2 initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6, ease: EASE }} className="font-display text-4xl font-extrabold leading-[1.1] tracking-tight xl:text-5xl">
          Everything students need, from students who care.
        </motion.h2>
        <p className="mt-4 text-base leading-relaxed text-gray-300">Books, gadgets, hostel essentials and more — bought and sold across campuses in Nepal.</p>
        <ul className="mt-8 space-y-4">
          {POINTS.map(({ Icon, t, d }, i) => (
            <motion.li key={t} initial={{ opacity: 0, x: -14 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 0.5, ease: EASE, delay: 0.25 + i * 0.1 }} className="flex items-start gap-3.5">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white/10 text-green-300 ring-1 ring-white/10"><Icon className="h-5 w-5" /></span>
              <span><span className="block text-[15px] font-semibold">{t}</span><span className="text-sm text-gray-400">{d}</span></span>
            </motion.li>
          ))}
        </ul>
      </div>

      <p className="relative z-10 flex items-center gap-2 text-sm text-gray-400"><ShieldCheck className="h-4 w-4 text-green-400" /> Trusted, moderated and built for students.</p>
    </aside>
  )
}
