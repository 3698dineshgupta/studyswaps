import { checkOfferAmount, round2, MIN_OFFER_FRACTION } from '../../src/lib/offers'

describe('checkOfferAmount', () => {
  const price = 1000

  it('accepts a reasonable offer below the asking price', () => {
    expect(checkOfferAmount(700, price)).toBeNull()
  })

  it('accepts an offer exactly at the asking price (the edge of "not more than")', () => {
    expect(checkOfferAmount(1000, price)).toBeNull()
  })

  it('rejects an offer above the asking price', () => {
    expect(checkOfferAmount(1001, price)).toBe('TOO_HIGH')
  })

  it('rejects a throwaway offer below the minimum fraction', () => {
    expect(checkOfferAmount(Math.ceil(price * MIN_OFFER_FRACTION) - 1, price)).toBe('TOO_LOW')
  })

  it('accepts an offer right at the minimum fraction', () => {
    expect(checkOfferAmount(Math.ceil(price * MIN_OFFER_FRACTION), price)).toBeNull()
  })

  it('works for small and large prices alike', () => {
    expect(checkOfferAmount(1, 5)).toBeNull() // 20% of a Rs 5 item — above the 10% floor once rounded
    expect(checkOfferAmount(500_000, 1_000_000)).toBeNull()
    expect(checkOfferAmount(1_000_001, 1_000_000)).toBe('TOO_HIGH')
  })
})

describe('round2', () => {
  it('rounds to 2 decimal places', () => {
    expect(round2(10.005)).toBeCloseTo(10.01, 2)
    expect(round2(10.004)).toBeCloseTo(10, 2)
    expect(round2(99.999)).toBeCloseTo(100, 2)
  })
})
