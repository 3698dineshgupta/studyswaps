import Link from 'next/link'
import type { Metadata } from 'next'
import type { ReactNode } from 'react'
import { BadgeCheck, EyeOff, Handshake, Lock, ShieldCheck } from 'lucide-react'
import JsonLd from '@/components/seo/JsonLd'
import SiteFooter from '@/components/layout/SiteFooter'
import { APP_NAME } from '@/lib/constants'
import { LAUNCH_CITIES } from '@/lib/cities'
import { breadcrumbJsonLd, faqJsonLd } from '@/lib/jsonld'
import { LANDING_ROOT, cityLinkText, landingPath } from '@/lib/landing'
import { DELIVERY, PLATFORM_FEE, WITHDRAWAL, priceOrder } from '@/lib/pricing'
import { DEFAULT_SHARE_IMAGE } from '@/lib/seo'
import { COMMISSION_PCT, HOW_DESCRIPTION, HOW_FAQ, HOW_PATH, HOW_SHARE_TITLE, HOW_TITLE, PHOTO_RANGE } from '@/lib/howItWorks'
import { formatPrice } from '@/lib/utils'

export const metadata: Metadata = {
  // Absolute: the title already carries the brand, so the layout's "| StudySwaps" template is skipped
  title: { absolute: HOW_TITLE },
  description: HOW_DESCRIPTION,
  alternates: { canonical: HOW_PATH },
  // A page-level openGraph replaces the layout's, so the site name, locale and default share image are repeated here
  openGraph: { title: HOW_SHARE_TITLE, description: HOW_DESCRIPTION, url: HOW_PATH, siteName: APP_NAME, type: 'website', locale: 'en_NP', images: [DEFAULT_SHARE_IMAGE] },
  twitter: { card: 'summary_large_image', title: HOW_SHARE_TITLE, description: HOW_DESCRIPTION, images: [DEFAULT_SHARE_IMAGE.url] },
}

const link = 'font-semibold text-green-700 underline-offset-2 hover:underline'
const B = ({ children }: { children: ReactNode }) => <b className="font-semibold text-ink">{children}</b>

interface Step { title: string; body: ReactNode }

const BUYER_STEPS: Step[] = [
  {
    title: 'Browse',
    body: <>Find books, laptops, furniture, hostel items and more from verified students. <Link href="/browse" className={link}>Browse everything</Link> or start with your city.</>,
  },
  {
    title: 'Add to cart',
    body: <>Check the photos, description and condition label, then add the item to your cart. Second-hand items are usually one of a kind, so once an item is paid for it is reserved for you and removed from sale.</>,
  },
  {
    title: 'Pay with eSewa',
    body: <>Your total is the item price + delivery fee + {formatPrice(PLATFORM_FEE)} platform fee, shown before you pay. {APP_NAME} holds the money; it is not handed to the seller straight away.</>,
  },
  {
    title: 'We collect it and deliver it',
    body: <>The seller hands the item to {APP_NAME}. We check it and deliver it to your address, and you can follow every step on your order page. <B>You and the seller never meet</B> or share addresses.</>,
  },
  {
    title: 'Check it and confirm',
    body: <>Check the item when it arrives and confirm it in the app. If something is not as described, report it from your order page as soon as you receive it. See <Link href="/policies#refunds" className={link}>refunds &amp; returns</Link>.</>,
  },
]

const SELLER_STEPS: Step[] = [
  {
    title: 'Sign up',
    body: <><Link href="/register" className={link}>Create a free account</Link>. Anyone can sign up; identity verification is only asked for when you start selling.</>,
  },
  {
    title: 'Verify your student ID, once',
    body: <>Your device camera takes two live photos: the front of your student ID card, then a selfie holding it. Uploads from the gallery are not accepted. The photos are stored privately and reviewed by our team, usually within 24 hours.</>,
  },
  {
    title: 'List an item',
    body: <>Add a title, description, condition, price, the pickup address and {PHOTO_RANGE} real photos of the actual item. <Link href="/sell" className={link}>Start a listing</Link>.</>,
  },
  {
    title: 'We approve your listing',
    body: <>New listings are reviewed by our team before they go live, and you are notified once yours is approved.</>,
  },
  {
    title: 'Get an order',
    body: <>When a buyer pays, you are notified. Accept it promptly and have the item packed and ready.</>,
  },
  {
    title: 'Hand it to StudySwaps',
    body: <>You give the item to {APP_NAME} (or our delivery partner). We deliver it, so you never have to meet the buyer or share your phone number.</>,
  },
  {
    title: 'Earnings become withdrawable on delivery',
    body: <>After a sale your earnings sit as pending. They become available as soon as the order is marked <B>delivered</B>.</>,
  },
  {
    title: 'Withdraw to eSewa',
    body: <>Request a withdrawal to your eSewa number from {formatPrice(WITHDRAWAL.minAmount)}. Requests are processed {WITHDRAWAL.processingText}.</>,
  },
]

function Steps({ steps, label }: { steps: Step[]; label: string }) {
  return (
    <ol aria-label={label} className="mt-5 space-y-3">
      {steps.map((s, i) => (
        <li key={s.title} className="card flex gap-4 p-4 sm:p-5">
          <span aria-hidden className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-green-50 font-display text-sm font-extrabold text-green-700">{i + 1}</span>
          <div className="min-w-0">
            <h3 className="font-display text-base font-bold text-ink">{s.title}</h3>
            <p className="mt-1 text-[15px] leading-relaxed text-ink-soft">{s.body}</p>
          </div>
        </li>
      ))}
    </ol>
  )
}

const H2 = 'font-display text-xl font-extrabold tracking-tight text-ink sm:text-2xl'

// The worked example is priced by the same function that prices real orders (an item inside the base delivery distance)
const EXAMPLE_ITEM = 1000
const example = priceOrder(EXAMPLE_ITEM, DELIVERY.baseKm)

export default function HowItWorksPage() {
  const fees: [string, string, string][] = [
    ['Delivery fee', formatPrice(DELIVERY.baseFee), `Paid by the buyer. Covers up to ${DELIVERY.baseKm} km, plus ${formatPrice(DELIVERY.perExtraKm)} for every extra km.`],
    ['Platform fee', formatPrice(PLATFORM_FEE), 'Paid by the buyer, once per order.'],
    ['Seller commission', COMMISSION_PCT, 'Of the item price, kept by us only when an item sells. Listing is free.'],
    ['Minimum withdrawal', formatPrice(WITHDRAWAL.minAmount), 'Sellers withdraw to eSewa only.'],
  ]
  const safety: { Icon: typeof BadgeCheck; title: string; text: string }[] = [
    { Icon: BadgeCheck, title: 'Verified sellers', text: 'Every seller passes a live ID check, a photo of their student ID and a selfie holding it, before their first listing.' },
    { Icon: Lock, title: 'Private ID photos', text: 'Verification photos are stored privately. Only you and the small team that reviews verification requests can see them, never other users.' },
    { Icon: Handshake, title: 'We stand in the middle', text: `${APP_NAME} is the mediator. The buyer's money is held by us, items travel through us, and buyers and sellers never see each other's address or phone number.` },
  ]

  return (
    <>
    <div className="page-container py-6 sm:py-8">
      <JsonLd data={breadcrumbJsonLd([{ name: 'Home', path: '/' }, { name: 'How it works', path: HOW_PATH }])} />
      <JsonLd data={faqJsonLd(HOW_FAQ)} />

      <header className="max-w-3xl">
        <p className="mb-2 flex items-center gap-1.5 text-xs font-bold uppercase tracking-[0.14em] text-green-700"><ShieldCheck className="h-4 w-4" aria-hidden /> Trust &amp; safety</p>
        <h1 className="font-display text-3xl font-extrabold tracking-tight text-ink sm:text-4xl">How {APP_NAME} works</h1>
        <p className="mt-3 text-[15px] leading-relaxed text-ink-soft">
          {APP_NAME} is a second-hand marketplace for verified students in Nepal. We sit between buyer and seller: we collect each item and deliver it, so you never have to meet a stranger or share your address. Here is how it works for buyers and sellers, what it costs and how we keep it safe.
        </p>
        <div className="mt-5 flex flex-wrap gap-3">
          <Link href="/browse" className="btn-primary">Browse items</Link>
          <Link href="/sell" className="btn-secondary">Start selling</Link>
        </div>
      </header>

      <div className="mt-10 grid gap-10 lg:grid-cols-2 lg:gap-8">
        <section id="buyers" aria-labelledby="buyers-h" className="min-w-0 scroll-mt-24">
          <h2 id="buyers-h" className={H2}>For buyers</h2>
          <p className="mt-1.5 text-sm text-ink-muted">From browsing to your door, in five steps.</p>
          <Steps steps={BUYER_STEPS} label="Steps for buyers" />
        </section>
        <section id="sellers" aria-labelledby="sellers-h" className="min-w-0 scroll-mt-24">
          <h2 id="sellers-h" className={H2}>For sellers</h2>
          <p className="mt-1.5 text-sm text-ink-muted">Turn things you no longer need into money, without meeting anyone.</p>
          <Steps steps={SELLER_STEPS} label="Steps for sellers" />
        </section>
      </div>

      <section id="fees" aria-labelledby="fees-h" className="mt-12 scroll-mt-24">
        <h2 id="fees-h" className={H2}>What it costs</h2>
        <p className="mt-1.5 max-w-3xl text-sm text-ink-muted">These are the same numbers used to price real orders, and your total is always shown before you pay.</p>
        <dl className="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {fees.map(([k, v, d]) => (
            <div key={k} className="card p-4">
              <dt className="text-[11px] font-semibold uppercase tracking-wider text-ink-muted">{k}</dt>
              <dd className="mt-1 font-display text-2xl font-extrabold text-ink">{v}</dd>
              <dd className="mt-1 text-[13px] leading-relaxed text-ink-muted">{d}</dd>
            </div>
          ))}
        </dl>
        <p className="mt-4 max-w-3xl text-[15px] leading-relaxed text-ink-soft">
          <B>Example:</B> for a {formatPrice(EXAMPLE_ITEM)} item within {DELIVERY.baseKm} km, the buyer pays {formatPrice(example.total)} ({formatPrice(EXAMPLE_ITEM)} + {formatPrice(example.deliveryFee)} delivery + {formatPrice(example.platformFee)} platform fee) and the seller earns {formatPrice(example.sellerNet)}, after the {formatPrice(example.commission)} commission. Full details in <Link href="/policies#buying" className={link}>prices &amp; fees</Link> and <Link href="/policies#payouts" className={link}>seller payouts</Link>.
        </p>
      </section>

      <section id="safety" aria-labelledby="safety-h" className="mt-12 scroll-mt-24">
        <h2 id="safety-h" className={H2}>Safety</h2>
        <ul className="mt-5 grid gap-3 md:grid-cols-3">
          {safety.map(({ Icon, title, text }) => (
            <li key={title} className="card p-5">
              <span className="mb-3 flex h-10 w-10 items-center justify-center rounded-xl bg-green-50 text-green-700"><Icon className="h-5 w-5" aria-hidden /></span>
              <h3 className="font-display text-base font-bold text-ink">{title}</h3>
              <p className="mt-1.5 text-sm leading-relaxed text-ink-muted">{text}</p>
            </li>
          ))}
        </ul>
        <p className="mt-4 flex max-w-3xl gap-2 text-[15px] leading-relaxed text-ink-soft">
          <EyeOff className="mt-1 h-4 w-4 shrink-0 text-green-700" aria-hidden />
          <span>Read the full <Link href="/policies#privacy" className={link}>privacy policy</Link>, the <Link href="/policies#terms" className={link}>terms of use</Link> and the <Link href="/policies#verification" className={link}>identity verification</Link> rules.</span>
        </p>
      </section>

      <section id="faq" aria-labelledby="faq-h" className="mt-12 scroll-mt-24">
        <h2 id="faq-h" className={H2}>Common questions</h2>
        <dl className="mt-5 grid gap-3 lg:grid-cols-2">
          {HOW_FAQ.map((f) => (
            <div key={f.question} className="card p-5">
              <dt><h3 className="font-display text-base font-bold text-ink">{f.question}</h3></dt>
              <dd className="mt-1.5 text-[15px] leading-relaxed text-ink-soft">
                {f.answer}
                {f.more && <> <Link href={f.more.href} className={link}>{f.more.label}</Link></>}
              </dd>
            </div>
          ))}
        </dl>
      </section>

      <section aria-labelledby="next-h" className="mt-12 rounded-3xl bg-ink p-6 text-white sm:p-8">
        <h2 id="next-h" className="font-display text-xl font-extrabold">Ready to start?</h2>
        <p className="mt-1.5 max-w-2xl text-sm text-gray-300">
          Find something in your city, or <Link href="/register" className="font-semibold text-green-400 underline-offset-2 hover:underline">create a free account</Link> to start selling.
        </p>
        <ul className="mt-4 flex flex-wrap gap-x-5 gap-y-2 text-sm">
          <li><Link href="/browse" className="font-semibold text-green-400 underline-offset-2 hover:underline">Browse all items</Link></li>
          {LAUNCH_CITIES.map((c) => (
            <li key={c.slug}><Link href={landingPath(c.slug)} className="font-semibold text-green-400 underline-offset-2 hover:underline">{cityLinkText(c.slug)}</Link></li>
          ))}
          <li><Link href={LANDING_ROOT} className="font-semibold text-green-400 underline-offset-2 hover:underline">All cities</Link></li>
          <li><Link href="/policies" className="font-semibold text-green-400 underline-offset-2 hover:underline">Policies &amp; terms</Link></li>
        </ul>
      </section>
    </div>
    <SiteFooter />
    </>
  )
}
