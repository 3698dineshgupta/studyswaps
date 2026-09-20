import Link from 'next/link'
import { APP_NAME } from '@/lib/constants'

const GROUPS: { title: string; links: [string, string][] }[] = [
  { title: 'Marketplace', links: [['Browse', '/browse'], ['Sell an item', '/sell'], ['Get verified', '/verify']] },
  { title: 'How it works', links: [['Delivery & fees', '/policies#delivery'], ['Payments', '/policies#payments'], ['Seller payouts', '/policies#payouts']] },
  { title: 'Policies', links: [['Terms of use', '/policies#terms'], ['Privacy policy', '/policies#privacy'], ['Refunds & returns', '/policies#refunds'], ['Prohibited items', '/policies#prohibited']] },
]

/** Site-wide footer: navigation plus every policy, one tap away. */
export default function SiteFooter() {
  return (
    <footer className="mt-10 border-t border-gray-200/70 bg-white/60">
      <div className="page-container py-10">
        <div className="grid gap-8 sm:grid-cols-2 lg:grid-cols-[1.4fr_repeat(3,1fr)]">
          <div>
            <p className="font-display text-lg font-extrabold text-ink">{APP_NAME}</p>
            <p className="mt-2 max-w-xs text-sm leading-relaxed text-ink-muted">Buy and sell with verified students. We collect and deliver — buyer and seller never have to meet.</p>
          </div>
          {GROUPS.map((g) => (
            <nav key={g.title} aria-label={g.title}>
              <p className="mb-3 text-xs font-bold uppercase tracking-wider text-ink-muted">{g.title}</p>
              <ul className="space-y-2">
                {g.links.map(([label, href]) => (
                  <li key={label}><Link href={href} className="text-sm text-ink-soft transition-colors hover:text-green-700">{label}</Link></li>
                ))}
              </ul>
            </nav>
          ))}
        </div>
      </div>
    </footer>
  )
}
