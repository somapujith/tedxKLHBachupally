// @vitest-environment node
// The pass price rises to ₹599 at midnight on 13 Aug 2026. Getting the boundary
// wrong charges the wrong amount for real money, and "off by one hour" is
// exactly the mistake a timezone makes for you — every case below is pinned to
// an explicit +05:30 instant.
import { describe, it, expect } from 'vitest'
import { scheduledPassPrice } from '../settings.js'

const at = (iso) => new Date(iso)

describe('scheduledPassPrice', () => {
  it('charges ₹449 before the cutover', () => {
    expect(scheduledPassPrice(at('2026-08-12T18:57:00+05:30'))).toBe(449)
    expect(scheduledPassPrice(at('2026-08-12T23:59:59+05:30'))).toBe(449)
  })

  it('charges ₹599 from midnight onward', () => {
    expect(scheduledPassPrice(at('2026-08-13T00:00:00+05:30'))).toBe(599)
    expect(scheduledPassPrice(at('2026-08-13T00:00:01+05:30'))).toBe(599)
    expect(scheduledPassPrice(at('2026-08-22T09:30:00+05:30'))).toBe(599)
  })

  // A UTC-thinking implementation flips 5.5 hours early, at 18:30 IST on the
  // 12th, and would overcharge every buyer that evening.
  it('flips on IST midnight, not UTC midnight', () => {
    expect(scheduledPassPrice(at('2026-08-12T18:30:00+05:30'))).toBe(449)
    expect(scheduledPassPrice(at('2026-08-12T19:00:00+05:30'))).toBe(449)
  })

  it('falls back to the opening rate for an instant before every entry', () => {
    expect(scheduledPassPrice(at('2020-01-01T00:00:00+05:30'))).toBe(449)
  })

  it('is stable — two calls at the same instant agree', () => {
    const t = at('2026-08-13T00:00:00+05:30')
    expect(scheduledPassPrice(t)).toBe(scheduledPassPrice(t))
  })
})
