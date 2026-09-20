'use client';

import { useEffect, useMemo, useRef, type CSSProperties } from 'react';
import { motion, useReducedMotion } from 'motion/react';
import OrbitingProduct from './OrbitingProduct';
import { ParallaxLayer } from './ParallaxLayer';
import StudentCharacter from './StudentCharacter';
import { STUDENT_Z, sceneMetrics } from './orbit';
import { productsFor } from './products';
import { useBreakpoint } from './useBreakpoint';
import { useHeroActive } from './HeroActive';
import type { SceneMetrics } from './types';

interface HeroSceneProps {
  /** Optional real artwork for the student (transparent PNG/WebP in /public). */
  studentImage?: string;
  className?: string;
}

/**
 * The stage. Depth is built from stacking order:
 *   far half of every orbit (z 100–199)  →  student (z 500)  →  near half of every orbit (z 550+)
 * so each object visibly travels BEHIND the student and then comes round IN FRONT.
 */
export default function HeroScene({ studentImage, className = '' }: HeroSceneProps) {
  const { bp, ready } = useBreakpoint();
  const reduced = useReducedMotion() ?? false;
  const active = useHeroActive();
  const sceneRef = useRef<HTMLDivElement>(null);
  const bpRef = useRef(bp);
  bpRef.current = bp;

  // Measurements live in refs — resizing never re-renders the objects
  const metricsRef = useRef<SceneMetrics>({ rx: 400, ry: 120, item: 110 });
  const activeRef = useRef(true);

  useEffect(() => {
    const el = sceneRef.current;
    if (!el) return;

    const measure = () => {
      const { width, height } = el.getBoundingClientRect();
      const m = sceneMetrics(width, height, bpRef.current);
      metricsRef.current = m;
      el.style.setProperty('--hero-item', `${m.item}px`);
    };
    measure();

    const ro = new ResizeObserver(measure);
    ro.observe(el);
    // Stop the frame loops entirely while the hero is off-screen
    const io = new IntersectionObserver(([entry]) => { activeRef.current = entry.isIntersecting; }, { threshold: 0 });
    io.observe(el);
    return () => { ro.disconnect(); io.disconnect(); };
  }, [bp]);

  const products = useMemo(() => productsFor(bp), [bp]);

  return (
    <div
      ref={sceneRef}
      data-hero-scene
      role="img"
      aria-label="A student relaxing with a textbook, surrounded by second-hand books, laptops and study essentials"
      className={`relative isolate mx-auto h-[400px] w-full max-w-[1200px] overflow-x-clip sm:h-[470px] lg:h-[540px] ${className}`}
      style={{ '--hero-item': '110px' } as CSSProperties}
    >
      {/* Soft concentric rings behind the student (background layer, barely moves) */}
      <ParallaxLayer strength={5} className="pointer-events-none absolute inset-0 -z-0" style={{ zIndex: 1 }}>
        <div className="absolute left-1/2 top-[54%] -translate-x-1/2 -translate-y-1/2">
          {[0.3, 0.46, 0.64].map((r, i) => (
            <motion.div
              key={r}
              className="absolute left-1/2 top-1/2 rounded-full border border-green-300/40 bg-gradient-to-b from-green-100/40 to-transparent"
              style={{ width: `min(${r * 100}vw, ${r * 1100}px)`, height: `min(${r * 100}vw, ${r * 1100}px)`, x: '-50%', y: '-50%' }}
              animate={reduced || !active ? undefined : { scale: [1, 1.035, 1], opacity: [0.9, 0.55, 0.9] }}
              transition={reduced || !active ? undefined : { duration: 7 + i * 1.6, repeat: Infinity, ease: 'easeInOut', delay: i * 0.9 }}
            />
          ))}
        </div>
      </ParallaxLayer>

      {/* Ground glow under the student */}
      <div
        className="pointer-events-none absolute bottom-[3%] left-1/2 h-[9%] w-[46%] -translate-x-1/2 rounded-[50%] bg-slate-900/25 blur-2xl"
        style={{ zIndex: STUDENT_Z - 1 }}
      />

      {/* The student — focal point, moves least */}
      <div className="pointer-events-none absolute bottom-0 left-1/2 h-[88%] -translate-x-1/2 aspect-[400/450]" style={{ zIndex: STUDENT_Z }}>
        <ParallaxLayer strength={10} className="h-full w-full">
          <StudentCharacter image={studentImage} className="h-full w-full" />
        </ParallaxLayer>
      </div>

      {/* Orbiting products — mounted only once the screen size is known (no hydration mismatch) */}
      {ready &&
        products.map((cfg, i) => (
          <OrbitingProduct key={cfg.name} config={cfg} index={i} metricsRef={metricsRef} activeRef={activeRef} reduced={reduced} />
        ))}
    </div>
  );
}
