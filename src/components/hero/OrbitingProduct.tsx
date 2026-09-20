'use client';

import { useEffect, useMemo, useRef, useState, type MutableRefObject } from 'react';
import { AnimatePresence, animate, motion, useAnimationFrame, useMotionValue, useTransform } from 'motion/react';
import { ProductIllustration } from './HeroIllustrations';
import ProductLabel from './ProductLabel';
import { usePointer } from './ParallaxLayer';
import { orbitFrame, variationFor, zIndexFor } from './orbit';
import type { OrbitFrame, OrbitingProductConfig, SceneMetrics } from './types';

/**
 * The element is laid out at its LARGEST on-screen size (ELEMENT_MAX × the base item size) and only
 * ever scaled down. Browsers rasterise a composited layer once and then scale that bitmap, so
 * scaling *up* would look soft.
 */
const ELEMENT_MAX = 1.6;

/** Max mouse-parallax shift in px for the closest object. */
const MAX_SHIFT = 34;

interface OrbitingProductProps {
  config: OrbitingProductConfig;
  index: number;
  /** Live scene measurements (updated on resize — a ref, so reading it never re-renders) */
  metricsRef: MutableRefObject<SceneMetrics>;
  /** False while the hero is scrolled out of view: the frame loop then does nothing */
  activeRef: MutableRefObject<boolean>;
  reduced: boolean;
}

/**
 * One product travelling on its own elliptical orbit.
 *
 * Per frame we compute a pose with the pure maths in orbit.ts and write it to motion values.
 * Motion applies them as transform / opacity only (GPU-composited); no layout properties are
 * touched and no React state changes, so the animation costs no re-renders.
 */
export default function OrbitingProduct({ config, index, metricsRef, activeRef, reduced }: OrbitingProductProps) {
  const { px, py } = usePointer();
  const variation = useMemo(() => variationFor(index), [index]);

  // Motion values driven every frame
  const x = useMotionValue(0);
  const y = useMotionValue(0);
  const scale = useMotionValue(1);
  const rotate = useMotionValue(0);
  const rotateY = useMotionValue(0);
  const bobY = useMotionValue(0);
  const opacity = useMotionValue(0);
  const zIndex = useMotionValue(100);
  const shadowOpacity = useMotionValue(0.2);
  const shadowScale = useMotionValue(1);
  const counterScale = useTransform(scale, (s) => 1 / Math.max(s, 0.01));
  const entrance = useMotionValue(0);
  const entranceScale = useTransform(entrance, [0, 1], [0.5, 1]);

  // Mutable animation state (refs: changing these never re-renders)
  const phase = useRef(0); // orbit clock in seconds — advances slower while hovered
  const speed = useRef(1);
  const grow = useRef(1);
  const hovered = useRef(false);
  const pose = useRef<OrbitFrame>({ x: 0, y: 0, scale: 1, rotate: 0, rotateY: 0, front: 0, bobY: 0 });
  const tapTimer = useRef<ReturnType<typeof setTimeout>>();

  // Only the label toggles React state (rarely, on hover)
  const [labelOpen, setLabelOpen] = useState(false);

  const place = () => {
    const f = orbitFrame(config, variation, phase.current, metricsRef.current, pose.current);
    const shift = MAX_SHIFT * config.depth * (0.35 + 0.65 * f.front); // nearer = moves more
    x.set(f.x + (reduced ? 0 : px.get() * shift));
    y.set(f.y + (reduced ? 0 : py.get() * shift * 0.7));
    scale.set((f.scale * grow.current) / ELEMENT_MAX);
    rotate.set(f.rotate);
    rotateY.set(f.rotateY);
    bobY.set(reduced ? 0 : f.bobY);
    opacity.set(0.72 + 0.28 * f.front); // far side is a touch fainter
    zIndex.set(zIndexFor(f.front, index, hovered.current));
    const boost = hovered.current ? 1.5 : 1;
    shadowOpacity.set((0.1 + 0.3 * f.front) * boost);
    shadowScale.set((0.55 + 0.6 * f.front) * (hovered.current ? 1.12 : 1));
  };

  // Fade the object in once, staggered (separate from the per-frame opacity)
  useEffect(() => {
    const c = animate(entrance, 1, { duration: 0.9, delay: 0.15 + index * 0.09, ease: [0.22, 1, 0.36, 1] });
    return () => c.stop();
  }, [entrance, index]);

  // Initial / reduced-motion placement (no loop needed)
  useEffect(() => {
    place();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reduced]);

  useAnimationFrame((_, delta) => {
    if (reduced || !activeRef.current) return;
    const dt = Math.min(delta, 64) / 1000; // cap so a tab switch never makes objects jump
    // Ease towards target speed / size instead of snapping, so hover feels smooth
    speed.current += ((hovered.current ? 0.08 : 1) - speed.current) * (1 - Math.exp(-dt * 5));
    grow.current += ((hovered.current ? 1.14 : 1) - grow.current) * (1 - Math.exp(-dt * 8));
    phase.current += dt * speed.current;
    place();
  });

  const setHover = (on: boolean) => {
    hovered.current = on;
    setLabelOpen(on);
  };

  const onPointerDown = (e: React.PointerEvent) => {
    if (e.pointerType !== 'touch') return;
    // Touch has no hover: a tap shows the label and slows the object for a moment
    setHover(true);
    clearTimeout(tapTimer.current);
    tapTimer.current = setTimeout(() => setHover(false), 2400);
  };
  useEffect(() => () => clearTimeout(tapTimer.current), []);

  return (
    <motion.div
      data-orbit-item={config.name}
      className="absolute left-1/2 top-[54%] cursor-pointer"
      style={{
        x,
        y,
        scale,
        opacity,
        zIndex,
        width: `calc(var(--hero-item) * ${ELEMENT_MAX})`,
        height: `calc(var(--hero-item) * ${ELEMENT_MAX})`,
        marginLeft: `calc(var(--hero-item) * ${-ELEMENT_MAX / 2})`,
        marginTop: `calc(var(--hero-item) * ${-ELEMENT_MAX / 2})`,
        willChange: 'transform',
      }}
      onPointerEnter={(e) => e.pointerType !== 'touch' && setHover(true)}
      onPointerLeave={(e) => e.pointerType !== 'touch' && setHover(false)}
      onPointerDown={onPointerDown}
    >
      <motion.div className="relative h-full w-full" style={{ opacity: entrance, scale: entranceScale }}>
        {/* Soft contact shadow. It sits on the "ground", so it doesn't bob or spin with the object. */}
        <motion.div
          className="absolute -bottom-[5%] left-[14%] right-[14%] h-[11%] rounded-[50%] bg-slate-900 blur-[7px]"
          style={{ opacity: shadowOpacity, scaleX: shadowScale }}
        />

        {/* The artwork: floats, leans and wobbles */}
        <motion.div className="relative h-full w-full" style={{ y: bobY, rotate, rotateY, transformPerspective: 700 }}>
          {config.image ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={config.image} alt="" draggable={false} className="h-full w-full select-none object-contain drop-shadow-[0_6px_10px_rgba(15,23,42,0.18)]" />
          ) : (
            <ProductIllustration name={config.illustration} className="h-full w-full drop-shadow-[0_6px_10px_rgba(15,23,42,0.18)]" />
          )}
        </motion.div>

        <AnimatePresence>{labelOpen && <ProductLabel name={config.name} price={config.price} counterScale={counterScale} />}</AnimatePresence>
      </motion.div>
    </motion.div>
  );
}
