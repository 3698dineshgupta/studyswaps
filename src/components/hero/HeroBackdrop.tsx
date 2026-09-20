'use client';

import { motion, useReducedMotion } from 'motion/react';
import { seeded } from './orbit';
import { isLowPower, useHeroActive } from './HeroActive';
import { useEffect, useState } from 'react';

// Deterministic particle field (same on server and client → no hydration mismatch)
const PARTICLES = Array.from({ length: 16 }, (_, i) => ({
  left: 4 + seeded(i * 3 + 1) * 92,
  top: 6 + seeded(i * 3 + 2) * 88,
  size: 3 + seeded(i * 3 + 3) * 5,
  duration: 6 + seeded(i * 5 + 9) * 6,
  delay: seeded(i * 7 + 2) * 4,
  drift: 10 + seeded(i * 11 + 4) * 16,
}));

/** Quiet atmosphere behind the hero: glows, a faint dot grid and slow drifting particles. */
export default function HeroBackdrop() {
  const reduced = useReducedMotion();
  const active = useHeroActive();
  // Phones and low-power devices get 5 particles instead of 16 (measured after mount so server and client HTML match)
  const [count, setCount] = useState(PARTICLES.length);
  useEffect(() => { if (isLowPower() || window.innerWidth < 640) setCount(5); }, []);
  return (
    <div aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden">
      <div className="absolute inset-0 bg-[radial-gradient(60%_50%_at_50%_0%,rgba(34,197,94,0.10),transparent_70%)]" />
      <div className="absolute -left-32 top-24 h-80 w-80 rounded-full bg-green-200/40 blur-3xl" />
      <div className="absolute -right-32 top-56 h-96 w-96 rounded-full bg-emerald-200/30 blur-3xl" />
      {/* faint dot grid, faded towards the edges */}
      <div className="absolute inset-0 opacity-[0.5] [background-image:radial-gradient(rgba(20,23,28,0.10)_1px,transparent_1px)] [background-size:26px_26px] [mask-image:radial-gradient(70%_60%_at_50%_35%,black,transparent)]" />
      {!reduced && active &&
        PARTICLES.slice(0, count).map((p, i) => (
          <motion.span
            key={i}
            className="absolute rounded-full bg-green-400/50"
            style={{ left: `${p.left}%`, top: `${p.top}%`, width: p.size, height: p.size }}
            animate={{ y: [0, -p.drift, 0], opacity: [0.15, 0.6, 0.15] }}
            transition={{ duration: p.duration, repeat: Infinity, ease: 'easeInOut', delay: p.delay }}
          />
        ))}
    </div>
  );
}
