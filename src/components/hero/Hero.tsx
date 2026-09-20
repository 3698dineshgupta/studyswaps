'use client';

import Link from 'next/link';
import { useRef } from 'react';
import { useInView } from 'motion/react';
import { ArrowRight, Plus, Search, Sparkles } from 'lucide-react';
import HeroScene from './HeroScene';
import { HeroPointerProvider } from './ParallaxLayer';
import HeroBackdrop from './HeroBackdrop';
import { HeroActive } from './HeroActive';

const EASE = [0.22, 1, 0.36, 1] as const;

export default function Hero() {
  const sentinel = useRef<HTMLDivElement>(null);
  const onScreen = useInView(sentinel, { margin: '120px 0px' });
  // Staggered fade-up done with a CSS animation (see .hero-rise in globals.css): it plays as soon as the page paints,
  // so the headline is visible immediately instead of waiting for React to load on slow phones.
  const rise = (i: number) => ({ className: 'hero-rise', style: { animationDelay: `${i * 70}ms` } });

  return (
    <HeroActive.Provider value={onScreen}>
    <HeroPointerProvider className="relative overflow-hidden bg-canvas">
      <div ref={sentinel} aria-hidden className="pointer-events-none absolute inset-0" />
      <HeroBackdrop />

      <div className="relative z-10 mx-auto max-w-5xl px-4 pt-10 text-center sm:pt-12">
        <div {...rise(0)} className="hero-rise mx-auto mb-5 inline-flex items-center gap-2 rounded-full border border-green-200 bg-white/80 px-4 py-1.5 text-xs font-semibold text-green-700 shadow-sm backdrop-blur">
          <Sparkles className="h-3.5 w-3.5" /> Student-to-student marketplace
        </div>

        <h1 {...rise(1)} className="hero-rise font-display text-4xl font-extrabold leading-[1.08] tracking-tight text-slate-900 sm:text-5xl lg:text-6xl">
          Everything Students Need,
          <br />
          <span className="bg-gradient-to-r from-green-600 via-emerald-500 to-teal-500 bg-clip-text text-transparent">In One Marketplace.</span>
        </h1>

        <p {...rise(2)} className="hero-rise mx-auto mt-5 max-w-2xl text-base leading-relaxed text-slate-600 sm:text-lg">
          Buy, sell and discover affordable books, electronics and essentials from students around you.
        </p>

        <form {...rise(3)} action="/browse" className="hero-rise mx-auto mt-8 flex max-w-2xl items-center gap-2 rounded-full border border-slate-200 bg-white p-1.5 shadow-[0_12px_40px_-12px_rgba(15,23,42,0.18)] transition-shadow focus-within:border-green-400 focus-within:shadow-[0_12px_40px_-10px_rgba(22,163,74,0.35)]">
          <Search className="ml-4 h-5 w-5 shrink-0 text-slate-400" />
          <input
            name="q"
            aria-label="Search the marketplace"
            placeholder="Search books, laptops, calculators, electronics..."
            className="h-11 min-w-0 flex-1 bg-transparent px-1 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none sm:text-base"
          />
          <button className="h-11 shrink-0 rounded-full bg-green-600 px-6 text-sm font-semibold text-white transition-colors hover:bg-green-700">
            Search
          </button>
        </form>

        <div {...rise(4)} className="hero-rise mt-6 flex flex-wrap items-center justify-center gap-3">
          <Link
            href="/browse"
            className="group inline-flex h-12 items-center gap-2 rounded-full bg-slate-900 px-7 text-sm font-semibold text-white shadow-lg shadow-slate-900/20 transition-all hover:-translate-y-0.5 hover:bg-slate-800 hover:shadow-xl"
          >
            Explore Marketplace
            <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
          </Link>
          <Link
            href="/sell"
            className="inline-flex h-12 items-center gap-2 rounded-full border-2 border-green-600 bg-white px-7 text-sm font-semibold text-green-700 transition-all hover:-translate-y-0.5 hover:bg-green-50"
          >
            <Plus className="h-4 w-4" /> Sell an Item
          </Link>
        </div>
      </div>

      {/* The animated scene */}
      <div className="relative -mt-2 pb-10">
        <HeroScene />
      </div>
    </HeroPointerProvider>
    </HeroActive.Provider>
  );
}
