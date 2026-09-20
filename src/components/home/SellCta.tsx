'use client';

import Link from 'next/link';
import { motion, useReducedMotion } from 'motion/react';
import { ArrowRight, Camera, Coins, Zap } from 'lucide-react';
import { ProductIllustration } from '@/components/hero/HeroIllustrations';
import type { IllustrationKey } from '@/components/hero/types';
import { Reveal } from '@/components/ui/Reveal';

// Floating decoration — positions in % of the panel, each with its own drift
const FLOATERS: { key: IllustrationKey; className: string; size: string; delay: number; rotate: number }[] = [
  { key: 'textbook', className: 'left-[4%] top-[14%]', size: 'h-20 w-20 sm:h-28 sm:w-28', delay: 0, rotate: -10 },
  { key: 'laptop', className: 'right-[5%] top-[10%]', size: 'h-24 w-24 sm:h-36 sm:w-36', delay: 1.2, rotate: 8 },
  { key: 'headphones', className: 'left-[9%] bottom-[8%] hidden sm:block', size: 'h-24 w-24', delay: 2.1, rotate: -6 },
  { key: 'calculator', className: 'right-[12%] bottom-[6%] hidden sm:block', size: 'h-24 w-24', delay: 0.7, rotate: 10 },
  { key: 'backpack', className: 'left-[24%] top-[4%] hidden lg:block', size: 'h-20 w-20', delay: 1.7, rotate: 6 },
];

const STEPS = [
  { Icon: Camera, text: 'Snap a few photos' },
  { Icon: Coins, text: 'Set your price' },
  { Icon: Zap, text: 'We handle the handover' },
];

export default function SellCta() {
  const reduced = useReducedMotion();
  return (
    <section aria-labelledby="sell-heading" className="page-container py-8 sm:py-14">
      <Reveal>
        <div className="relative isolate overflow-hidden rounded-[2rem] bg-ink px-6 py-16 text-center sm:px-12 sm:py-24">
          {/* soft glows */}
          <div className="pointer-events-none absolute -left-20 -top-24 h-72 w-72 rounded-full bg-green-500/25 blur-3xl" />
          <div className="pointer-events-none absolute -bottom-24 -right-16 h-72 w-72 rounded-full bg-emerald-400/20 blur-3xl" />
          <div className="pointer-events-none absolute inset-0 opacity-[0.07] [background-image:radial-gradient(#fff_1px,transparent_1px)] [background-size:22px_22px]" />

          {FLOATERS.map((f, i) => (
            <motion.div
              key={f.key}
              aria-hidden
              className={`absolute ${f.className} ${f.size} drop-shadow-[0_18px_22px_rgba(0,0,0,0.35)]`}
              style={{ rotate: f.rotate }}
              animate={reduced ? undefined : { y: [0, -12, 0], rotate: [f.rotate, f.rotate + 4, f.rotate] }}
              transition={{ duration: 5 + i * 0.7, repeat: Infinity, ease: 'easeInOut', delay: f.delay }}
            >
              <ProductIllustration name={f.key} className="h-full w-full" />
            </motion.div>
          ))}

          <div className="relative mx-auto max-w-2xl">
            <h2 id="sell-heading" className="font-display text-3xl font-extrabold tracking-tight text-white sm:text-5xl">
              Have something you don&apos;t use anymore?
            </h2>
            <p className="mx-auto mt-4 max-w-xl text-base leading-relaxed text-gray-300 sm:text-lg">
              Turn your unused books, electronics and hostel items into cash.
            </p>

            <ul className="mt-7 flex flex-wrap items-center justify-center gap-x-6 gap-y-2 text-sm text-gray-300">
              {STEPS.map(({ Icon, text }) => (
                <li key={text} className="flex items-center gap-2"><Icon className="h-4 w-4 text-green-400" /> {text}</li>
              ))}
            </ul>

            <motion.div className="mt-9 inline-block" whileHover={{ y: -2 }} whileTap={{ scale: 0.97 }}>
              <Link href="/sell" className="group inline-flex h-14 items-center gap-2 rounded-full bg-green-500 px-9 text-base font-bold text-ink shadow-[0_18px_40px_-12px_rgba(34,197,94,0.8)] transition-colors hover:bg-green-400">
                Start Selling
                <ArrowRight className="h-5 w-5 transition-transform group-hover:translate-x-1" />
              </Link>
            </motion.div>
          </div>
        </div>
      </Reveal>
    </section>
  );
}
