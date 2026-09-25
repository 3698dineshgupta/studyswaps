/**
 * Copy and URL helpers for the city / city x category landing pages under /second-hand.
 * Pure (no server imports) so it is unit-tested in tests/seo/landing.test.ts.
 *
 * All text is hand-written and states only what is true of the product: verified student sellers, StudySwaps collects
 * from the seller and delivers (buyer and seller never meet), payment by eSewa. No user, listing or price statistics
 * are written here; the only number a page shows is the real count of currently listed items, added by the page itself.
 */
import { CATEGORIES } from '@/lib/constants'
import { LAUNCH_CITIES, cityBySlug, type CitySlug, type LaunchCity } from '@/lib/cities'

export const LANDING_ROOT = '/second-hand'
export const META_DESCRIPTION_MAX = 158

export const landingPath = (city: CitySlug, category?: string | null) =>
  `${LANDING_ROOT}/${city}${category ? `/${category}` : ''}`

/** Every launch city whose place names appear in the location text. Same rule as the SQL `location ilike` filter the pages use. */
export function citiesOfLocation(location?: string | null): CitySlug[] {
  const t = (location ?? '').toLowerCase()
  if (!t) return []
  return LAUNCH_CITIES.filter((c) => c.keywords.some((k) => t.includes(k))).map((c) => c.slug)
}

/** Number of listing rows per "kathmandu/books" key (a listing located in two cities counts in both). Rows with an unknown category are ignored. */
export function countCityCategories(rows: { location?: string | null; category?: string | null }[]): Record<string, number> {
  const known = new Set(CATEGORIES.map((c) => c.slug))
  const out: Record<string, number> = {}
  for (const r of rows) {
    if (!r.category || !known.has(r.category)) continue
    for (const city of citiesOfLocation(r.location)) out[`${city}/${r.category}`] = (out[`${city}/${r.category}`] ?? 0) + 1
  }
  return out
}

interface CityCopy {
  /** Meta description of the city hub */
  description: string
  intro: string[]
  /** One sentence about which areas the listings cover */
  areas: string
}

const CITY_COPY: Record<CitySlug, CityCopy> = {
  kathmandu: {
    description:
      'Buy and sell second-hand books, laptops, furniture and hostel items with verified students in Kathmandu. We collect and deliver. Pay with eSewa.',
    intro: [
      'StudySwaps is where students in the Kathmandu Valley pass on what they no longer need and find what they do: textbooks, laptops, study furniture and hostel essentials. Every seller is a verified student, so you are buying from people in your own campus community.',
      'You never have to arrange a meet-up. StudySwaps collects the item from the seller and delivers it to your address in the city, and you pay online with eSewa.',
    ],
    areas: 'Listings in the Kathmandu Valley include items from Kathmandu, Lalitpur and Bhaktapur.',
  },
  butwal: {
    description:
      'Find second-hand books, laptops, furniture and hostel items from verified students in Butwal and Rupandehi, delivered to your door. Pay with eSewa.',
    intro: [
      'Studying in Butwal, Devdaha or elsewhere around Rupandehi? This is the place to find used textbooks, laptops, furniture and hostel items from other verified students, at student-friendly prices.',
      'You never have to meet a stranger to buy: StudySwaps collects the item from the seller and delivers it to your door, so buyer and seller never meet. Payment is through eSewa.',
    ],
    areas: 'Listings in this area cover Butwal and nearby parts of Rupandehi such as Devdaha and Tilottama.',
  },
}

interface CategoryCopy {
  /** Used in titles and the H1: "<noun> in <City> for Students" */
  noun: string
  /** Lower-case link text: "second-hand books" gives "Second-hand books in Kathmandu" */
  linkNoun: string
  /** Meta description with a {city} placeholder */
  description: string
  intro: string[]
  tips: string[]
}

const CATEGORY_COPY: Record<string, CategoryCopy> = {
  books: {
    noun: 'Second-hand Books',
    linkNoun: 'second-hand books',
    description: 'Buy second-hand textbooks, reference books and notes in {city} from verified students. We deliver, so you never meet the seller. Pay with eSewa.',
    intro: [
      'Textbooks, reference books and class notes are the things students most often pass from one batch to the next. A used copy usually costs less than a new one, and the seller can tell you exactly which course and semester it was used for.',
    ],
    tips: [
      'Check the edition and year against your syllabus before you order.',
      'Look at the photos for missing pages, heavy highlighting or water damage.',
      'Read the description to see whether notes cover the whole semester.',
    ],
  },
  electronics: {
    noun: 'Used Laptops & Electronics',
    linkNoun: 'used laptops & electronics',
    description: 'Shop used laptops, phones, calculators and other electronics in {city} from verified students. We deliver to your door and you pay with eSewa.',
    intro: [
      'Laptops, phones, calculators, headphones and chargers change hands often as students upgrade or finish their courses. Buying used is a practical way to get a working device for study without paying the price of a new one.',
    ],
    tips: [
      'Check the specifications (processor, RAM, storage) match what your course needs.',
      'Look for details on battery life, screen condition and whether the charger is included.',
      'Message the seller through StudySwaps about anything the listing does not say before you pay.',
    ],
  },
  furniture: {
    noun: 'Second-hand Furniture',
    linkNoun: 'second-hand furniture',
    description: 'Find used study desks, chairs, shelves and other furniture in {city} from verified students. Collected from the seller and delivered by StudySwaps.',
    intro: [
      'Moving into a rented room or hostel usually means needing a desk, a chair or a shelf quickly. Students who are leaving the city often sell theirs, so you can furnish a room with second-hand pieces.',
    ],
    tips: [
      'Measure your room and doorway; check the size given in the description.',
      'Check the photos for wobbly legs, broken drawers or damaged surfaces.',
      'Larger items are still delivered to your address, with the fee worked out at checkout.',
    ],
  },
  clothing: {
    noun: 'Second-hand Clothing',
    linkNoun: 'second-hand clothing',
    description: 'Buy pre-loved jackets, uniforms and everyday clothing in {city} from verified students at student-friendly prices. Delivered to you, paid with eSewa.',
    intro: [
      'Winter jackets, college uniforms and everyday clothes are often worn for a season or two and then outgrown. Second-hand clothing from other students is an easy way to save money on things you would otherwise buy new.',
    ],
    tips: [
      'Check the size and measurements in the description, not just the label.',
      'Look closely at the photos for wear on cuffs, zips and seams.',
      'Ask the seller if anything you care about, such as fabric or fit, is missing from the listing.',
    ],
  },
  bicycles: {
    noun: 'Used Bicycles',
    linkNoun: 'used bicycles',
    description: 'Find second-hand bicycles for getting around campus in {city}, listed by verified students. StudySwaps delivers to your address; pay with eSewa.',
    intro: [
      'A bicycle is a cheap way to get between hostel, campus and market. Students who finish their studies often sell theirs, so a used bicycle can be far more affordable than a new one.',
    ],
    tips: [
      'Check that the frame size suits your height.',
      'Look at the photos for worn tyres, rusty chains and brake condition.',
      'Check the description for the number of gears and any repairs done, and message the seller if it is not there.',
    ],
  },
  'hostel-items': {
    noun: 'Second-hand Hostel Items',
    linkNoun: 'second-hand hostel items',
    description: 'Get hostel essentials such as bedding, kitchenware, heaters and fans in {city} second-hand from verified students. Delivered by StudySwaps.',
    intro: [
      'Starting at a new hostel or rented room means buying a lot of small things at once: bedding, buckets, kitchenware, a heater for winter or a fan for summer. Students moving out often sell these as a bundle or one by one.',
    ],
    tips: [
      'For electrical items like heaters and fans, check that the cord and plug are shown in the photos.',
      'Bedding and mattresses should be described honestly; check the condition stated.',
      'Look for listings that include several items if you are furnishing a whole room.',
    ],
  },
  'lab-equipment': {
    noun: 'Second-hand Lab Equipment',
    linkNoun: 'second-hand lab equipment',
    description: 'Buy used lab coats, kits and practical-class supplies in {city} from verified students at student-friendly prices, delivered to you by StudySwaps.',
    intro: [
      'Science, medical and engineering courses come with a list of lab coats, kits, glassware and instruments. Students in later years often have complete sets they no longer need, which makes second-hand a good way to cover your practical list.',
    ],
    tips: [
      'Compare the listing against the list your college gives you, since requirements differ.',
      'Check that kits are complete and glassware is not chipped or cracked.',
      'Ask the seller which course and year the equipment was used for.',
    ],
  },
  'agricultural-equipment': {
    noun: 'Used Agri Equipment',
    linkNoun: 'used agricultural equipment',
    description: 'Find used hand tools and equipment for agriculture and forestry courses in {city}, listed by verified students. Delivered by StudySwaps; pay with eSewa.',
    intro: [
      'Agriculture and forestry courses need practical gear such as hand tools, measuring instruments and field equipment. Students from earlier batches sometimes sell what they no longer use.',
    ],
    tips: [
      'Look for rust, bent parts or missing pieces in the photos.',
      'Match the item against your practical or field-work list before ordering.',
      'Read the description for how long it was used and what it was used for.',
    ],
  },
  other: {
    noun: 'More Second-hand Items',
    linkNoun: 'other second-hand items',
    description: 'Browse other second-hand items in {city} from verified students, from study lamps and bags to everyday things. Delivered by StudySwaps, paid with eSewa.',
    intro: [
      'Not everything students sell fits a neat category. This page collects the rest: study lamps, bags, stationery and other everyday things that are still perfectly useful.',
    ],
    tips: [
      'Read the listing description and look through all the photos.',
      'Check the condition label (New, Like New, Good, Fair or Poor) that the seller chose.',
      'If you cannot see something you need to know, message the seller before you pay.',
    ],
  },
}

export interface LandingSeo {
  title: string
  h1: string
  description: string
  intro: string[]
  tips: string[]
  path: string
}

const cityOrThrow = (slug: CitySlug): LaunchCity => {
  const c = cityBySlug(slug)
  if (!c) throw new Error(`Unknown city ${slug}`)
  return c
}

const capital = (s: string) => s.charAt(0).toUpperCase() + s.slice(1)

/** Copy for /second-hand/<city>. */
export function cityHubSeo(slug: CitySlug): LandingSeo {
  const city = cityOrThrow(slug)
  const copy = CITY_COPY[slug]
  const title = `Second-hand Books, Laptops & Hostel Items in ${city.name}`
  return { title, h1: title, description: copy.description, intro: [...copy.intro, copy.areas], tips: [], path: landingPath(slug) }
}

/** Copy for /second-hand/<city>/<category>, or null for an unknown category slug. */
export function cityCategorySeo(slug: CitySlug, categorySlug: string): LandingSeo | null {
  const city = cityOrThrow(slug)
  const cat = CATEGORY_COPY[categorySlug]
  if (!cat || !CATEGORIES.some((c) => c.slug === categorySlug)) return null
  const heading = `${cat.noun} in ${city.name} for Students`
  const delivery = `In ${city.name}, StudySwaps collects the item from the seller and delivers it to your address, so you never meet the seller, and you pay with eSewa.`
  return {
    title: heading,
    h1: heading,
    description: cat.description.replace('{city}', city.name),
    intro: [...cat.intro, delivery, CITY_COPY[slug].areas],
    tips: cat.tips,
    path: landingPath(slug, categorySlug),
  }
}

/** Descriptive anchor text such as "Second-hand books in Kathmandu". */
export function cityCategoryLinkText(slug: CitySlug, categorySlug: string): string {
  const city = cityOrThrow(slug)
  const cat = CATEGORY_COPY[categorySlug]
  return `${capital(cat?.linkNoun ?? 'second-hand items')} in ${city.name}`
}

export const cityLinkText = (slug: CitySlug) => `Second-hand items in ${cityOrThrow(slug).name}`

export function landingCrumbs(slug: CitySlug, categorySlug?: string | null) {
  const city = cityOrThrow(slug)
  const cat = CATEGORIES.find((c) => c.slug === categorySlug)
  return [
    { name: 'Home', path: '/' },
    { name: 'Second-hand', path: LANDING_ROOT },
    { name: city.name, path: landingPath(slug) },
    ...(cat ? [{ name: cat.name, path: landingPath(slug, cat.slug) }] : []),
  ]
}

/** Footer "Browse by city" links: the two city hubs plus books and laptops in each city. */
export function footerLandingLinks(): [string, string][] {
  return [
    ...LAUNCH_CITIES.map((c): [string, string] => [cityLinkText(c.slug), landingPath(c.slug)]),
    ...LAUNCH_CITIES.map((c): [string, string] => [cityCategoryLinkText(c.slug, 'books'), landingPath(c.slug, 'books')]),
    ...LAUNCH_CITIES.map((c): [string, string] => [cityCategoryLinkText(c.slug, 'electronics'), landingPath(c.slug, 'electronics')]),
  ]
}
