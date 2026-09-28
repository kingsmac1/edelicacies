import { describe, expect, it } from 'vitest'
import { calculateDispatchFee, distanceFromShopKm } from './delivery'

// Default bands and step pricing, matching supabase/schema.sql's seed data.
const bands = [
  { min_km: 0, max_km: 2, price: 1500 },
  { min_km: 2, max_km: 5, price: 2000 },
  { min_km: 5, max_km: 8, price: 2500 },
  { min_km: 8, max_km: 11, price: 3000 },
]
const step = { step_km: 3, step_price: 500 }
const maxKm = 20

describe('dispatch fee reference points', () => {
  const cases: [lat: number, lng: number, expected: number][] = [
    [5.025387, 7.941313, 1500],
    [5.019989, 7.937464, 1500],
    [5.007848, 7.939459, 2000],
    [4.982083, 7.971001, 2500],
    [5.006485, 7.856148, 3000],
  ]

  for (const [lat, lng, expected] of cases) {
    it(`(${lat}, ${lng}) prices at ₦${expected}`, () => {
      const distanceKm = distanceFromShopKm(lat, lng)
      const quote = calculateDispatchFee(distanceKm, bands, step, maxKm)
      expect(quote.available).toBe(true)
      expect(quote.fee).toBe(expected)
    })
  }
})

describe('calculateDispatchFee', () => {
  it('steps up beyond the last band in multiples of 500', () => {
    expect(calculateDispatchFee(11, bands, step, maxKm).fee).toBe(3000)
    expect(calculateDispatchFee(12, bands, step, maxKm).fee).toBe(3500)
    expect(calculateDispatchFee(14, bands, step, maxKm).fee).toBe(3500)
    expect(calculateDispatchFee(14.01, bands, step, maxKm).fee).toBe(4000)
  })

  it('is unavailable beyond the maximum delivery distance', () => {
    const quote = calculateDispatchFee(21, bands, step, maxKm)
    expect(quote.available).toBe(false)
    expect(quote.fee).toBeNull()
  })
})
