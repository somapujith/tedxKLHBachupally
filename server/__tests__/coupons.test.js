// @vitest-environment node
// Coupon pricing rules and superadmin management.
//
// The pure-arithmetic tests (computeAmount, code/discount validation) run
// everywhere — they are where the money rules live and they must never depend
// on a database being reachable. The lifecycle tests run against the real Neon
// DB and skip when DATABASE_URL is absent, matching superadmin.test.js; they
// clean up their own tagged rows and never touch production coupons.
import 'dotenv/config'
import { describe, it, expect, afterAll } from 'vitest'
import { computeAmount, normalizeCode, MIN_PAYABLE } from '../coupons.js'
import {
  applyCoupon,
  createCoupon,
  updateCoupon,
  deleteCoupon,
  listCoupons,
  recordRedemption,
} from '../coupons.js'

const hasDb = Boolean(process.env.DATABASE_URL)
// Tagged so a failed run never leaves rows that a later run mistakes for real
// coupons. Uppercase + digits only, to satisfy the code format.
const TAG = 'ZZTEST'
const created = []

function tagged(suffix) {
  const code = `${TAG}${suffix}`
  created.push(code)
  return code
}

afterAll(async () => {
  if (!hasDb || created.length === 0) return
  const { getSql } = await import('../db.js')
  const sql = getSql()
  for (const code of created) {
    // Redemptions cascade with the coupon.
    await sql`DELETE FROM coupons WHERE UPPER(code) = ${code}`.catch(() => {})
  }
})

describe('computeAmount', () => {
  it('subtracts a flat discount from the pass price', () => {
    expect(computeAmount(599, 100)).toEqual({ amount: 499, discount: 100 })
  })

  it('never returns a free pass — clamps at the ₹1 floor', () => {
    // The guarantee that every sale leaves a bank transfer for an admin to
    // verify. A coupon worth more than the pass must not reach ₹0.
    expect(computeAmount(449, 449)).toEqual({ amount: MIN_PAYABLE, discount: 448 })
    expect(computeAmount(449, 10_000)).toEqual({ amount: MIN_PAYABLE, discount: 448 })
  })

  it('reports the discount actually given, not the coupon face value', () => {
    // A ₹500 coupon against a ₹449 pass saves ₹448, not ₹500 — otherwise the
    // "you save ₹X" line overstates a clamped sale.
    const result = computeAmount(449, 500)
    expect(result.amount).toBe(MIN_PAYABLE)
    expect(result.discount).toBe(448)
    expect(449 - result.discount).toBe(result.amount)
  })

  it('rejects non-numeric input rather than producing NaN', () => {
    expect(computeAmount('abc', 100)).toBeNull()
    expect(computeAmount(599, undefined)).toBeNull()
  })

  it('leaves the price untouched when the discount is zero', () => {
    expect(computeAmount(599, 0)).toEqual({ amount: 599, discount: 0 })
  })
})

describe('normalizeCode', () => {
  it('upper-cases and trims what a buyer types', () => {
    expect(normalizeCode('  save100 ')).toBe('SAVE100')
  })

  it('turns null and undefined into an empty string, not "null"', () => {
    expect(normalizeCode(null)).toBe('')
    expect(normalizeCode(undefined)).toBe('')
  })
})

describe('applyCoupon validation (no DB)', () => {
  it('rejects an empty code before touching the database', async () => {
    const res = await applyCoupon('')
    expect(res.ok).toBe(false)
    expect(res.status).toBe(400)
  })

  it('rejects codes with spaces or punctuation', async () => {
    for (const bad of ['SAVE 100', 'SAVE-100', 'ab', 'A'.repeat(25)]) {
      const res = await applyCoupon(bad)
      expect(res.ok).toBe(false)
      expect(res.status).toBe(400)
    }
  })
})

describe('createCoupon validation (no DB)', () => {
  it('rejects a blank discount instead of creating a ₹0 coupon', async () => {
    // Number('') is 0, so a blank field would otherwise silently create a
    // coupon that discounts nothing.
    for (const bad of ['', '   ', null, undefined]) {
      const res = await createCoupon({ code: 'VALIDCODE', discountAmount: bad })
      expect(res.ok).toBe(false)
      expect(res.status).toBe(400)
    }
  })

  it('rejects fractional and negative discounts', async () => {
    for (const bad of [10.5, -5, 0]) {
      const res = await createCoupon({ code: 'VALIDCODE', discountAmount: bad })
      expect(res.ok).toBe(false)
      expect(res.status).toBe(400)
    }
  })

  it('rejects a malformed code before the insert', async () => {
    const res = await createCoupon({ code: 'no spaces allowed', discountAmount: 100 })
    expect(res.ok).toBe(false)
    expect(res.status).toBe(400)
  })
})

describe('updateCoupon / deleteCoupon id validation (no DB)', () => {
  it('rejects a non-uuid id rather than letting Postgres throw', async () => {
    expect((await updateCoupon({ id: 'not-a-uuid', isActive: false })).status).toBe(400)
    expect((await deleteCoupon({ id: 'not-a-uuid' })).status).toBe(400)
  })
})

describe.skipIf(!hasDb)('coupon lifecycle (real DB)', () => {
  it('creates, applies, and counts a redemption once per registration', async () => {
    const { getSql } = await import('../db.js')
    const sql = getSql()
    const code = tagged('A')

    const made = await createCoupon({
      code,
      discountAmount: 100,
      actor: { username: 'test', role: 'superadmin' },
    })
    expect(made.ok).toBe(true)
    expect(made.coupon.times_used).toBe(0)
    expect(made.coupon.is_active).toBe(true)

    // Case-insensitive lookup: buyers type codes in lowercase constantly.
    const applied = await applyCoupon(code.toLowerCase())
    expect(applied.ok).toBe(true)
    expect(applied.coupon.discount).toBe(100)
    expect(applied.coupon.amount).toBe(applied.coupon.passPrice - 100)

    // Two redemptions for the SAME registration must count once — a buyer whose
    // proof was rejected can resubmit, and that is not a second use.
    const regId = crypto.randomUUID()
    await recordRedemption({
      couponId: made.coupon.id,
      registrationId: regId,
      discountAmount: 100,
      amountPaid: 499,
    })
    await recordRedemption({
      couponId: made.coupon.id,
      registrationId: regId,
      discountAmount: 100,
      amountPaid: 499,
    })

    const rows = await sql`
      SELECT COUNT(*)::int AS count FROM coupon_redemptions WHERE coupon_id = ${made.coupon.id}
    `
    expect(rows[0].count).toBe(1)

    const listed = await listCoupons()
    const found = listed.coupons.find((c) => c.code === code)
    expect(found.times_used).toBe(1)
  })

  it('refuses duplicate codes regardless of case', async () => {
    const code = tagged('B')
    expect((await createCoupon({ code, discountAmount: 50 })).ok).toBe(true)
    const dup = await createCoupon({ code: code.toLowerCase(), discountAmount: 50 })
    expect(dup.ok).toBe(false)
    expect(dup.status).toBe(409)
  })

  it('treats a deactivated coupon exactly like a nonexistent one', async () => {
    const code = tagged('C')
    const made = await createCoupon({ code, discountAmount: 50 })
    await updateCoupon({ id: made.coupon.id, isActive: false })

    const applied = await applyCoupon(code)
    expect(applied.ok).toBe(false)
    expect(applied.status).toBe(404)
    // Same message as an unknown code — telling a prober "this exists but is
    // off" confirms a valid code.
    const unknown = await applyCoupon('ZZTESTNOSUCHCODE')
    expect(applied.error).toBe(unknown.error)
  })

  it('refuses to delete a redeemed coupon so the discount record survives', async () => {
    const code = tagged('D')
    const made = await createCoupon({ code, discountAmount: 75 })
    await recordRedemption({
      couponId: made.coupon.id,
      registrationId: crypto.randomUUID(),
      discountAmount: 75,
      amountPaid: 374,
    })

    const del = await deleteCoupon({ id: made.coupon.id })
    expect(del.ok).toBe(false)
    expect(del.status).toBe(409)
    expect(del.error).toMatch(/deactivate/i)
  })

  it('deletes an unused coupon', async () => {
    const code = tagged('E')
    const made = await createCoupon({ code, discountAmount: 25 })
    const del = await deleteCoupon({ id: made.coupon.id })
    expect(del.ok).toBe(true)
    expect((await applyCoupon(code)).ok).toBe(false)
  })
})
