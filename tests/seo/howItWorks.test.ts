/** Unit tests for the /how-it-works copy (src/lib/howItWorks.ts) and the faqJsonLd builder (src/lib/jsonld.ts) */
import { faqJsonLd, serializeJsonLd } from '@/lib/jsonld'
import { COMMISSION_PCT, HOW_DESCRIPTION, HOW_FAQ, HOW_TITLE, joinNames } from '@/lib/howItWorks'
import { DELIVERY, PLATFORM_FEE, WITHDRAWAL } from '@/lib/pricing'
import { formatPrice } from '@/lib/utils'
import { META_DESCRIPTION_MAX } from '@/lib/landing'

describe('faqJsonLd', () => {
  it('builds a FAQPage with one Question/Answer per item, in order', () => {
    const ld = faqJsonLd([{ question: 'Q1?', answer: 'A1.' }, { question: 'Q2?', answer: 'A2.' }]) as any
    expect(ld['@context']).toBe('https://schema.org')
    expect(ld['@type']).toBe('FAQPage')
    expect(ld.mainEntity).toEqual([
      { '@type': 'Question', name: 'Q1?', acceptedAnswer: { '@type': 'Answer', text: 'A1.' } },
      { '@type': 'Question', name: 'Q2?', acceptedAnswer: { '@type': 'Answer', text: 'A2.' } },
    ])
  })

  it('drops items with a blank question or answer', () => {
    const ld = faqJsonLd([{ question: 'Q?', answer: '  ' }, { question: '', answer: 'A' }, { question: 'Ok?', answer: 'Yes.' }]) as any
    expect(ld.mainEntity).toHaveLength(1)
    expect(ld.mainEntity[0].name).toBe('Ok?')
  })

  it('escapes "<" so text can never close the script tag, and still round-trips', () => {
    const evil = '</script><script>alert(1)</script>'
    const out = serializeJsonLd(faqJsonLd([{ question: evil, answer: evil }]))
    expect(out).not.toContain('<')
    expect(JSON.parse(out).mainEntity[0].acceptedAnswer.text).toBe(evil)
  })
})

describe('HOW_FAQ', () => {
  it('has 6-8 questions, none empty', () => {
    expect(HOW_FAQ.length).toBeGreaterThanOrEqual(6)
    expect(HOW_FAQ.length).toBeLessThanOrEqual(8)
    for (const f of HOW_FAQ) {
      expect(f.question.trim().length).toBeGreaterThan(5)
      expect(f.answer.trim().length).toBeGreaterThan(20)
      expect(f.question.trim().endsWith('?')).toBe(true)
    }
  })

  it('has unique questions and short (1-3 sentence) answers', () => {
    expect(new Set(HOW_FAQ.map((f) => f.question)).size).toBe(HOW_FAQ.length)
    for (const f of HOW_FAQ) {
      // "Rs. 150" is not a sentence end
      const sentences = f.answer.replace(/\bRs\.\s/g, 'Rs ').split(/(?<=[.!?])\s+/).filter(Boolean)
      expect(sentences.length).toBeGreaterThanOrEqual(1)
      expect(sentences.length).toBeLessThanOrEqual(3)
    }
  })

  it('FAQPage JSON-LD is built from exactly the visible data: nothing dropped, nothing added, text unchanged', () => {
    const ld = faqJsonLd(HOW_FAQ) as any
    expect(ld.mainEntity).toHaveLength(HOW_FAQ.length)
    ld.mainEntity.forEach((q: any, i: number) => {
      expect(q.name).toBe(HOW_FAQ[i].question)
      expect(q.acceptedAnswer.text).toBe(HOW_FAQ[i].answer)
    })
  })

  it('reads its numbers from src/lib/pricing.ts', () => {
    const all = HOW_FAQ.map((f) => f.answer).join(' ')
    expect(all).toContain(COMMISSION_PCT)
    expect(all).toContain(formatPrice(PLATFORM_FEE))
    expect(all).toContain(formatPrice(DELIVERY.baseFee))
    expect(all).toContain(formatPrice(DELIVERY.perExtraKm))
    expect(all).toContain(formatPrice(WITHDRAWAL.minAmount))
    expect(all).toContain(WITHDRAWAL.processingText)
  })

  it('links only to sections that exist on /policies', () => {
    const ids = ['how-it-works', 'terms', 'verification', 'buying', 'delivery', 'payments', 'selling', 'payouts', 'refunds', 'prohibited', 'privacy', 'community']
    for (const f of HOW_FAQ) {
      if (!f.more) continue
      expect(f.more.label.length).toBeGreaterThan(0)
      expect(f.more.href.startsWith('/policies#')).toBe(true)
      expect(ids).toContain(f.more.href.split('#')[1])
    }
  })
})

describe('page metadata copy', () => {
  it('has a unique, non-empty title and a description within the length limit', () => {
    expect(HOW_TITLE.length).toBeGreaterThan(10)
    expect(HOW_DESCRIPTION.length).toBeGreaterThan(50)
    expect(HOW_DESCRIPTION.length).toBeLessThanOrEqual(META_DESCRIPTION_MAX)
  })
})

describe('joinNames', () => {
  it('joins with commas and "and"', () => {
    expect(joinNames(['Kathmandu'])).toBe('Kathmandu')
    expect(joinNames(['Kathmandu', 'Butwal'])).toBe('Kathmandu and Butwal')
    expect(joinNames(['A', 'B', 'C'])).toBe('A, B and C')
  })
})
