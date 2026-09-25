import Link from 'next/link'
import type { Metadata } from 'next'
import JsonLd from '@/components/seo/JsonLd'
import { APP_NAME } from '@/lib/constants'
import { LAUNCH_CITIES } from '@/lib/cities'
import { breadcrumbJsonLd } from '@/lib/jsonld'
import { LANDING_ROOT, cityHubSeo, cityLinkText, landingPath } from '@/lib/landing'
import { DEFAULT_SHARE_IMAGE } from '@/lib/seo'

const TITLE = 'Second-hand Items for Students in Kathmandu & Butwal'
const DESCRIPTION = 'Choose your city to find second-hand books, laptops, furniture and hostel items from verified students, delivered by StudySwaps. Pay with eSewa.'

export const metadata: Metadata = {
  title: TITLE,
  description: DESCRIPTION,
  alternates: { canonical: LANDING_ROOT },
  openGraph: { title: TITLE, description: DESCRIPTION, url: LANDING_ROOT, siteName: APP_NAME, type: 'website', locale: 'en_NP', images: [DEFAULT_SHARE_IMAGE] },
  twitter: { card: 'summary_large_image', title: TITLE, description: DESCRIPTION, images: [DEFAULT_SHARE_IMAGE.url] },
}

/** Landing page for the "Second-hand" breadcrumb step: one link to each launch city. */
export default function SecondHandIndexPage() {
  return (
    <div className="page-container py-6 sm:py-8">
      <JsonLd data={breadcrumbJsonLd([{ name: 'Home', path: '/' }, { name: 'Second-hand', path: LANDING_ROOT }])} />
      <header className="mb-6 max-w-3xl">
        <h1 className="font-display text-2xl font-extrabold tracking-tight text-ink sm:text-3xl">{TITLE}</h1>
        <p className="mt-3 text-[15px] leading-relaxed text-ink-soft">
          {APP_NAME} is a second-hand marketplace for verified students. We collect each item from the seller and deliver it to you, so buyer and seller never meet. Pick your city to see what is listed.
        </p>
      </header>
      <ul className="grid gap-4 sm:grid-cols-2">
        {LAUNCH_CITIES.map((c) => (
          <li key={c.slug}>
            <Link href={landingPath(c.slug)} className="card-hover block h-full p-5">
              <span className="font-display text-lg font-bold text-ink">{cityLinkText(c.slug)}</span>
              <span className="mt-1 block text-sm text-ink-muted">{c.blurb}</span>
              <span className="mt-2 block text-sm leading-relaxed text-ink-soft">{cityHubSeo(c.slug).description}</span>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  )
}
