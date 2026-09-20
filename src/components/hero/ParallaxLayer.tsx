'use client';

import { createContext, useContext, useRef, type CSSProperties, type ReactNode } from 'react';
import { motion, useMotionValue, useReducedMotion, useSpring, useTransform, type MotionValue } from 'motion/react';

interface PointerState {
  /** Smoothed pointer position across the hero, -1 (left) … 1 (right). */
  px: MotionValue<number>;
  /** Smoothed pointer position across the hero, -1 (top) … 1 (bottom). */
  py: MotionValue<number>;
}

const PointerContext = createContext<PointerState | null>(null);

export function usePointer(): PointerState {
  const ctx = useContext(PointerContext);
  if (!ctx) throw new Error('usePointer must be used inside <HeroPointerProvider>');
  return ctx;
}

/**
 * Tracks the mouse over the hero and shares it as *motion values*. Consumers read
 * them inside animation frames / transforms, so moving the mouse never re-renders React.
 */
export function HeroPointerProvider({ children, className, style }: { children: ReactNode; className?: string; style?: CSSProperties }) {
  const ref = useRef<HTMLDivElement>(null);
  const reduced = useReducedMotion();
  const rawX = useMotionValue(0);
  const rawY = useMotionValue(0);
  // Springs give the parallax its soft, weighty follow-through
  const px = useSpring(rawX, { stiffness: 70, damping: 20, mass: 0.6 });
  const py = useSpring(rawY, { stiffness: 70, damping: 20, mass: 0.6 });

  const onMove = (e: React.PointerEvent) => {
    if (reduced || e.pointerType === 'touch' || !ref.current) return; // no parallax on touch / reduced motion
    const r = ref.current.getBoundingClientRect();
    rawX.set(Math.max(-1, Math.min(1, ((e.clientX - r.left) / r.width - 0.5) * 2)));
    rawY.set(Math.max(-1, Math.min(1, ((e.clientY - r.top) / r.height - 0.5) * 2)));
  };
  const onLeave = () => {
    rawX.set(0);
    rawY.set(0);
  };

  return (
    <PointerContext.Provider value={{ px, py }}>
      <div ref={ref} className={className} style={style} onPointerMove={onMove} onPointerLeave={onLeave}>
        {children}
      </div>
    </PointerContext.Provider>
  );
}

/** Shifts its children with the mouse. Bigger `strength` = closer to the viewer. */
export function ParallaxLayer({ strength = 10, className, style, children }: { strength?: number; className?: string; style?: CSSProperties; children?: ReactNode }) {
  const { px, py } = usePointer();
  const x = useTransform(px, (v) => v * strength);
  const y = useTransform(py, (v) => v * strength * 0.7);
  return (
    <motion.div className={className} style={{ ...style, x, y, willChange: 'transform' }}>
      {children}
    </motion.div>
  );
}
