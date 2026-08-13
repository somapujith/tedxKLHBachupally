// Discount coupons for the pass price.
//
// A coupon subtracts a flat rupee amount from whatever the pass currently costs
// (see settings.js — the price moves on a schedule and a superadmin can
// override it). Percentages and fixed final prices are deliberately NOT
// supported: one discount shape means one arithmetic path, and the amount an
// admin has to match against a bank statement is always `price - discount`.
//
// Two rules govern everything here:
//
//   1. The server owns the arithmetic. The checkout screen previews a discount,
//      but that preview is never trusted — applyCoupon() is re-run inside the
//      payment submit and its result is what gets written to registrations.
//      Otherwise a crafted request buys a ₹599 pass for ₹1.
//   2. A coupon never makes a pass free. MIN_PAYABLE keeps every sale at ₹1 or
//      more, so there is always a real bank transfer with a UTR for an admin to
//      verify. Without it, a leaked code would mint passes that no human ever
//      checks.

import { getSql, withDbRetry, ensureCouponsTable, isUuid } from './db.js'
import { getPassPrice } from './settings.js'
import { recordAudit, AUDIT_ACTIONS } from './audit.js'

// The floor a discount can bring a pass down to. Not zero — see rule 2 above.
export const MIN_PAYABLE = 1

// Codes are short, typed by hand off a poster or a DM, and matched
// case-insensitively. Letters/digits only: spaces and punctuation invite
// invisible mismatches (a trailing space, a smart dash) that read to the buyer
// as "your code is wrong".
const CODE_PATTERN = /^[A-Z0-9]{3,24}$/
const MAX_DISCOUNT = 1000000

// Same lazy-DDL pattern as audit.js and settings.js: the public checkout path
// pays the CREATE TABLE once per cold start, memoized, and a failed attempt is
// not cached so the next request retries.
let couponsReady = null
function ensureCoupons(sql) {
  if (couponsReady) return couponsReady
  couponsReady = ensureCouponsTable(sql).catch((err) => {
    couponsReady = null
    throw err
  })
  return couponsReady
}

// Exported for tests, which need to clear the memo between cases.
export function resetCouponsSchemaCache() {
  couponsReady = null
}

// Normalize buyer input into the canonical stored form. Buyers paste codes with
// stray whitespace and mixed case constantly; both are the buyer being human,
// not the buyer being wrong.
export function normalizeCode(value) {
  return String(value ?? '').trim().toUpperCase()
}

/**
 * Compute what a buyer actually pays. Pure arithmetic, no I/O — so the price
 * rules are testable without a database and identical wherever they are applied.
 *
 * Clamps at MIN_PAYABLE rather than rejecting an over-large discount: a ₹500
 * coupon against a ₹449 pass is a superadmin setting a "nearly free" rate, not
 * an error, and it should not start failing the moment the scheduled price drops
 * below the discount.
 */
export function computeAmount(passPrice, discountAmount) {
  const price = Number(passPrice)
  const discount = Number(discountAmount)
  if (!Number.isFinite(price) || !Number.isFinite(discount)) return null
  const payable = Math.max(MIN_PAYABLE, Math.round(price) - Math.round(discount))
  // A discount can never exceed the price it was applied to, otherwise the
  // "you saved ₹X" line would overstate the saving on a clamped sale.
  return { amount: payable, discount: Math.round(price) - payable }
}

function validateCode(value) {
  const code = normalizeCode(value)
  if (!code) return { error: 'Enter a coupon code.' }
  if (!CODE_PATTERN.test(code)) {
    return { error: 'Code must be 3–24 letters or numbers, with no spaces.' }
  }
  return { code }
}

function validateDiscount(value) {
  // Reject '' / null / whitespace before Number(), which turns all three into 0
  // and would silently create a coupon that discounts nothing.
  if (value === null || value === undefined || String(value).trim() === '') {
    return { error: 'Enter a discount amount.' }
  }
  const n = Number(value)
  if (!Number.isFinite(n) || !Number.isInteger(n)) {
    return { error: 'Discount must be a whole number of rupees.' }
  }
  if (n < 1) return { error: 'Discount must be at least ₹1.' }
  if (n > MAX_DISCOUNT) return { error: 'Discount is too large.' }
  return { discount: n }
}

// Shared row shape. `times_used` is a COUNT over redemptions, never a stored
// counter — see the schema note in db.js.
const COUPON_COLUMNS = (sql) => sql`
  SELECT c.id, c.code, c.discount_amount, c.is_active,
         c.created_at, c.created_by, c.updated_at,
         (SELECT COUNT(*)::int FROM coupon_redemptions r WHERE r.coupon_id = c.id) AS times_used
  FROM coupons c
`

/**
 * Resolve a buyer-supplied code to a usable discount, or explain why not.
 *
 * Returns the payable amount as well as the discount, so the caller never has
 * to redo the arithmetic and the checkout preview and the payment write cannot
 * drift apart.
 */
export async function applyCoupon(code, { sql: injectedSql } = {}) {
  const checked = validateCode(code)
  if (checked.error) return { ok: false, status: 400, error: checked.error }

  const sql = injectedSql || getSql()
  await ensureCoupons(sql)

  const rows = await withDbRetry(() => sql`
    SELECT id, code, discount_amount, is_active
    FROM coupons
    WHERE UPPER(code) = ${checked.code}
    LIMIT 1
  `)
  const coupon = rows[0]

  // An inactive coupon and a nonexistent one get the SAME message. Telling the
  // buyer "this code exists but is switched off" confirms a valid code to
  // anyone probing for one, and there is nothing the buyer can do with the
  // distinction anyway.
  if (!coupon || coupon.is_active === false) {
    return { ok: false, status: 404, error: 'That coupon code is not valid.' }
  }

  const passPrice = await getPassPrice(sql)
  const computed = computeAmount(passPrice, coupon.discount_amount)
  if (!computed) {
    return { ok: false, status: 500, error: 'Could not apply that coupon.' }
  }

  return {
    ok: true,
    status: 200,
    coupon: {
      id: coupon.id,
      code: coupon.code,
      discount: computed.discount,
      passPrice,
      amount: computed.amount,
    },
  }
}

/**
 * Record that a registration used a coupon.
 *
 * Upserts on registration_id: a buyer whose proof was rejected can resubmit,
 * and that second submission must not count as a second redemption. Never
 * throws — a failed bookkeeping write must not fail a payment the buyer has
 * already made, so it is logged and swallowed like the audit trail.
 */
export async function recordRedemption({ couponId, registrationId, discountAmount, amountPaid }) {
  if (!couponId || !registrationId) return
  try {
    const sql = getSql()
    await ensureCoupons(sql)
    await withDbRetry(() => sql`
      INSERT INTO coupon_redemptions (coupon_id, registration_id, discount_amount, amount_paid)
      VALUES (${couponId}, ${registrationId}, ${discountAmount}, ${amountPaid})
      ON CONFLICT (registration_id) DO UPDATE
      SET coupon_id = EXCLUDED.coupon_id,
          discount_amount = EXCLUDED.discount_amount,
          amount_paid = EXCLUDED.amount_paid,
          created_at = NOW()
    `)
  } catch (err) {
    console.error('Coupon redemption not recorded (payment stands):', err?.message || err)
  }
}

// --- Superadmin management ---------------------------------------------------

export async function listCoupons() {
  const sql = getSql()
  await ensureCoupons(sql)
  const rows = await withDbRetry(() => sql`
    ${COUPON_COLUMNS(sql)}
    ORDER BY c.created_at DESC
  `)
  return { ok: true, status: 200, coupons: rows }
}

export async function createCoupon({ code, discountAmount, actor }) {
  const checkedCode = validateCode(code)
  if (checkedCode.error) return { ok: false, status: 400, error: checkedCode.error }
  const checkedDiscount = validateDiscount(discountAmount)
  if (checkedDiscount.error) return { ok: false, status: 400, error: checkedDiscount.error }

  const sql = getSql()
  await ensureCoupons(sql)

  try {
    const rows = await withDbRetry(() => sql`
      INSERT INTO coupons (code, discount_amount, created_by)
      VALUES (${checkedCode.code}, ${checkedDiscount.discount}, ${actor?.username || null})
      RETURNING id, code, discount_amount, is_active, created_at, created_by, updated_at
    `)
    const coupon = { ...rows[0], times_used: 0 }

    await recordAudit({
      action: AUDIT_ACTIONS.COUPON_CREATED,
      adminUsername: actor?.username,
      adminId: actor?.id,
      adminRole: actor?.role,
      targetType: 'coupon',
      targetId: coupon.id,
      targetName: coupon.code,
      detail: `Created coupon ${coupon.code} (−₹${coupon.discount_amount}).`,
    })

    return { ok: true, status: 201, coupon }
  } catch (err) {
    // 23505 on coupons_code_unique. Reported plainly because the superadmin can
    // act on it — they almost certainly meant to edit the existing coupon.
    if (String(err?.code) === '23505') {
      return { ok: false, status: 409, error: 'That coupon code already exists.' }
    }
    throw err
  }
}

/**
 * Update a coupon's discount and/or active state.
 *
 * The code itself is intentionally immutable. Renaming a live coupon would
 * silently re-point every past redemption to a code that was never used, which
 * is exactly the record an admin reconciling a bank statement relies on.
 */
export async function updateCoupon({ id, discountAmount, isActive, actor }) {
  if (!isUuid(id)) return { ok: false, status: 400, error: 'Invalid coupon id.' }

  const sql = getSql()
  await ensureCoupons(sql)

  const existing = await withDbRetry(() => sql`
    SELECT id, code, discount_amount, is_active FROM coupons WHERE id = ${id} LIMIT 1
  `)
  if (!existing.length) return { ok: false, status: 404, error: 'Coupon not found.' }
  const before = existing[0]

  let nextDiscount = before.discount_amount
  if (discountAmount !== undefined) {
    const checked = validateDiscount(discountAmount)
    if (checked.error) return { ok: false, status: 400, error: checked.error }
    nextDiscount = checked.discount
  }
  const nextActive = isActive === undefined ? before.is_active : Boolean(isActive)

  const rows = await withDbRetry(() => sql`
    UPDATE coupons
    SET discount_amount = ${nextDiscount},
        is_active = ${nextActive},
        updated_at = NOW()
    WHERE id = ${id}
    RETURNING id, code, discount_amount, is_active, created_at, created_by, updated_at
  `)

  const used = await withDbRetry(() => sql`
    SELECT COUNT(*)::int AS count FROM coupon_redemptions WHERE coupon_id = ${id}
  `)
  const coupon = { ...rows[0], times_used: used[0]?.count ?? 0 }

  const changes = []
  if (before.discount_amount !== coupon.discount_amount) {
    changes.push(`discount ₹${before.discount_amount} → ₹${coupon.discount_amount}`)
  }
  if (before.is_active !== coupon.is_active) {
    changes.push(coupon.is_active ? 'activated' : 'deactivated')
  }
  await recordAudit({
    action: AUDIT_ACTIONS.COUPON_UPDATED,
    adminUsername: actor?.username,
    adminId: actor?.id,
    adminRole: actor?.role,
    targetType: 'coupon',
    targetId: coupon.id,
    targetName: coupon.code,
    detail: `Updated coupon ${coupon.code}: ${changes.join(', ') || 'no change'}.`,
  })

  return { ok: true, status: 200, coupon }
}

/**
 * Delete a coupon.
 *
 * Refused once the coupon has been redeemed. The redemption rows would cascade
 * away with it, destroying the only record of why those buyers paid less than
 * the list price — deactivating is the reversible action that achieves the same
 * thing, and the error says so.
 */
export async function deleteCoupon({ id, actor }) {
  if (!isUuid(id)) return { ok: false, status: 400, error: 'Invalid coupon id.' }

  const sql = getSql()
  await ensureCoupons(sql)

  const existing = await withDbRetry(() => sql`
    SELECT c.id, c.code,
           (SELECT COUNT(*)::int FROM coupon_redemptions r WHERE r.coupon_id = c.id) AS times_used
    FROM coupons c WHERE c.id = ${id} LIMIT 1
  `)
  if (!existing.length) return { ok: false, status: 404, error: 'Coupon not found.' }
  const coupon = existing[0]

  if (coupon.times_used > 0) {
    return {
      ok: false,
      status: 409,
      error: `${coupon.code} has been used ${coupon.times_used} time(s) and cannot be deleted. Deactivate it instead.`,
    }
  }

  await withDbRetry(() => sql`DELETE FROM coupons WHERE id = ${id}`)

  await recordAudit({
    action: AUDIT_ACTIONS.COUPON_DELETED,
    adminUsername: actor?.username,
    adminId: actor?.id,
    adminRole: actor?.role,
    targetType: 'coupon',
    targetId: coupon.id,
    targetName: coupon.code,
    detail: `Deleted unused coupon ${coupon.code}.`,
  })

  return { ok: true, status: 200, deleted: true }
}
