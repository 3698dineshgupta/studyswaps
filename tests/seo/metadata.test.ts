/** Unit tests for the pure SEO helpers in src/lib/seo.ts */
import { CATEGORIES } from '@/lib/constants'
import { BROWSE_SEO, CATEGORY_SEO, HOME_TITLE, SITE_DESCRIPTION, browseSeo, buildProductDescription, productImageUrl, trimAtWord } from '@/lib/seo'

describe('static copy', () => {
  it('home title/description are a sensible length and brand appears once', () => {
    expect(HOME_TITLE.length).toBeLessThanOrEqual(70)
    expect(HOME_TITLE.match(/StudySwaps/g)).toHaveLength(1)
    expect(SITE_DESCRIPTION.length).toBeGreaterThanOrEqual(120)
    expect(SITE_DESCRIPTION.length).toBeLessThanOrEqual(158) // Google truncates around 155-160
  })
  it('every category has its own unique title and description', () => {
    for (const c of CATEGORIES) expect(CATEGORY_SEO[c.slug]).toBeDefined()
    const titles = [BROWSE_SEO.title, ...CATEGORIES.map((c) => CATEGORY_SEO[c.slug].title)]
    expect(new Set(titles).size).toBe(titles.length)
    for (const c of CATEGORIES) {
      const { title, description } = CATEGORY_SEO[c.slug]
      expect(title.length).toBeLessThanOrEqual(58) // + " | StudySwaps" stays near 70
      expect(description.length).toBeGreaterThanOrEqual(100)
      expect(description.length).toBeLessThanOrEqual(165)
    }
  })
  it('browseSeo falls back to the generic copy for unknown or missing slugs', () => {
    expect(browseSeo(undefined)).toBe(BROWSE_SEO)
    expect(browseSeo('nope')).toBe(BROWSE_SEO)
    expect(browseSeo('books')).toBe(CATEGORY_SEO.books)
  })
})

describe('trimAtWord', () => {
  it('returns short text untouched (whitespace collapsed)', () => {
    expect(trimAtWord('  hello   world ', 50)).toBe('hello world')
  })
  it('never exceeds max, never cuts mid-word, adds an ellipsis', () => {
    const text = 'Barely used engineering mathematics textbook with handwritten notes in the margins'
    for (let max = 5; max < text.length; max++) {
      const out = trimAtWord(text, max)
      expect(out.length).toBeLessThanOrEqual(max)
      if (out) {
        expect(out.endsWith('…')).toBe(true)
        const body = out.slice(0, -1)
        expect(text.startsWith(body)).toBe(true)
        // the character after the cut in the source is a space (i.e. the cut is at a word boundary)
        expect(text[body.length] === ' ').toBe(true)
      }
    }
  })
})

describe('buildProductDescription', () => {
  const base = { title: 'Laptop with charger', price: 45000, condition: 'GOOD', location: 'Baneshwor, Kathmandu' }

  it('uses real data and the launch city name', () => {
    const d = buildProductDescription({ ...base, sellerVerified: true, delivery_available: true })
    expect(d).toContain('Laptop with charger')
    expect(d).toContain('Good condition')
    expect(d).toContain('Rs.')
    expect(d).toContain('in Kathmandu')
    expect(d).toContain('Sold by a verified student on StudySwaps.')
    expect(d).toContain('Delivered to your door.')
  })
  it('does not claim verification (or delivery) unless true', () => {
    const d = buildProductDescription({ ...base, sellerVerified: false, delivery_available: false })
    expect(d).not.toMatch(/verified/i)
    expect(d).not.toMatch(/Delivered/)
    expect(buildProductDescription(base)).not.toMatch(/verified/i)
  })
  it('omits missing pieces without leaving stray punctuation', () => {
    const d = buildProductDescription({ title: 'Desk lamp', price: 300 })
    expect(d).toBe('Desk lamp — Rs. 300.')
    expect(d).not.toContain('undefined')
    expect(d).not.toContain('null')
  })
  it('falls back to the first part of an unrecognised location', () => {
    expect(buildProductDescription({ title: 'Desk', price: 100, location: 'Pokhara, Kaski' })).toContain('in Pokhara.')
  })
  it('appends the seller text at a word boundary and never exceeds 155 chars', () => {
    const long = 'Used for two semesters, all pages intact, a few pencil marks in chapters three and four, comes with a free cover and the solutions manual.'
    const d = buildProductDescription({ ...base, description: long, sellerVerified: true, delivery_available: true })
    expect(d.length).toBeLessThanOrEqual(155)
    expect(d.endsWith('…') || d.endsWith('.')).toBe(true)
    const tail = d.split('Delivered to your door. ')[1] ?? ''
    if (tail) {
      const body = tail.replace(/…$/, '')
      expect(long.startsWith(body)).toBe(true)
      expect(/^[\s,;:.]/.test(long.slice(body.length)) || body.length === long.length).toBe(true) // a trailing comma may be dropped before the ellipsis
    }
  })
  it('stays within the limit for very long titles and drops optional sentences first', () => {
    const title = 'Complete set of first year engineering textbooks including physics chemistry mathematics and drawing'
    const d = buildProductDescription({ ...base, title, sellerVerified: true, delivery_available: true })
    expect(d.length).toBeLessThanOrEqual(155)
    expect(d.startsWith(title)).toBe(true)
    const huge = buildProductDescription({ ...base, title: 'word '.repeat(80) })
    expect(huge.length).toBeLessThanOrEqual(155)
    expect(huge.endsWith('…')).toBe(true)
  })
  it('skips seller text that only repeats what is already said', () => {
    expect(buildProductDescription({ ...base, description: 'Good condition' })).toBe('Laptop with charger — Good condition, Rs. 45,000 in Kathmandu.')
  })
  it('does not repeat the title as the seller text', () => {
    const d = buildProductDescription({ ...base, description: 'laptop with charger' })
    expect(d.match(/laptop with charger/gi)).toHaveLength(1)
  })
})

describe('productImageUrl', () => {
  it('prefers the primary photo and gives an absolute https URL with a ~1200px variant for Cloudinary', () => {
    const url = productImageUrl([
      { storage_path: 'https://res.cloudinary.com/x/image/upload/v1/a.jpg', is_primary: false },
      { storage_path: 'https://res.cloudinary.com/x/image/upload/v1/b.jpg', is_primary: true },
    ])
    expect(url).toBe('https://res.cloudinary.com/x/image/upload/f_auto,q_auto,c_limit,w_1200/v1/b.jpg')
  })
  it('falls back to the first photo, and to null when there is none or it is not absolute https', () => {
    expect(productImageUrl([{ storage_path: 'https://res.cloudinary.com/x/image/upload/v1/a.jpg' }])).toContain('/a.jpg')
    expect(productImageUrl([])).toBeNull()
    expect(productImageUrl(null)).toBeNull()
    expect(productImageUrl([{ storage_path: '' }])).toBeNull()
    expect(productImageUrl([{ storage_path: 'http://insecure.example/a.jpg' }])).toBeNull()
  })
})
