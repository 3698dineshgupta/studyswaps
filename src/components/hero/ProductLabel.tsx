'use client';

import { motion, type MotionValue } from 'motion/react';

interface ProductLabelProps {
  name: string;
  price: string;
  /** Inverse of the product's perspective scale, so the label stays a readable size on far objects */
  counterScale: MotionValue<number>;
}

/** Small "Name — Price" pill shown while a product is hovered / tapped. */
export default function ProductLabel({ name, price, counterScale }: ProductLabelProps) {
  return (
    <motion.div
      className="pointer-events-none absolute left-1/2 top-0 z-10 whitespace-nowrap"
      style={{ x: '-50%', y: '-112%', scale: counterScale, transformOrigin: '50% 100%' }}
    >
      <motion.div
        initial={{ opacity: 0, y: 8, scale: 0.92 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: 6, scale: 0.94 }}
        transition={{ type: 'spring', stiffness: 420, damping: 28 }}
        className="rounded-xl bg-white/95 px-3 py-1.5 text-xs shadow-[0_10px_30px_-8px_rgba(15,23,42,0.35)] ring-1 ring-black/5 backdrop-blur"
      >
        <span className="font-semibold text-slate-900">{name}</span>
        <span className="mx-1.5 text-slate-300">—</span>
        <span className="font-bold text-green-600">{price}</span>
      </motion.div>
    </motion.div>
  );
}
