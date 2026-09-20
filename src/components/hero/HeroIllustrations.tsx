/**
 * Built-in placeholder artwork for the orbiting products (flat vector, gradient-shaded).
 * Each illustration is a 200x200 SVG. Any product can override its illustration by setting
 * `image` in products.ts — these are only the defaults.
 */
import type { ReactElement, SVGProps } from 'react'
import type { IllustrationKey } from './types'

type P = SVGProps<SVGSVGElement>
const base = (p: P) => ({ viewBox: '0 0 200 200', xmlns: 'http://www.w3.org/2000/svg', 'aria-hidden': true, focusable: false, ...p }) as P

const Textbook = (p: P) => (
  <svg {...base(p)}>
    <defs>
      <linearGradient id="hi-tb-c" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor="#5b9bff" /><stop offset="1" stopColor="#2a55d8" /></linearGradient>
      <linearGradient id="hi-tb-s" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stopColor="#1b3aa8" /><stop offset="1" stopColor="#2f61e0" /></linearGradient>
    </defs>
    <rect x="50" y="42" width="112" height="140" rx="7" fill="#cbd5e1" />
    <rect x="46" y="38" width="112" height="140" rx="7" fill="#f8fafc" />
    <path d="M52 172h104M52 175.5h104" stroke="#cbd5e1" strokeWidth="1.2" />
    <rect x="36" y="28" width="114" height="142" rx="8" fill="url(#hi-tb-c)" />
    <rect x="36" y="28" width="17" height="142" rx="8" fill="url(#hi-tb-s)" />
    <path d="M53 30v138" stroke="#fff" strokeOpacity=".28" />
    <rect x="66" y="54" width="70" height="46" rx="7" fill="#fff" fillOpacity=".96" />
    <rect x="74" y="64" width="44" height="7" rx="3.5" fill="#2a55d8" />
    <rect x="74" y="77" width="54" height="4.5" rx="2.2" fill="#94a3b8" />
    <rect x="74" y="87" width="34" height="4.5" rx="2.2" fill="#94a3b8" />
    <circle cx="101" cy="133" r="15" fill="none" stroke="#fff" strokeOpacity=".85" strokeWidth="3.2" />
    <path d="M93.5 133h15M101 125.5v15" stroke="#fff" strokeOpacity=".85" strokeWidth="3.2" strokeLinecap="round" />
    <path d="M36 28h64L53 170H36z" fill="#fff" fillOpacity=".09" />
    <path d="M128 170v19l7-5.2 7 5.2v-19z" fill="#f43f5e" />
  </svg>
)

const BookStack = (p: P) => {
  const book = (x: number, y: number, w: number, h: number, c1: string, c2: string, id: string, rot = 0) => (
    <g transform={`rotate(${rot} ${x + w / 2} ${y + h / 2})`}>
      <defs><linearGradient id={id} x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor={c1} /><stop offset="1" stopColor={c2} /></linearGradient></defs>
      <rect x={x} y={y} width={w} height={h} rx="7" fill={`url(#${id})`} />
      <rect x={x + 16} y={y + 6} width={w - 26} height={h - 12} rx="4" fill="#f8fafc" />
      <path d={`M${x + 20} ${y + h / 2}h${w - 34}`} stroke="#e2e8f0" strokeWidth="1.5" />
      <rect x={x + 5} y={y + 5} width="3" height={h - 10} rx="1.5" fill="#fff" fillOpacity=".55" />
      <rect x={x + 10} y={y + 5} width="2" height={h - 10} rx="1" fill="#fff" fillOpacity=".3" />
    </g>
  )
  return (
    <svg {...base(p)}>
      {book(24, 136, 152, 36, '#22c55e', '#15803d', 'hi-bs1')}
      {book(38, 102, 130, 33, '#fbbf24', '#d97706', 'hi-bs2', 1.5)}
      {book(30, 70, 122, 31, '#a78bfa', '#6d28d9', 'hi-bs3', -2.5)}
      <g transform="rotate(-24 128 58)">
        <rect x="118" y="24" width="10" height="66" rx="2" fill="#f43f5e" />
        <path d="M118 24l5-11 5 11z" fill="#fde7c7" /><path d="M120.5 18.5l2.5-5.5 2.5 5.5z" fill="#1f2937" />
      </g>
    </svg>
  )
}

const Laptop = (p: P) => (
  <svg {...base(p)}>
    <defs>
      <linearGradient id="hi-lp-s" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor="#34d399" /><stop offset="1" stopColor="#0d9488" /></linearGradient>
      <linearGradient id="hi-lp-b" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#f1f5f9" /><stop offset="1" stopColor="#94a3b8" /></linearGradient>
    </defs>
    <rect x="40" y="30" width="120" height="82" rx="9" fill="#cbd5e1" />
    <rect x="45" y="35" width="110" height="72" rx="5" fill="#0f172a" />
    <rect x="48" y="38" width="104" height="66" rx="3.5" fill="url(#hi-lp-s)" />
    <rect x="53" y="43" width="20" height="56" rx="3" fill="#fff" fillOpacity=".22" />
    <rect x="79" y="44" width="34" height="24" rx="4" fill="#fff" fillOpacity=".92" />
    <rect x="118" y="44" width="30" height="24" rx="4" fill="#fff" fillOpacity=".62" />
    <path d="M79 92l10-9 8 5 10-11 10 7 12-9" stroke="#fff" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" fill="none" />
    <path d="M22 116h156l-9 13q-2 4-8 4H39q-6 0-8-4z" fill="url(#hi-lp-b)" />
    <rect x="82" y="116" width="36" height="4.5" rx="2.2" fill="#94a3b8" />
    <path d="M40 30h40l-30 82H40z" fill="#fff" fillOpacity=".07" />
  </svg>
)

const Tablet = (p: P) => (
  <svg {...base(p)}>
    <defs><linearGradient id="hi-tab" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor="#a78bfa" /><stop offset="1" stopColor="#f472b6" /></linearGradient></defs>
    <rect x="44" y="20" width="112" height="160" rx="16" fill="#111827" />
    <rect x="44" y="20" width="112" height="160" rx="16" fill="none" stroke="#475569" strokeWidth="1.5" />
    <rect x="52" y="28" width="96" height="144" rx="9" fill="url(#hi-tab)" />
    <circle cx="100" cy="24" r="1.8" fill="#64748b" />
    <rect x="60" y="38" width="44" height="7" rx="3.5" fill="#fff" fillOpacity=".9" />
    <circle cx="136" cy="41.5" r="6" fill="#fff" fillOpacity=".55" />
    <rect x="60" y="54" width="80" height="50" rx="8" fill="#fff" fillOpacity=".92" />
    <path d="M68 96l14-16 10 10 12-14 14 20z" fill="#c4b5fd" />
    <circle cx="124" cy="68" r="5" fill="#fbbf24" />
    <rect x="60" y="112" width="80" height="14" rx="7" fill="#fff" fillOpacity=".55" />
    <rect x="60" y="132" width="80" height="14" rx="7" fill="#fff" fillOpacity=".4" />
    <rect x="86" y="163" width="28" height="3.5" rx="1.8" fill="#fff" fillOpacity=".8" />
    <path d="M44 20h38L54 180h-6q-4 0-4-5z" fill="#fff" fillOpacity=".05" />
  </svg>
)

const Smartphone = (p: P) => (
  <svg {...base(p)}>
    <defs><linearGradient id="hi-ph" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor="#fbbf24" /><stop offset="1" stopColor="#f43f5e" /></linearGradient></defs>
    <rect x="66" y="14" width="68" height="172" rx="18" fill="#0f172a" />
    <rect x="66" y="14" width="68" height="172" rx="18" fill="none" stroke="#64748b" strokeWidth="1.5" />
    <rect x="71" y="19" width="58" height="162" rx="13" fill="url(#hi-ph)" />
    <rect x="88" y="24" width="24" height="6.5" rx="3.2" fill="#0f172a" />
    <circle cx="100" cy="62" r="13" fill="#fff" fillOpacity=".92" />
    <rect x="80" y="82" width="40" height="6" rx="3" fill="#fff" fillOpacity=".92" />
    <rect x="86" y="93" width="28" height="4.5" rx="2.2" fill="#fff" fillOpacity=".6" />
    <rect x="78" y="108" width="44" height="26" rx="8" fill="#fff" fillOpacity=".85" />
    <rect x="78" y="140" width="44" height="26" rx="8" fill="#fff" fillOpacity=".55" />
    <rect x="90" y="172" width="20" height="3" rx="1.5" fill="#fff" fillOpacity=".85" />
    <path d="M66 14h30L72 186h-4q-2 0-2-2z" fill="#fff" fillOpacity=".07" />
  </svg>
)

const Headphones = (p: P) => (
  <svg {...base(p)}>
    <defs><linearGradient id="hi-hp" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor="#fb7185" /><stop offset="1" stopColor="#be123c" /></linearGradient></defs>
    <path d="M54 118C54 44 146 44 146 118" fill="none" stroke="#1e293b" strokeWidth="13" strokeLinecap="round" />
    <path d="M60 116C60 52 140 52 140 116" fill="none" stroke="#64748b" strokeWidth="3" strokeLinecap="round" strokeOpacity=".7" />
    <rect x="34" y="98" width="38" height="66" rx="18" fill="url(#hi-hp)" />
    <rect x="60" y="108" width="16" height="46" rx="8" fill="#1e293b" />
    <rect x="128" y="98" width="38" height="66" rx="18" fill="url(#hi-hp)" />
    <rect x="124" y="108" width="16" height="46" rx="8" fill="#1e293b" />
    <path d="M42 112q3-8 12-8" stroke="#fff" strokeOpacity=".6" strokeWidth="3.5" strokeLinecap="round" fill="none" />
    <path d="M136 112q3-8 12-8" stroke="#fff" strokeOpacity=".6" strokeWidth="3.5" strokeLinecap="round" fill="none" />
  </svg>
)

const Calculator = (p: P) => {
  const cols = [0, 1, 2, 3], rows = [0, 1, 2, 3]
  return (
    <svg {...base(p)}>
      <defs><linearGradient id="hi-calc" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor="#475569" /><stop offset="1" stopColor="#0f172a" /></linearGradient></defs>
      <rect x="52" y="16" width="96" height="168" rx="17" fill="url(#hi-calc)" />
      <rect x="61" y="27" width="78" height="38" rx="8" fill="#bbf7d0" />
      <text x="132" y="55" textAnchor="end" fontSize="26" fontWeight="700" fontFamily="ui-monospace, Menlo, Consolas, monospace" fill="#065f46">699</text>
      {rows.flatMap((r) => cols.map((c) => (
        <rect key={`${r}${c}`} x={62 + c * 19.5} y={78 + r * 25} width="16" height="19" rx="5"
          fill={c === 3 ? '#f59e0b' : r === 0 ? '#94a3b8' : '#64748b'} />
      )))}
      <path d="M52 16h40L64 184h-8q-4 0-4-4z" fill="#fff" fillOpacity=".06" />
    </svg>
  )
}

const Backpack = (p: P) => (
  <svg {...base(p)}>
    <defs>
      <linearGradient id="hi-bp" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor="#fb923c" /><stop offset="1" stopColor="#c2410c" /></linearGradient>
      <linearGradient id="hi-bp2" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#f97316" /><stop offset="1" stopColor="#9a3412" /></linearGradient>
    </defs>
    <path d="M82 50C82 24 118 24 118 50" fill="none" stroke="#9a3412" strokeWidth="9" strokeLinecap="round" />
    <rect x="36" y="92" width="14" height="62" rx="7" fill="#9a3412" />
    <rect x="150" y="92" width="14" height="62" rx="7" fill="#9a3412" />
    <path d="M50 76C50 52 74 42 100 42S150 52 150 76L154 158C154 173 143 182 128 182H72C57 182 46 173 46 158Z" fill="url(#hi-bp)" />
    <path d="M58 80Q100 96 142 80L144 112Q100 128 56 112Z" fill="url(#hi-bp2)" />
    <path d="M62 100Q100 114 138 100" stroke="#fde68a" strokeWidth="2.2" strokeDasharray="4 3" fill="none" />
    <circle cx="100" cy="112" r="4.5" fill="#fde68a" />
    <rect x="64" y="134" width="72" height="40" rx="11" fill="url(#hi-bp2)" />
    <path d="M70 134h60" stroke="#fde68a" strokeWidth="2.2" strokeDasharray="4 3" />
    <rect x="94" y="146" width="12" height="18" rx="6" fill="#7c2d12" fillOpacity=".55" />
    <ellipse cx="78" cy="64" rx="20" ry="9" fill="#fff" fillOpacity=".16" transform="rotate(-18 78 64)" />
    <circle cx="160" cy="170" r="6" fill="#fbbf24" /><path d="M160 158v-6" stroke="#94a3b8" strokeWidth="2" />
  </svg>
)

const Stationery = (p: P) => (
  <svg {...base(p)}>
    <defs><linearGradient id="hi-cup" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stopColor="#5eead4" /><stop offset="1" stopColor="#0f766e" /></linearGradient></defs>
    <g transform="rotate(-30 132 104)">
      <rect x="124" y="38" width="16" height="80" rx="3" fill="#93c5fd" />
      {[0, 1, 2, 3, 4, 5, 6].map((i) => <path key={i} d={`M124 ${46 + i * 10}h${i % 2 ? 6 : 10}`} stroke="#1e3a8a" strokeWidth="1.4" />)}
    </g>
    <g transform="rotate(-16 88 108)"><rect x="82" y="30" width="12" height="82" rx="2.5" fill="#facc15" /><rect x="82" y="30" width="12" height="8" rx="2" fill="#f87171" /><path d="M82 30l6-15 6 15z" fill="#fde7c7" /><path d="M85 22l3-7 3 7z" fill="#1f2937" /></g>
    <g transform="rotate(8 104 108)"><rect x="98" y="26" width="12" height="86" rx="2.5" fill="#ef4444" /><rect x="98" y="26" width="12" height="8" rx="2" fill="#fca5a5" /><path d="M98 26l6-15 6 15z" fill="#fde7c7" /><path d="M101 18l3-7 3 7z" fill="#1f2937" /></g>
    <g transform="rotate(22 116 108)"><rect x="110" y="34" width="12" height="78" rx="2.5" fill="#22c55e" /><rect x="110" y="34" width="12" height="8" rx="2" fill="#bbf7d0" /><path d="M110 34l6-14 6 14z" fill="#fde7c7" /><path d="M113 26l3-6 3 6z" fill="#1f2937" /></g>
    <path d="M58 108h84l-6 62q-1 8-9 8H73q-8 0-9-8z" fill="url(#hi-cup)" />
    <rect x="60" y="126" width="80" height="11" fill="#fff" fillOpacity=".22" />
    <ellipse cx="100" cy="108" rx="42" ry="6" fill="#0f766e" />
    <path d="M68 116q-1 30 4 46" stroke="#fff" strokeOpacity=".4" strokeWidth="4" strokeLinecap="round" fill="none" />
  </svg>
)

const Lamp = (p: P) => (
  <svg {...base(p)}>
    <defs>
      <linearGradient id="hi-lamp-s" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor="#34d399" /><stop offset="1" stopColor="#047857" /></linearGradient>
      <radialGradient id="hi-lamp-g" cx=".5" cy="0" r="1"><stop offset="0" stopColor="#fef08a" stopOpacity=".85" /><stop offset="1" stopColor="#fef08a" stopOpacity="0" /></radialGradient>
    </defs>
    <path d="M60 96L20 168h80z" fill="url(#hi-lamp-g)" transform="translate(4 -2)" />
    <ellipse cx="104" cy="178" rx="40" ry="9" fill="#334155" />
    <ellipse cx="104" cy="174" rx="40" ry="9" fill="#475569" />
    <path d="M104 172L82 112" stroke="#64748b" strokeWidth="7" strokeLinecap="round" />
    <circle cx="82" cy="112" r="7" fill="#334155" />
    <path d="M82 112L122 58" stroke="#64748b" strokeWidth="7" strokeLinecap="round" />
    <circle cx="122" cy="58" r="6" fill="#334155" />
    <g transform="rotate(-35 128 66)">
      <path d="M100 52h52l-9 34h-34z" fill="url(#hi-lamp-s)" />
      <ellipse cx="126" cy="52" rx="26" ry="6" fill="#065f46" />
      <ellipse cx="126" cy="86" rx="17" ry="4" fill="#fef9c3" />
    </g>
  </svg>
)

const Keyboard = (p: P) => {
  const rows = [12, 12, 11, 10]
  return (
    <svg {...base(p)}>
      <defs><linearGradient id="hi-kb" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#f1f5f9" /><stop offset="1" stopColor="#94a3b8" /></linearGradient></defs>
      <g transform="translate(100 118) skewX(-16) translate(-100 -118)">
        <rect x="14" y="84" width="172" height="74" rx="11" fill="#64748b" transform="translate(0 5)" />
        <rect x="14" y="84" width="172" height="74" rx="11" fill="url(#hi-kb)" />
        {rows.map((n, r) => Array.from({ length: n }).map((_, c) => (
          <rect key={`${r}-${c}`} x={22 + c * 13.6 + r * 2} y={91 + r * 13} width="11" height="10" rx="2.6"
            fill={r === 0 && c === 0 ? '#fb923c' : '#fff'} stroke="#cbd5e1" strokeWidth=".8" />
        )))}
        <rect x="48" y="143" width="76" height="10" rx="3" fill="#fff" stroke="#cbd5e1" strokeWidth=".8" />
        <rect x="128" y="143" width="14" height="10" rx="3" fill="#a7f3d0" stroke="#cbd5e1" strokeWidth=".8" />
        <rect x="24" y="143" width="20" height="10" rx="3" fill="#fff" stroke="#cbd5e1" strokeWidth=".8" />
      </g>
    </svg>
  )
}

const ProductCard = (p: P) => (
  <svg {...base(p)}>
    <defs><linearGradient id="hi-pc" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor="#bbf7d0" /><stop offset="1" stopColor="#4ade80" /></linearGradient></defs>
    <rect x="28" y="18" width="144" height="164" rx="20" fill="#fff" stroke="#e2e8f0" strokeWidth="1.5" />
    <rect x="36" y="26" width="128" height="80" rx="13" fill="url(#hi-pc)" />
    <rect x="70" y="42" width="34" height="44" rx="4" fill="#16a34a" /><rect x="76" y="48" width="34" height="44" rx="4" fill="#fff" fillOpacity=".95" />
    <rect x="82" y="58" width="20" height="4" rx="2" fill="#16a34a" /><rect x="82" y="67" width="22" height="3" rx="1.5" fill="#94a3b8" /><rect x="82" y="74" width="16" height="3" rx="1.5" fill="#94a3b8" />
    <circle cx="146" cy="44" r="11" fill="#fff" />
    <path d="M146 51.5l-6.2-6a4 4 0 015.6-5.6l.6.6.6-.6a4 4 0 015.6 5.6z" fill="#f43f5e" />
    <rect x="38" y="116" width="92" height="9" rx="4.5" fill="#0f172a" />
    <rect x="38" y="131" width="62" height="6" rx="3" fill="#94a3b8" />
    <rect x="38" y="148" width="62" height="24" rx="12" fill="#16a34a" />
    <text x="69" y="164" textAnchor="middle" fontSize="12" fontWeight="700" fontFamily="system-ui, sans-serif" fill="#fff">Rs. 999</text>
    <circle cx="140" cy="160" r="11" fill="#dcfce7" /><path d="M134.5 160.5l4 4 7-8" stroke="#16a34a" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" fill="none" />
  </svg>
)

const Bicycle = (p: P) => (
  <svg {...base(p)}>
    <defs><linearGradient id="hi-bike" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor="#34d399" /><stop offset="1" stopColor="#047857" /></linearGradient></defs>
    <g fill="none" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="46" cy="132" r="32" stroke="#1e293b" strokeWidth="6" />
      <circle cx="154" cy="132" r="32" stroke="#1e293b" strokeWidth="6" />
      <circle cx="46" cy="132" r="26" stroke="#94a3b8" strokeWidth="1.5" strokeDasharray="2 5" />
      <circle cx="154" cy="132" r="26" stroke="#94a3b8" strokeWidth="1.5" strokeDasharray="2 5" />
      <path d="M46 132L84 132L112 78L146 78" stroke="url(#hi-bike)" strokeWidth="7" />
      <path d="M84 132L70 78L112 78M84 132L154 132L132 78" stroke="url(#hi-bike)" strokeWidth="6" />
      <path d="M62 78L84 78M70 70h-6" stroke="#0f172a" strokeWidth="7" />
      <path d="M132 78L144 56L158 56" stroke="#0f172a" strokeWidth="6" />
    </g>
    <circle cx="84" cy="132" r="7" fill="#f59e0b" /><circle cx="46" cy="132" r="4" fill="#475569" /><circle cx="154" cy="132" r="4" fill="#475569" />
  </svg>
)

const MAP: Record<IllustrationKey, (p: P) => ReactElement> = {
  textbook: Textbook,
  bookStack: BookStack,
  laptop: Laptop,
  tablet: Tablet,
  smartphone: Smartphone,
  headphones: Headphones,
  calculator: Calculator,
  backpack: Backpack,
  stationery: Stationery,
  lamp: Lamp,
  keyboard: Keyboard,
  productCard: ProductCard,
  bicycle: Bicycle,
}

export function ProductIllustration({ name, ...props }: { name: IllustrationKey } & P) {
  const Cmp = MAP[name]
  return <Cmp {...props} />
}
