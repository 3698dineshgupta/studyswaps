'use client';

import { motion, useReducedMotion } from 'motion/react';
import { fadeUp, scaleIn, stagger, VIEWPORT } from '@/lib/motion';

/** Fades + rises into view once as it scrolls on screen. */
export function Reveal({ children, delay = 0, className, as = 'div' }: { children: React.ReactNode; delay?: number; className?: string; as?: 'div' | 'section' | 'li' }) {
  const reduced = useReducedMotion();
  const Cmp = motion[as];
  return (
    <Cmp
      className={className}
      initial={reduced ? false : 'hidden'}
      whileInView="show"
      viewport={VIEWPORT}
      variants={fadeUp}
      transition={{ delay }}
    >
      {children}
    </Cmp>
  );
}

/** Parent that staggers its <RevealItem> children as the group scrolls into view. */
export function RevealGroup({ children, className, gap = 0.07 }: { children: React.ReactNode; className?: string; gap?: number }) {
  const reduced = useReducedMotion();
  return (
    <motion.div className={className} initial={reduced ? false : 'hidden'} whileInView="show" viewport={VIEWPORT} variants={stagger(gap)}>
      {children}
    </motion.div>
  );
}

export function RevealItem({ children, className, scale = false }: { children: React.ReactNode; className?: string; scale?: boolean }) {
  return (
    <motion.div className={className} variants={scale ? scaleIn : fadeUp}>
      {children}
    </motion.div>
  );
}
