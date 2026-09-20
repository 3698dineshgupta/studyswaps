'use client';

import { createContext, useContext } from 'react';

/**
 * Is the hero on screen? Ambient loops (particles, breathing, ripples) only run while it is, so they cost
 * nothing once the visitor has scrolled past — better for battery, INP and low-end phones.
 */
export const HeroActive = createContext(true);
export const useHeroActive = () => useContext(HeroActive);

/** True on phones / devices that report little CPU, memory, or "data saver": the hero then runs a lighter version. */
export function isLowPower(): boolean {
  if (typeof navigator === 'undefined') return false;
  const n = navigator as Navigator & { deviceMemory?: number; connection?: { saveData?: boolean } };
  return (n.hardwareConcurrency ?? 8) <= 4 || (n.deviceMemory ?? 8) <= 4 || !!n.connection?.saveData;
}
