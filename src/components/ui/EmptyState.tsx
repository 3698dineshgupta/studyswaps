'use client';

import Link from 'next/link';
import { motion, useReducedMotion } from 'motion/react';
import { ProductIllustration } from '@/components/hero/HeroIllustrations';
import type { IllustrationKey } from '@/components/hero/types';
import { DURATION, EASE } from '@/lib/motion';

interface EmptyStateProps {
  illustration: IllustrationKey;
  title: string;
  text: string;
  action?: { label: string; href: string };
  className?: string;
}

/** Friendly empty screen: a softly floating illustration instead of a blank page. */
export default function EmptyState({ illustration, title, text, action, className = '' }: EmptyStateProps) {
  const reduced = useReducedMotion();
  return (
    <motion.div
      className={`mx-auto flex max-w-md flex-col items-center px-4 py-16 text-center ${className}`}
      initial={reduced ? false : { opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: DURATION.slow, ease: EASE }}
    >
      <div className="relative mb-6 flex h-36 w-36 items-center justify-center">
        <div className="absolute inset-0 rounded-full bg-gradient-to-b from-green-100/80 to-transparent" />
        <div className="absolute inset-4 rounded-full bg-white/70 shadow-soft" />
        <motion.div
          className="relative h-24 w-24 drop-shadow-[0_10px_14px_rgba(20,23,28,0.18)]"
          animate={reduced ? undefined : { y: [0, -8, 0], rotate: [0, -2, 0] }}
          transition={{ duration: 5, repeat: Infinity, ease: 'easeInOut' }}
        >
          <ProductIllustration name={illustration} className="h-full w-full" />
        </motion.div>
      </div>
      <h2 className="font-display text-2xl font-bold tracking-tight text-ink">{title}</h2>
      <p className="mt-2 text-sm leading-relaxed text-ink-muted">{text}</p>
      {action && (
        <Link href={action.href} className="btn-primary mt-6 px-6 py-3">
          {action.label}
        </Link>
      )}
    </motion.div>
  );
}
