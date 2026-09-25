/** Unit tests for the landing-page copy and helpers in src/lib/landing.ts */
import { CATEGORIES } from '@/lib/constants'
import { LAUNCH_CITIES } from '@/lib/cities'
import {
  META_DESCRIPTION_MAX, cityCategoryLinkText, cityCategorySeo, cityHubSeo, citiesOfLocation, countCityCategories,
  footerLandingLinks, landingCrumbs, landingPath,
} from '@/lib/landing'

const pages = () => [
  ...LAUNCH_CITIES.map((c) => cityHubSeo(c.slug)),
  ...LAUNCH_CITIES.flatMap((c) => CATEGORIES.map((k) => cityCategorySeo(c.slug, k.slug)!)),
]

describe('landing copy', () => {
  it('has copy for every city x category and none for an unknown category', () => {
    for (const c of LAUNCH_CITIES) for (const k of CATEGORIES) expect(cityCategorySeo(c.slug, k.slug)).not.toBeNull()
    expect(cityCategorySeo('butwal', 'bogus')).toBeNull()
  })

  it('titles, H1s and descriptions are unique and within length limits', () => {
    const all = pages()
    for (const key of ['title', 'description'] as const) expect(new Set(all.map((p) => p[key])).size).toBe(all.length)
    for (const p of all) {
      expect(p.h1).toBe(p.title)
      expect(p.title.length).toBeLessThanOrEqual(62) // + " | StudySwaps" is added by the layout template
      expect(p.description.length).toBeGreaterThanOrEqual(100)
      expect(p.description.length).toBeLessThanOrEqual(META_DESCRIPTION_MAX)
      expect(p.description).not.toContain('{city}')
    }
  })

  it('names the city in every title and description', () => {
    for (const c of LAUNCH_CITIES) {
      for (const p of [cityHubSeo(c.slug), ...CATEGORIES.map((k) => cityCategorySeo(c.slug, k.slug)!)]) {
        expect(p.title).toContain(c.name)
        expect(p.description).toContain(c.name)
      }
    }
  })

  it('titles match the agreed pattern', () => {
    expect(cityCategorySeo('kathmandu', 'books')!.title).toBe('Second-hand Books in Kathmandu for Students')
    expect(cityCategorySeo('butwal', 'electronics')!.title).toBe('Used Laptops & Electronics in Butwal for Students')
  })

  it('intro text is different for every page and category pages carry tips', () => {
    const intros = pages().map((p) => p.intro.join(' '))
    expect(new Set(intros).size).toBe(intros.length)
    for (const c of LAUNCH_CITIES) for (const k of CATEGORIES) expect(cityCategorySeo(c.slug, k.slug)!.tips.length).toBeGreaterThanOrEqual(3)
  })

  it('makes no numeric or superlative claims in the copy', () => {
    for (const p of pages()) {
      const text = [p.title, p.description, ...p.intro, ...p.tips].join(' ')
      expect(text).not.toMatch(/\d/)
      expect(text).not.toMatch(/\b(best|cheapest|largest|thousands|leading|#1)\b/i)
    }
  })

  it('states the real service model on every hub', () => {
    for (const c of LAUNCH_CITIES) {
      const text = cityHubSeo(c.slug).intro.join(' ')
      expect(text).toMatch(/verified/i)
      expect(text).toMatch(/eSewa/)
      expect(text).toMatch(/deliver/i)
    }
  })
})

describe('paths and links', () => {
  it('builds landing paths', () => {
    expect(landingPath('butwal')).toBe('/second-hand/butwal')
    expect(landingPath('butwal', 'books')).toBe('/second-hand/butwal/books')
    expect(cityCategorySeo('butwal', 'books')!.path).toBe('/second-hand/butwal/books')
  })
  it('breadcrumbs go Home > Second-hand > City > Category', () => {
    expect(landingCrumbs('kathmandu', 'books').map((c) => c.name)).toEqual(['Home', 'Second-hand', 'Kathmandu', 'Books & Notes'])
    expect(landingCrumbs('kathmandu').map((c) => c.path)).toEqual(['/', '/second-hand', '/second-hand/kathmandu'])
  })
  it('link text is descriptive', () => {
    expect(cityCategoryLinkText('kathmandu', 'books')).toBe('Second-hand books in Kathmandu')
  })
  it('footer links only point at real pages', () => {
    const links = footerLandingLinks()
    expect(links.length).toBeGreaterThanOrEqual(4)
    for (const [label, href] of links) {
      expect(label.length).toBeGreaterThan(10)
      const [, root, city, cat] = href.split('/')
      expect(root).toBe('second-hand')
      expect(LAUNCH_CITIES.some((c) => c.slug === city)).toBe(true)
      if (cat) expect(CATEGORIES.some((k) => k.slug === cat)).toBe(true)
    }
  })
})

describe('mapping listings to cities', () => {
  it('finds the launch cities in a location text', () => {
    expect(citiesOfLocation('Baneshwor, Kathmandu')).toEqual(['kathmandu'])
    expect(citiesOfLocation('Tilottama, Rupandehi')).toEqual(['butwal'])
    expect(citiesOfLocation('Pokhara')).toEqual([])
    expect(citiesOfLocation(null)).toEqual([])
  })
  it('counts listings per city x category and ignores unknown categories', () => {
    const counts = countCityCategories([
      { location: 'Thamel, Kathmandu', category: 'books' },
      { location: 'Lalitpur', category: 'books' },
      { location: 'Butwal', category: 'electronics' },
      { location: 'Butwal', category: 'bogus' },
      { location: 'Pokhara', category: 'books' },
      { location: 'Butwal', category: null },
    ])
    expect(counts).toEqual({ 'kathmandu/books': 2, 'butwal/electronics': 1 })
  })
})
