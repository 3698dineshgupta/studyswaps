/** Unit tests for the pure JSON-LD builders in src/lib/jsonld.ts */
import { SITE_URL } from '@/lib/constants'
import {
  browseBreadcrumbJsonLd, itemCondition, organizationJsonLd, productBreadcrumbJsonLd, productImageUrls, productJsonLd, serializeJsonLd, websiteJsonLd,
} from '@/lib/jsonld'
import { SITE_DESCRIPTION } from '@/lib/seo'

const ID = '11111111-2222-3333-4444-555555555555'
const base = {
  id: ID,
  title: 'Physics textbook',
  description: 'Barely used.',
  price: 1500,
  condition: 'GOOD',
  quantity: 1,
  status: 'ACTIVE',
  brand: '',
  images: [{ storage_path: 'https://res.cloudinary.com/demo/image/upload/v1/a.jpg', is_primary: true }, { storage_path: 'https://example.com/b.jpg' }],
  category: { name: 'Books & Notes', slug: 'books' },
}
const offer = (p: Partial<typeof base> = {}) => (productJsonLd({ ...base, ...p }, 'fallback') as any).offers

describe('serializeJsonLd', () => {
  it('never lets user text break out of the script tag', () => {
    const evil = '</script><script>alert(1)</script>'
    const out = serializeJsonLd(productJsonLd({ ...base, title: evil, description: evil, brand: evil }, 'x'))
    expect(out).not.toContain('</script>')
    expect(out).not.toContain('<script>')
    expect(out).not.toContain('<')
    // ...and it still parses back to the original text
    expect(JSON.parse(out).name).toBe(evil)
  })
})

describe('productJsonLd', () => {
  it('is a Product with an InStock NPR offer and plain-number price', () => {
    const ld = productJsonLd(base, 'fallback') as any
    expect(ld['@type']).toBe('Product')
    expect(ld.sku).toBe(ID)
    expect(ld.url).toBe(`${SITE_URL}/product/${ID}`)
    expect(ld.category).toBe('Books & Notes')
    expect(ld.description).toBe('Barely used.')
    expect(ld.offers).toMatchObject({ '@type': 'Offer', priceCurrency: 'NPR', price: '1500', availability: 'https://schema.org/InStock', itemCondition: 'https://schema.org/UsedCondition' })
  })
  it('SoldOut when quantity is 0 or the status is SOLD (or anything not ACTIVE)', () => {
    expect(offer({ quantity: 0 }).availability).toBe('https://schema.org/SoldOut')
    expect(offer({ status: 'SOLD' }).availability).toBe('https://schema.org/SoldOut')
    expect(offer({ status: 'PENDING' }).availability).toBe('https://schema.org/SoldOut')
    expect(offer({ quantity: 3 }).availability).toBe('https://schema.org/InStock')
  })
  it('formats the price with no thousands separators and accepts numeric strings', () => {
    expect(offer({ price: 1234567 }).price).toBe('1234567')
    expect(offer({ price: '2500.50' as any }).price).toBe('2500.5')
    expect(offer({ price: 0 }).price).toBe('0')
  })
  it('leaves the offer out when the price is not a number', () => {
    expect((productJsonLd({ ...base, price: 'abc' as any }, 'f') as any).offers).toBeUndefined()
  })
  it('maps NEW to NewCondition and every other condition to UsedCondition', () => {
    expect(itemCondition('NEW')).toBe('https://schema.org/NewCondition')
    for (const c of ['LIKE_NEW', 'GOOD', 'FAIR', 'POOR', null, undefined, 'WEIRD']) expect(itemCondition(c as any)).toBe('https://schema.org/UsedCondition')
  })
  it('includes a brand only when it is non-empty', () => {
    expect((productJsonLd({ ...base, brand: '' }, 'f') as any).brand).toBeUndefined()
    expect((productJsonLd({ ...base, brand: '   ' }, 'f') as any).brand).toBeUndefined()
    expect((productJsonLd({ ...base, brand: null }, 'f') as any).brand).toBeUndefined()
    expect((productJsonLd({ ...base, brand: 'Casio' }, 'f') as any).brand).toEqual({ '@type': 'Brand', name: 'Casio' })
  })
  it('uses the fallback description when the seller wrote none', () => {
    expect((productJsonLd({ ...base, description: '  ' }, 'meta text') as any).description).toBe('meta text')
  })
  it('contains no seller, rating or review data even if the row carries it', () => {
    const row = { ...base, seller: { full_name: 'Ram Sharma', seller_rating: 4.9 }, profiles: { full_name: 'Ram Sharma' }, seller_id: 'sid', seller_rating: 4.9 }
    const out = serializeJsonLd(productJsonLd(row as any, 'f')) + serializeJsonLd(productBreadcrumbJsonLd(row as any))
    expect(out).not.toContain('Ram Sharma')
    expect(out).not.toMatch(/seller|aggregateRating|review|"author"/i)
  })
  it('lists absolute https image URLs only, without duplicates', () => {
    const ld = productJsonLd({ ...base, images: [...base.images, { storage_path: base.images[0].storage_path }, { storage_path: 'http://insecure.example.com/c.jpg' }, { storage_path: '' }] }, 'f') as any
    expect(ld.image).toEqual([
      'https://res.cloudinary.com/demo/image/upload/f_auto,q_auto,c_limit,w_1200/v1/a.jpg',
      'https://example.com/b.jpg',
    ])
    for (const u of ld.image) expect(u).toMatch(/^https:\/\//)
    expect(productImageUrls([{ storage_path: '' }])).toEqual([])
  })
  it('omits image when there are no usable photos', () => {
    expect((productJsonLd({ ...base, images: [] }, 'f') as any).image).toBeUndefined()
    expect((productJsonLd({ ...base, images: null }, 'f') as any).image).toBeUndefined()
  })
})

describe('breadcrumbs', () => {
  it('product: Home > Browse > Category > Title with absolute URLs and positions', () => {
    const b = productBreadcrumbJsonLd(base) as any
    expect(b['@type']).toBe('BreadcrumbList')
    expect(b.itemListElement.map((i: any) => [i.position, i.name, i.item])).toEqual([
      [1, 'Home', `${SITE_URL}/`],
      [2, 'Browse', `${SITE_URL}/browse`],
      [3, 'Books & Notes', `${SITE_URL}/browse?category=books`],
      [4, 'Physics textbook', `${SITE_URL}/product/${ID}`],
    ])
  })
  it('product without a category skips that step', () => {
    const b = productBreadcrumbJsonLd({ ...base, category: null }) as any
    expect(b.itemListElement.map((i: any) => i.name)).toEqual(['Home', 'Browse', 'Physics textbook'])
  })
  it('browse: category step only for a valid slug', () => {
    const names = (slug?: string) => (browseBreadcrumbJsonLd(slug) as any).itemListElement.map((i: any) => i.name)
    expect(names()).toEqual(['Home', 'Browse'])
    expect(names('nope')).toEqual(['Home', 'Browse'])
    expect(names('books')).toEqual(['Home', 'Browse', 'Books & Notes'])
  })
})

describe('home page data', () => {
  it('Organization has only real, non-contact facts', () => {
    const o = organizationJsonLd() as any
    expect(o).toMatchObject({ '@type': 'Organization', name: 'StudySwaps', url: SITE_URL, description: SITE_DESCRIPTION })
    expect(o.logo).toBe(`${SITE_URL}/brand/icon-512.png`)
    expect(o.areaServed.map((a: any) => a.name)).toEqual(['Nepal', 'Kathmandu', 'Butwal'])
    for (const k of ['telephone', 'email', 'sameAs', 'aggregateRating', 'review', 'contactPoint']) expect(o[k]).toBeUndefined()
  })
  it('WebSite has no SearchAction', () => {
    const w = websiteJsonLd() as any
    expect(w).toEqual({ '@context': 'https://schema.org', '@type': 'WebSite', name: 'StudySwaps', url: SITE_URL })
  })
})
