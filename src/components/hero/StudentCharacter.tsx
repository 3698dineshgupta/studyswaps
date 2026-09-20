'use client';

import { motion, useReducedMotion } from 'motion/react';
import { useHeroActive } from './HeroActive';

/**
 * The hero's focal point: a student relaxing on a beanbag with a textbook.
 * Flat vector placeholder — swap `image` (a transparent PNG/WebP in /public) to use real art.
 * Idle motion (breathing + blinking) is transform-only and switches off for reduced-motion users.
 */
export function StudentArt({ blink = false }: { blink?: boolean }) {
  const eye = (cx: number) => (
    <g>
      <ellipse cx={cx} cy="131" rx="4.8" ry="5.8" fill="#111827" />
      <circle cx={cx + 1.6} cy="129" r="1.6" fill="#fff" />
    </g>
  );

  return (
    <svg viewBox="0 0 400 450" xmlns="http://www.w3.org/2000/svg" aria-hidden focusable="false" className="h-full w-full overflow-visible">
      <defs>
        <linearGradient id="st-skin" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor="#e9b48c" /><stop offset="1" stopColor="#cf8a5c" /></linearGradient>
        <linearGradient id="st-hood" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#22c55e" /><stop offset="1" stopColor="#15803d" /></linearGradient>
        <linearGradient id="st-bag" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor="#f9a8d4" /><stop offset="1" stopColor="#db2777" /></linearGradient>
        <linearGradient id="st-book" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor="#5b9bff" /><stop offset="1" stopColor="#2a55d8" /></linearGradient>
      </defs>

      {/* hood (behind neck) + torso */}
      <path d="M146 204C146 168 254 168 254 204C254 222 232 232 200 232C168 232 146 222 146 204Z" fill="#15803d" />
      <path d="M118 240C118 214 150 200 200 200C250 200 282 214 282 240L296 360H104Z" fill="url(#st-hood)" />
      <path d="M118 240C118 214 150 200 200 200C250 200 282 214 282 240" fill="none" stroke="#fff" strokeOpacity=".18" strokeWidth="3" />

      {/* neck + collar */}
      <ellipse cx="200" cy="208" rx="42" ry="14" fill="#14532d" />
      <rect x="180" y="168" width="40" height="42" rx="16" fill="#c98157" />
      <path d="M158 206Q200 236 242 206" fill="none" stroke="#15803d" strokeWidth="9" strokeLinecap="round" />
      <path d="M190 226l-2 40M210 226l2 40" stroke="#f1f5f9" strokeWidth="3.5" strokeLinecap="round" />
      <circle cx="187.6" cy="269" r="4" fill="#f1f5f9" /><circle cx="212.4" cy="269" r="4" fill="#f1f5f9" />

      {/* head */}
      <circle cx="148" cy="130" r="12" fill="#cf8a5c" />
      <circle cx="252" cy="130" r="12" fill="#cf8a5c" />
      <ellipse cx="200" cy="126" rx="53" ry="59" fill="url(#st-skin)" />
      {/* hair */}
      <path d="M146 118C140 62 178 44 202 44C232 44 264 64 254 118C246 94 232 84 200 82C168 84 154 96 146 118Z" fill="#1f2937" />
      {[[160, 72, 17], [186, 56, 19], [216, 55, 19], [242, 70, 17], [152, 98, 12], [250, 98, 12], [200, 48, 14]].map(([cx, cy, r]) => (
        <circle key={`${cx}-${cy}`} cx={cx} cy={cy} r={r} fill="#1f2937" />
      ))}
      <path d="M170 60q12-10 26-6M212 52q14-4 24 6" stroke="#4b5563" strokeWidth="3" strokeLinecap="round" fill="none" />
      {/* brows, glasses, eyes */}
      <path d="M166 112Q178 105 191 110M209 110Q222 105 234 112" stroke="#1f2937" strokeWidth="4.5" strokeLinecap="round" fill="none" />
      <motion.g
        animate={blink ? { scaleY: [1, 1, 0.08, 1] } : undefined}
        transition={blink ? { duration: 4.6, repeat: Infinity, times: [0, 0.93, 0.96, 1], ease: 'easeInOut' } : undefined}
        style={{ transformBox: 'fill-box', transformOrigin: 'center' }}
      >
        {eye(180)}
        {eye(220)}
      </motion.g>
      <circle cx="180" cy="130" r="17.5" fill="#fff" fillOpacity=".28" stroke="#0f172a" strokeWidth="3.5" />
      <circle cx="220" cy="130" r="17.5" fill="#fff" fillOpacity=".28" stroke="#0f172a" strokeWidth="3.5" />
      <path d="M197.5 128Q200 124 202.5 128M162.5 128L150 125M237.5 128L250 125" stroke="#0f172a" strokeWidth="3.5" strokeLinecap="round" fill="none" />
      {/* nose, cheeks, smile */}
      <path d="M199 138q-4 10 3 12" stroke="#b56f45" strokeWidth="3" strokeLinecap="round" fill="none" />
      <circle cx="168" cy="152" r="8" fill="#fb7185" fillOpacity=".32" /><circle cx="232" cy="152" r="8" fill="#fb7185" fillOpacity=".32" />
      <path d="M183 156Q200 176 217 156Q200 161 183 156Z" fill="#fff" stroke="#9a3412" strokeWidth="3" strokeLinejoin="round" />

      {/* beanbag (in front of the lower body) */}
      <path d="M26 376C20 326 78 292 200 292C322 292 380 326 374 376C382 420 322 444 200 444C78 444 18 420 26 376Z" fill="url(#st-bag)" />
      <ellipse cx="128" cy="322" rx="66" ry="14" fill="#fff" fillOpacity=".24" transform="rotate(-6 128 322)" />
      <path d="M200 294C184 344 184 404 200 442M118 300C100 350 104 404 128 436M282 300C300 350 296 404 272 436" stroke="#9d174d" strokeOpacity=".28" strokeWidth="3" fill="none" />

      {/* arms */}
      <path d="M128 240Q100 296 160 312" fill="none" stroke="#16a34a" strokeWidth="38" strokeLinecap="round" />
      <path d="M272 240Q300 296 240 312" fill="none" stroke="#16a34a" strokeWidth="38" strokeLinecap="round" />
      <path d="M128 240Q100 296 160 312M272 240Q300 296 240 312" fill="none" stroke="#fff" strokeOpacity=".14" strokeWidth="6" strokeLinecap="round" />

      {/* textbook held up */}
      <rect x="162" y="244" width="76" height="98" rx="7" fill="url(#st-book)" />
      <rect x="162" y="244" width="11" height="98" rx="6" fill="#1b3aa8" />
      <rect x="180" y="258" width="48" height="30" rx="5" fill="#fff" fillOpacity=".96" />
      <rect x="185" y="264" width="30" height="5" rx="2.5" fill="#2a55d8" /><rect x="185" y="274" width="36" height="3.5" rx="1.7" fill="#94a3b8" />
      <circle cx="200" cy="314" r="9" fill="none" stroke="#fff" strokeOpacity=".85" strokeWidth="2.6" />
      <path d="M194.5 314h11M200 308.5v11" stroke="#fff" strokeOpacity=".85" strokeWidth="2.6" strokeLinecap="round" />
      <path d="M162 244h40l-32 98h-8q-8 0-8-8z" fill="#fff" fillOpacity=".1" />

      {/* hands */}
      <circle cx="166" cy="312" r="15" fill="#cf8a5c" /><circle cx="234" cy="312" r="15" fill="#cf8a5c" />
      <path d="M158 302q6-9 14-4M242 302q-6-9-14-4" stroke="#b56f45" strokeWidth="3" strokeLinecap="round" fill="none" />
    </svg>
  );
}

interface StudentCharacterProps {
  /** Optional real artwork (transparent PNG/WebP). Replaces the built-in illustration. */
  image?: string;
  className?: string;
}

export default function StudentCharacter({ image, className }: StudentCharacterProps) {
  const reduced = useReducedMotion();
  const active = useHeroActive();

  return (
    <motion.div
      className={className}
      // Gentle breathing — transform only
      animate={reduced || !active ? undefined : { y: [0, -7, 0], rotate: [0, 0.5, 0] }}
      transition={reduced || !active ? undefined : { duration: 6.5, repeat: Infinity, ease: 'easeInOut' }}
      style={{ willChange: 'transform' }}
    >
      {image ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={image} alt="" draggable={false} className="h-full w-full select-none object-contain" />
      ) : (
        <StudentArt blink={!reduced} />
      )}
    </motion.div>
  );
}
