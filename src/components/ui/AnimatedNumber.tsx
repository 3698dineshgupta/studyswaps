'use client';

import { useEffect } from 'react';
import { animate, motion, useMotionValue, useTransform } from 'motion/react';

interface AnimatedNumberProps {
  value: number;
  format?: (n: number) => string;
  className?: string;
}

/** Counts smoothly from the previous value to the new one. */
export default function AnimatedNumber({ value, format = String, className }: AnimatedNumberProps) {
  const motionValue = useMotionValue(value);
  const text = useTransform(motionValue, (v) => format(Math.round(v)));

  useEffect(() => {
    const controls = animate(motionValue, value, { duration: 0.6, ease: [0.22, 1, 0.36, 1] });
    return () => controls.stop();
  }, [value, motionValue]);

  return <motion.span className={className}>{text}</motion.span>;
}
