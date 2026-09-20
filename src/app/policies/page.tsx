import Link from 'next/link'
import type { Metadata } from 'next'
import type { ReactNode } from 'react'
import {
  Ban, BadgeCheck, CreditCard, FileText, Handshake, Lock, MessageSquareWarning, Package, ScrollText,
  ShieldCheck, Store, Truck, Undo2, Wallet,
} from 'lucide-react'
import Header from '@/components/layout/Header'
import MobileNav from '@/components/layout/MobileNav'
import SiteFooter from '@/components/layout/SiteFooter'
import { APP_NAME } from '@/lib/constants'
import { DELIVERY, PLATFORM_FEE, SELLER_COMMISSION_RATE, WITHDRAWAL } from '@/lib/pricing'
import { SERVICE_CITIES } from '@/lib/delivery'
import { formatPrice } from '@/lib/utils'

export const metadata: Metadata = {
  title: `Policies & terms — ${APP_NAME}`,
  description: 'How StudentMarket works: terms of use, delivery, fees, payments, seller payouts, refunds, prohibited items and privacy.',
}

const EFFECTIVE = '20 September 2026'
const pct = `${SELLER_COMMISSION_RATE * 100}%`

const P = ({ children }: { children: ReactNode }) => <p className="text-[15px] leading-relaxed text-ink-soft">{children}</p>
const UL = ({ items }: { items: ReactNode[] }) => (
  <ul className="space-y-2">
    {items.map((t, i) => (
      <li key={i} className="flex gap-2.5 text-[15px] leading-relaxed text-ink-soft">
        <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-green-500" aria-hidden />
        <span>{t}</span>
      </li>
    ))}
  </ul>
)
const H = ({ children }: { children: ReactNode }) => <h3 className="pt-1 font-display text-[15px] font-bold text-ink">{children}</h3>
const B = ({ children }: { children: ReactNode }) => <b className="font-semibold text-ink">{children}</b>

const SECTIONS: { id: string; title: string; Icon: typeof FileText; body: ReactNode }[] = [
  {
    id: 'how-it-works', title: 'How StudentMarket works', Icon: Handshake,
    body: (
      <>
        <P>{APP_NAME} is a marketplace where verified students sell books, gadgets, furniture and other second-hand things to other students. We act as the <B>mediator</B> between the two sides: the buyer and the seller <B>never need to meet, call or share their address</B>.</P>
        <UL items={[
          <>The buyer pays through eSewa. The money is held by {APP_NAME}, not handed to the seller straight away.</>,
          <>The seller hands the item to {APP_NAME} (or our delivery partner). We check it, then deliver it to the buyer&apos;s address.</>,
          <>When the buyer confirms receipt — or after {WITHDRAWAL.releaseDays} days without a problem being reported — the seller&apos;s earnings become withdrawable.</>,
        ]} />
      </>
    ),
  },
  {
    id: 'terms', title: 'Terms of use', Icon: ScrollText,
    body: (
      <>
        <P>By creating an account, listing, buying or withdrawing on {APP_NAME} you agree to these policies. If you do not agree, please do not use the service.</P>
        <H>Who can use it</H>
        <UL items={[
          'You must be a student (or recent student) aged 16 or over. Under 18s should have a parent or guardian\'s permission.',
          'One person, one account. Accounts cannot be sold, shared or transferred.',
          'You must give true information — your name, college, phone number and address must be yours.',
          'Anyone can sign up and buy. To sell, you must first complete identity verification (see below) — it is asked for once, when you start selling.',
        ]} />
        <H>What you agree to</H>
        <UL items={[
          'Follow the law of Nepal and the rules on this page, including the prohibited items list.',
          'Deal only through the platform. Do not ask a buyer or seller to pay, meet or deliver outside StudentMarket — it removes your protection and is a reason for suspension.',
          'Do not share your buyer\'s or seller\'s personal contact details, or try to find them out.',
          'Do not misuse the service: no fake listings, fake orders, fake reviews, scraping, or attempts to break or overload the site.',
        ]} />
        <H>Our right to act</H>
        <P>We may remove listings, cancel orders, hold funds, or suspend or close accounts that break these rules, look fraudulent, or put other students at risk. Where possible we will tell you why. We may also refuse or reverse a transaction that we reasonably suspect is fraudulent.</P>
      </>
    ),
  },
  {
    id: 'verification', title: 'Identity verification', Icon: BadgeCheck,
    body: (
      <>
        <P>To keep the community safe, every <B>seller</B> is verified before their first listing. <B>Buyers do not need to verify their identity.</B> When you choose to sell, a short verification window opens and walks you through it.</P>
        <UL items={[
          'You take a live photo of yourself and of your student ID with your device camera. Uploads from the gallery are not accepted.',
          'Your photos are stored privately. They are visible only to you and to the small team that reviews verification requests — never to other users.',
          'We use them only to confirm who you are and to prevent fraud. We do not use them for advertising or sell them.',
          'A request can be approved, rejected with a reason, or sent back for a clearer photo. You can try again if it is rejected.',
          'Verification may be withdrawn if the details turn out to be false or if the account is used for fraud.',
        ]} />
      </>
    ),
  },
  {
    id: 'buying', title: 'Buying: prices & fees', Icon: Package,
    body: (
      <>
        <P>What you pay for an order is always shown before you pay:</P>
        <div className="grid gap-3 sm:grid-cols-3">
          {[
            ['Item price', 'Set by the seller. Shown on the listing.'],
            ['Delivery fee', `${formatPrice(DELIVERY.baseFee)} within ${DELIVERY.baseKm} km, plus ${formatPrice(DELIVERY.perExtraKm)} for every additional km.`],
            ['Platform fee', `${formatPrice(PLATFORM_FEE)} per order — helps us run verification, support and delivery.`],
          ].map(([t, d]) => (
            <div key={t} className="rounded-2xl border border-gray-100 bg-gray-50 p-4">
              <p className="font-display text-sm font-bold text-ink">{t}</p>
              <p className="mt-1 text-[13px] leading-relaxed text-ink-muted">{d}</p>
            </div>
          ))}
        </div>
        <UL items={[
          <>Item price + delivery fee + {formatPrice(PLATFORM_FEE)} platform fee = your total. There are no hidden charges.</>,
          <>Prices are in Nepali rupees (NPR). Listings marked negotiable are still bought at the listed price on the platform.</>,
          'Second-hand items are usually one of a kind. Once an item is paid for it is reserved for you and removed from sale.',
          'The description and photos are provided by the seller. Please read them and check the condition label before you buy.',
        ]} />
      </>
    ),
  },
  {
    id: 'delivery', title: 'Delivery policy', Icon: Truck,
    body: (
      <>
        <P>All orders are delivered by {APP_NAME}. There is no self-pickup and no meet-up between buyer and seller.</P>
        <H>Where we deliver</H>
        <UL items={[
          <>We currently serve: <B>{SERVICE_CITIES.join(', ')}</B>. More areas will be added over time.</>,
          <>You give a searchable address, a house / street detail and a nearby <B>landmark</B>. Please make sure they are accurate — our rider uses them.</>,
          <>Delivery is available up to <B>{DELIVERY.maxKm} km</B> from the item&apos;s location.</>,
        ]} />
        <H>How the delivery fee is worked out</H>
        <UL items={[
          <><B>{formatPrice(DELIVERY.baseFee)}</B> flat when the buyer and the item are within <B>{DELIVERY.baseKm} km</B>.</>,
          <>Beyond {DELIVERY.baseKm} km, <B>{formatPrice(DELIVERY.perExtraKm)}</B> is added for every extra kilometre (a started kilometre counts as a full one). Example: 14.2 km = {formatPrice(DELIVERY.baseFee)} + 5 × {formatPrice(DELIVERY.perExtraKm)} = {formatPrice(DELIVERY.baseFee + 5 * DELIVERY.perExtraKm)}.</>,
          'Distance is measured in a straight line between the item\'s pickup point and your delivery address. The fee is calculated by our server and cannot be changed by the browser.',
          'Listings created before exact addresses were required are measured from the centre of the seller\'s city; the fee shown at checkout is what you pay.',
        ]} />
        <H>What to expect</H>
        <UL items={[
          'You can follow every step — accepted, packing, collected, in transit, out for delivery, delivered — on your order page and in notifications.',
          'Delivery times are estimates, not guarantees. Weather, traffic, strikes and public holidays can cause delays.',
          'Please be reachable on your contact number on the delivery day. If we cannot reach you after reasonable attempts, the order may be returned and re-delivery fees can apply.',
          'Check the item on receipt and confirm it in the app. Confirming tells us everything is fine.',
        ]} />
      </>
    ),
  },
  {
    id: 'payments', title: 'Payments', Icon: CreditCard,
    body: (
      <>
        <UL items={[
          <><B>eSewa is the only payment method.</B> Cash on delivery and other wallets are not offered.</>,
          'You pay on eSewa\'s own secure page. We never see or store your eSewa password or PIN.',
          'An order is confirmed only after eSewa reports the payment as complete and our server has checked the amount and the signature. If a payment fails or you close the page, the order stays unpaid and nothing is taken.',
          'If money left your eSewa account but your order still shows unpaid, contact support with your order number and eSewa reference — we will trace it and either confirm the order or refund you.',
          'We may hold, delay or reverse a payment that looks suspicious or breaks the law.',
        ]} />
      </>
    ),
  },
  {
    id: 'selling', title: 'Selling: listings & rules', Icon: Store,
    body: (
      <>
        <UL items={[
          'Only list things you own and are allowed to sell. Describe them honestly — condition, defects, what is included — and use your own real photos.',
          'Choose a fair price. You can change or remove a listing until it is sold.',
          'New listings are reviewed before they go live. We may reject, edit the category of, or remove a listing that breaks the rules.',
          'Give the exact pickup address and a landmark. It is used only to work out delivery and for our rider; buyers never see it.',
          'When an order comes in, accept it promptly and have the item packed and ready for collection. Repeated cancellations or no-shows can lead to listing removal or suspension.',
          'The item handed over must be the item in the listing. Swapping it, or sending something damaged or different from the description, is a violation.',
        ]} />
      </>
    ),
  },
  {
    id: 'payouts', title: 'Seller earnings & withdrawals', Icon: Wallet,
    body: (
      <>
        <H>What you earn</H>
        <UL items={[
          <>{APP_NAME} keeps a <B>{pct} commission</B> of the item price. You receive the other {100 - SELLER_COMMISSION_RATE * 100}%. Example: item sold for Rs. 1,000 → commission Rs. 50 → you earn Rs. 950.</>,
          'The buyer\'s delivery fee and the platform fee belong to StudentMarket — they are never taken from your earnings.',
        ]} />
        <H>When you can withdraw</H>
        <UL items={[
          <>After a sale your earnings first sit as <B>pending</B>. They become <B>available</B> when the buyer confirms delivery, or <B>{WITHDRAWAL.releaseDays} days after the order is marked delivered</B> if the buyer has not reported a problem — whichever comes first.</>,
          'If the buyer reports a problem, the earnings for that order stay on hold until we have reviewed it.',
        ]} />
        <H>Withdrawal requirements</H>
        <UL items={[
          <>Payout is to <B>eSewa only</B>, to a Nepali mobile number registered to you.</>,
          <>Minimum <B>{formatPrice(WITHDRAWAL.minAmount)}</B> and maximum <B>{formatPrice(WITHDRAWAL.maxAmount)}</B> per request, and never more than your available balance.</>,
          'Your account must be identity-verified (sellers are) and active (not suspended).',
          'One open withdrawal request at a time. A new one can be made once the previous request is paid.',
          <>Requests are processed <B>{WITHDRAWAL.processingText}</B>. Weekends and public holidays are not working days.</>,
          'Please double-check the eSewa number. We cannot recover money that was sent to a wrong number that you entered.',
          'We may hold or delay a withdrawal for review if there is a dispute, a fraud alert, or unusual activity, and we may ask for extra verification.',
        ]} />
      </>
    ),
  },
  {
    id: 'refunds', title: 'Cancellations, returns & refunds', Icon: Undo2,
    body: (
      <>
        <UL items={[
          <><B>Before the item is collected</B> from the seller, you can ask to cancel. If we can stop the order, you are refunded to eSewa and the item goes back on sale.</>,
          <><B>Not as described, damaged or wrong item?</B> Report it from your order page or through support <B>before you confirm receipt</B> — and within {WITHDRAWAL.releaseDays} days of delivery — with clear photos. We review each case with both sides (through us, never directly).</>,
          'If we find the item was not as described, you get a refund of the item price to eSewa (and the delivery fee where the mistake was the seller\'s), and the seller\'s earnings for that order are cancelled.',
          'Change of mind, or a wrong choice made by the buyer, is not a reason for a refund once the item has been collected. Delivery and platform fees are not refunded for those cases.',
          'Refunds are issued to the same eSewa account used to pay, usually within a few working days after a decision.',
          'Confirming receipt in the app tells us you are satisfied, so please only confirm after checking the item.',
        ]} />
      </>
    ),
  },
  {
    id: 'prohibited', title: 'Prohibited items & conduct', Icon: Ban,
    body: (
      <>
        <P>You must not list, buy or ask us to deliver:</P>
        <UL items={[
          'Weapons, ammunition, explosives, fireworks, and anything that can be used to hurt people.',
          'Illegal drugs, alcohol, tobacco, vapes, prescription or over-the-counter medicines.',
          'Stolen goods, counterfeit or fake branded products, pirated or photocopied books sold as originals, cracked software.',
          'Hazardous chemicals, biological samples, compressed gases or any lab material that cannot be safely carried. Ordinary lab tools and equipment are fine.',
          'Exam papers, assignments-for-hire, cheating services, or forged documents and certificates.',
          'Government IDs, bank cards, SIM cards or accounts of any kind.',
          'Live animals, adult or offensive material, and anything else illegal in Nepal.',
        ]} />
        <P>We may open, refuse or return a package that we believe contains a prohibited item, and may report it to the authorities.</P>
      </>
    ),
  },
  {
    id: 'privacy', title: 'Privacy policy', Icon: Lock,
    body: (
      <>
        <H>What we collect</H>
        <UL items={[
          'Account details: name, email, phone, college and profile photo.',
          'Verification photos: your live selfie and student ID photo (private).',
          'Addresses: your delivery address and landmark as a buyer; the item\'s pickup address as a seller; and the map coordinates found by the address search.',
          'Activity: listings, cart, wishlist, orders, delivery updates, chats, notifications, and withdrawal requests (including the eSewa number you provide).',
          'Technical data needed to keep the service secure: sign-in session cookies and basic device / log information.',
        ]} />
        <H>How we use it</H>
        <UL items={[
          'To run the marketplace: verify you, process orders and payments, deliver items, pay sellers.',
          'To keep everyone safe: prevent fraud, enforce these rules, resolve disputes.',
          'To contact you about your orders, account and safety. We do not sell your data and do not show your details to advertisers.',
        ]} />
        <H>Who sees what</H>
        <UL items={[
          <><B>Buyers and sellers never see each other&apos;s address or phone number.</B> Buyers see the seller&apos;s name, verified badge and general area (city) only. Sellers see the order, not the buyer&apos;s address.</>,
          'Our delivery team sees the addresses they need to collect and deliver an order.',
          'Service providers process data for us and only for that purpose: eSewa (payments), Supabase (secure database and private file storage), Cloudinary (listing photos), map data from OpenStreetMap (address search), and internal messaging tools for staff alerts.',
          'We may share information when the law requires it or to protect people from harm.',
        ]} />
        <H>Your choices</H>
        <UL items={[
          'You can view and update your profile at any time.',
          'You can ask us to delete your account and personal data. Some records (orders, payments, fraud checks) must be kept for a period by law or to protect users, and will be kept only for that.',
          'We keep verification photos only as long as needed to verify you and prevent fraud.',
          'We protect data with access controls, private storage and encrypted connections, but no system is perfectly secure. Please use a strong password and never share it.',
        ]} />
      </>
    ),
  },
  {
    id: 'community', title: 'Community, disputes & liability', Icon: MessageSquareWarning,
    body: (
      <>
        <UL items={[
          'Be kind and honest. Harassment, threats, hate speech, spam and fake reviews are not tolerated.',
          'Report anything suspicious from the listing or order page. Reports are reviewed by our team.',
          'Enforcement can include a warning, listing removal, holding funds, temporary suspension or a permanent ban, depending on how serious the case is. Serious cases may be reported to the police.',
          'Disputes are handled by us as mediator. We look at the order history, photos and messages and make a fair decision. You can ask us to review it again.',
          <>{APP_NAME} is a platform for student-to-student trading. Sellers are responsible for the items they list. To the extent the law allows, our liability for any order is limited to the amount you paid for it.</>,
          'We can update these policies as the service grows. When something important changes we will tell you in the app, and the date below will change. Continuing to use the service means you accept the update.',
          'These policies are governed by the laws of Nepal.',
        ]} />
      </>
    ),
  },
]

export default function PoliciesPage() {
  return (
    <>
      <Header />
      <main className="pb-24 lg:pb-0">
        <section className="border-b border-gray-200/70 bg-white/60">
          <div className="page-container py-10 sm:py-14">
            <p className="mb-2 flex items-center gap-1.5 text-xs font-bold uppercase tracking-[0.14em] text-green-700"><ShieldCheck className="h-4 w-4" /> Trust & safety</p>
            <h1 className="font-display text-3xl font-extrabold tracking-tight text-ink sm:text-5xl">Policies &amp; terms</h1>
            <p className="mt-3 max-w-2xl text-[15px] leading-relaxed text-ink-muted">Everything about how {APP_NAME} works, in plain language — fees, delivery, payments, when sellers get paid, refunds and your privacy. Effective {EFFECTIVE}.</p>

            {/* The numbers people ask about most (read from the same constants that price real orders) */}
            <dl className="mt-7 grid grid-cols-2 gap-3 md:grid-cols-4">
              {[
                ['Delivery', `${formatPrice(DELIVERY.baseFee)} ≤ ${DELIVERY.baseKm} km`, `+${formatPrice(DELIVERY.perExtraKm)} per extra km`],
                ['Buyer platform fee', formatPrice(PLATFORM_FEE), 'per order'],
                ['Seller commission', pct, 'of the item price'],
                ['Withdrawals', 'eSewa only', `from ${formatPrice(WITHDRAWAL.minAmount)} · ${WITHDRAWAL.processingText}`],
              ].map(([k, v, s]) => (
                <div key={k} className="card p-4">
                  <dt className="text-[11px] font-semibold uppercase tracking-wider text-ink-muted">{k}</dt>
                  <dd className="mt-1 font-display text-lg font-extrabold text-ink">{v}</dd>
                  <dd className="text-xs text-ink-muted">{s}</dd>
                </div>
              ))}
            </dl>
          </div>
        </section>

        <div className="page-container grid gap-8 py-8 lg:grid-cols-[250px_1fr] lg:py-12">
          <nav aria-label="Policy sections" className="lg:sticky lg:top-32 lg:self-start">
            <p className="mb-2 hidden text-xs font-bold uppercase tracking-wider text-ink-muted lg:block">On this page</p>
            <ul className="no-scrollbar -mx-4 flex gap-2 overflow-x-auto px-4 pb-1 lg:mx-0 lg:flex-col lg:gap-0.5 lg:overflow-visible lg:px-0">
              {SECTIONS.map(({ id, title, Icon }) => (
                <li key={id} className="shrink-0">
                  <a href={`#${id}`} className="flex items-center gap-2 whitespace-nowrap rounded-full border border-gray-200 bg-white px-3.5 py-2 text-sm font-medium text-ink-soft transition-colors hover:border-green-300 hover:text-green-800 lg:rounded-xl lg:border-transparent lg:bg-transparent lg:px-3 lg:py-2 lg:hover:bg-white">
                    <Icon className="h-4 w-4 shrink-0 text-green-600" aria-hidden /> {title}
                  </a>
                </li>
              ))}
            </ul>
          </nav>

          <div className="min-w-0 space-y-5">
            {SECTIONS.map(({ id, title, Icon, body }) => (
              <section key={id} id={id} className="card scroll-mt-36 space-y-3 p-5 sm:p-7">
                <h2 className="flex items-center gap-3 font-display text-xl font-extrabold text-ink sm:text-2xl">
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-green-50 text-green-700"><Icon className="h-5 w-5" /></span>
                  {title}
                </h2>
                {body}
              </section>
            ))}

            <div className="rounded-3xl bg-ink p-6 text-white sm:p-8">
              <h2 className="font-display text-xl font-extrabold">Questions or a problem with an order?</h2>
              <p className="mt-1.5 text-sm text-gray-300">Open the order in <Link href="/orders" className="font-semibold text-green-400 underline-offset-2 hover:underline">your orders</Link> and report it there, or message our team from the app. Please include your order number.</p>
              <p className="mt-4 text-xs text-gray-400">Last updated {EFFECTIVE}.</p>
            </div>
          </div>
        </div>
      </main>
      <SiteFooter />
      <MobileNav />
    </>
  )
}
