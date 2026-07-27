// @vitest-environment node
// Integration tests against the real Neon database + real Razorpay test API.
// Requires DATABASE_URL and RAZORPAY_* in .env. Cleans up its own rows.
import 'dotenv/config'
import crypto from 'node:crypto'
import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { getSql, ensureRegistrationsTable } from '../db.js'
import { createRegistration } from '../registrations.js'
import {
  createOrder,
  verifyPayment,
  handleWebhook,
  seatCapacity,
  REGISTRATION_AMOUNT,
  CURRENCY,
} from '../payments.js'

const sql = getSql()
const TAG = 'e2e_test_'
const email = (n) => `${TAG}${n}@example.com`
const validReg = (n, extra = {}) => ({
  fullName: 'E2E Tester',
  phone: '9876500000',
  email: email(n),
  designation: 'guest',
  ...extra,
})

beforeAll(async () => {
  await ensureRegistrationsTable(sql)
  await sql`DELETE FROM registrations WHERE email LIKE ${TAG + '%'}`
})

afterAll(async () => {
  await sql`DELETE FROM registrations WHERE email LIKE ${TAG + '%'}`
})

describe('createRegistration (real DB)', () => {
  it('inserts a new pending registration', async () => {
    const res = await createRegistration(validReg('new'))
    expect(res.ok).toBe(true)
    expect(res.status).toBe(201)
    expect(res.registration.payment_status).toBe('pending')
    expect(res.registration.id).toBeTruthy()
  })

  it('rejects invalid input with 400 and does not insert', async () => {
    const res = await createRegistration({ ...validReg('bad'), email: 'not-an-email' })
    expect(res.ok).toBe(false)
    expect(res.status).toBe(400)
    const rows = await sql`SELECT 1 FROM registrations WHERE email = ${email('bad')}`
    expect(rows.length).toBe(0)
  })

  it('resumes a pending registration on the same email (same row, 200)', async () => {
    const first = await createRegistration(validReg('resume'))
    const second = await createRegistration(
      validReg('resume', { fullName: 'Edited Name', designation: 'student', college: 'KL GBS Campus' }),
    )
    expect(second.ok).toBe(true)
    expect(second.status).toBe(200)
    expect(second.registration.id).toBe(first.registration.id)
    expect(second.resumed).toBe(true)
    // Updated fields persisted on the same row.
    const rows = await sql`SELECT full_name, designation FROM registrations WHERE id = ${first.registration.id}`
    expect(rows[0].full_name).toBe('Edited Name')
    expect(rows[0].designation).toBe('student')
  })

  it('blocks re-registration once a row is marked paid (409)', async () => {
    const first = await createRegistration(validReg('paid'))
    await sql`UPDATE registrations SET payment_status = 'paid' WHERE id = ${first.registration.id}`
    const again = await createRegistration(validReg('paid'))
    expect(again.ok).toBe(false)
    expect(again.status).toBe(409)
  })
})

describe('createOrder (real Razorpay test API)', () => {
  it('returns 400 with no registration id', async () => {
    const res = await createOrder({ registrationId: null })
    expect(res.ok).toBe(false)
    expect(res.status).toBe(400)
  })

  it('returns 404 for an unknown registration', async () => {
    const res = await createOrder({ registrationId: '00000000-0000-0000-0000-000000000000' })
    expect(res.ok).toBe(false)
    expect(res.status).toBe(404)
  })

  // The 404 case above passes a well-formed uuid, so it never reached the driver
  // with bad input. `id` is a uuid column: a malformed value makes Postgres throw
  // (22P02) instead of matching no rows, which the route turned into a 500.
  it.each([
    ['a non-uuid string', 'not-a-uuid'],
    ['a numeric id', 999999999],
    ['a sql-ish payload', "' OR 1=1 --"],
  ])('rejects %s with 400, not a thrown 500', async (_label, id) => {
    const res = await createOrder({ registrationId: id })
    expect(res.ok).toBe(false)
    expect(res.status).toBe(400)
  })

  it('creates a Razorpay order and binds it to the registration', async () => {
    const reg = await createRegistration(validReg('order'))
    const res = await createOrder({ registrationId: reg.registration.id })
    expect(res.ok).toBe(true)
    expect(res.order.id).toMatch(/^order_/)
    expect(res.order.amount).toBe(REGISTRATION_AMOUNT)
    expect(res.order.currency).toBe(CURRENCY)
    expect(res.keyId).toBe(process.env.RAZORPAY_KEY_ID)
    const rows = await sql`SELECT razorpay_order_id, amount FROM registrations WHERE id = ${reg.registration.id}`
    expect(rows[0].razorpay_order_id).toBe(res.order.id)
    expect(rows[0].amount).toBe(REGISTRATION_AMOUNT)
  })

  it('refuses to create an order for an already-paid registration (409)', async () => {
    const reg = await createRegistration(validReg('orderpaid'))
    await sql`UPDATE registrations SET payment_status = 'paid' WHERE id = ${reg.registration.id}`
    const res = await createOrder({ registrationId: reg.registration.id })
    expect(res.ok).toBe(false)
    expect(res.status).toBe(409)
  })
})

describe('verifyPayment — signature gate', () => {
  it('rejects missing fields (400)', async () => {
    const res = await verifyPayment({})
    expect(res.ok).toBe(false)
    expect(res.status).toBe(400)
  })

  it('rejects a wrong signature (400)', async () => {
    const res = await verifyPayment({
      razorpay_order_id: 'order_x',
      razorpay_payment_id: 'pay_x',
      razorpay_signature: 'deadbeef',
    })
    expect(res.ok).toBe(false)
    expect(res.status).toBe(400)
    expect(res.error).toMatch(/signature/i)
  })

  it('passes the signature gate but fails settlement for a non-existent payment (502)', async () => {
    // Signature is authentic, but payments.fetch() cannot find pay_FAKE -> settle fails.
    const orderId = 'order_FAKE123'
    const paymentId = 'pay_FAKE123'
    const signature = crypto
      .createHmac('sha256', process.env.RAZORPAY_KEY_SECRET)
      .update(`${orderId}|${paymentId}`)
      .digest('hex')
    const res = await verifyPayment({
      razorpay_order_id: orderId,
      razorpay_payment_id: paymentId,
      razorpay_signature: signature,
    })
    expect(res.ok).toBe(false)
    // Signature was valid (not a 400 signature error); settlement fetch failed.
    expect(res.status).toBe(502)
  })
})

describe('seatCapacity — env parsing', () => {
  const ORIGINAL = process.env.SEAT_CAPACITY
  afterAll(() => {
    if (ORIGINAL === undefined) delete process.env.SEAT_CAPACITY
    else process.env.SEAT_CAPACITY = ORIGINAL
  })

  it('honors an explicit 0 (event closed) instead of defaulting to 250', () => {
    process.env.SEAT_CAPACITY = '0'
    expect(seatCapacity()).toBe(0)
  })

  it('falls back to 250 for a non-numeric value', () => {
    process.env.SEAT_CAPACITY = 'not-a-number'
    expect(seatCapacity()).toBe(250)
  })

  it('reads a valid positive value', () => {
    process.env.SEAT_CAPACITY = '42'
    expect(seatCapacity()).toBe(42)
  })
})

// The hard capacity gate lives inside settlePayment's paid-flip UPDATE (an atomic
// `... AND (SELECT COUNT(*) ... WHERE payment_status='paid') < capacity`).
// settlePayment is internal, so we exercise the exact guarded SQL against the DB
// with the capacity clamped to the current paid count: the flip must match no row
// (payment NOT ticketed), which is the anti-oversell property.
describe('settlePayment capacity guard — over-capacity paid payment is not flipped', () => {
  const TAG = 'e2e_cap_test_'
  let capSql

  beforeAll(async () => {
    capSql = getSql()
    await capSql`DELETE FROM registrations WHERE email LIKE ${TAG + '%'}`
  })

  afterAll(async () => {
    await capSql`DELETE FROM registrations WHERE email LIKE ${TAG + '%'}`
  })

  it('the guarded paid-flip returns no row when paid count is already >= capacity', async () => {
    // Insert one pending row with a bound order id.
    const orderId = `order_cap_${crypto.randomUUID()}`
    const ins = await capSql`
      INSERT INTO registrations (full_name, phone, email, designation, payment_status, razorpay_order_id, amount)
      VALUES ('Cap Tester', '9876500000', ${email('pending')}, 'guest', 'pending', ${orderId}, ${REGISTRATION_AMOUNT})
      RETURNING id
    `
    expect(ins.length).toBe(1)

    // Clamp capacity to the current paid count so the guard is already at its limit.
    const paid = await capSql`SELECT COUNT(*)::int AS count FROM registrations WHERE payment_status = 'paid'`
    const capacity = paid[0].count

    const flipped = await capSql`
      UPDATE registrations
      SET payment_status = 'paid', paid_at = COALESCE(paid_at, NOW())
      WHERE razorpay_order_id = ${orderId}
        AND payment_status <> 'paid'
        AND (SELECT COUNT(*) FROM registrations WHERE payment_status = 'paid') < ${capacity}
      RETURNING id
    `
    expect(flipped.length).toBe(0)

    // The row is still pending — no ticket would be issued for it.
    const after = await capSql`SELECT payment_status FROM registrations WHERE id = ${ins[0].id}`
    expect(after[0].payment_status).toBe('pending')
  })

  it('the same flip succeeds once capacity has headroom', async () => {
    const orderId = `order_cap_${crypto.randomUUID()}`
    await capSql`
      INSERT INTO registrations (full_name, phone, email, designation, payment_status, razorpay_order_id, amount)
      VALUES ('Cap Tester', '9876500000', ${email('room')}, 'guest', 'pending', ${orderId}, ${REGISTRATION_AMOUNT})
    `
    // Capacity comfortably above current paid count.
    const paid = await capSql`SELECT COUNT(*)::int AS count FROM registrations WHERE payment_status = 'paid'`
    const capacity = paid[0].count + 1000

    const flipped = await capSql`
      UPDATE registrations
      SET payment_status = 'paid', paid_at = COALESCE(paid_at, NOW())
      WHERE razorpay_order_id = ${orderId}
        AND payment_status <> 'paid'
        AND (SELECT COUNT(*) FROM registrations WHERE payment_status = 'paid') < ${capacity}
      RETURNING id
    `
    expect(flipped.length).toBe(1)
  })
})

describe('handleWebhook — HMAC + body guards', () => {
  const secret = () => process.env.RAZORPAY_WEBHOOK_SECRET

  it('rejects an empty body (400, not 500)', async () => {
    const res = await handleWebhook(Buffer.from(''), 'anything')
    expect(res.ok).toBe(false)
    expect(res.status).toBe(400)
  })

  it('rejects a non-buffer body (400)', async () => {
    const res = await handleWebhook(undefined, 'anything')
    expect(res.ok).toBe(false)
    expect(res.status).toBe(400)
  })

  it('rejects a bad signature (400)', async () => {
    const body = Buffer.from(JSON.stringify({ event: 'payment.captured' }))
    const res = await handleWebhook(body, 'wrong-signature')
    expect(res.ok).toBe(false)
    expect(res.status).toBe(400)
  })

  it('accepts a valid signature and acks non-actionable events (200)', async () => {
    const body = Buffer.from(JSON.stringify({ event: 'payment.authorized', payload: {} }))
    const sig = crypto.createHmac('sha256', secret()).update(body).digest('hex')
    const res = await handleWebhook(body, sig)
    expect(res.ok).toBe(true)
    expect(res.status).toBe(200)
  })

  it('acks a payment.captured event with a valid signature even when the order is unknown (200)', async () => {
    // Valid HMAC; settlement is skipped/ignored for an unknown order — must still 200
    // so Razorpay does not retry forever.
    const body = Buffer.from(
      JSON.stringify({
        event: 'payment.captured',
        payload: { payment: { entity: { id: 'pay_unknown', order_id: 'order_unknown' } } },
      }),
    )
    const sig = crypto.createHmac('sha256', secret()).update(body).digest('hex')
    const res = await handleWebhook(body, sig)
    expect(res.ok).toBe(true)
    expect(res.status).toBe(200)
  })
})
