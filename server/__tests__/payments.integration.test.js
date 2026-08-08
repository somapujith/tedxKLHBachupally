// @vitest-environment node
// Integration tests against the real Neon database. Manual bank-transfer flow.
// Requires DATABASE_URL in .env. Cleans up its own rows.
import 'dotenv/config'
// This flow's `approvePayment` sends a real booking-confirmation email as a
// side effect. Unlike server/__tests__/email.test.js — which mocks the
// `resend` module itself and needs a real-looking key to exercise that mock —
// this suite exercises the real payment/registration logic against the real
// DB and has no reason to also hit the real Resend API with fake
// `@example.com` addresses. Deleting the key here routes every send through
// email.js's own "no API key -> skip" path instead of a real, doomed-to-fail
// network call that only pollutes the production email_log table.
delete process.env.RESEND_API_KEY
import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { getSql, ensureRegistrationsTable } from '../db.js'
import { createRegistration } from '../registrations.js'
import {
  submitPaymentProof,
  listPendingVerifications,
  getPaymentProof,
  approvePayment,
  rejectPayment,
  seatCapacity,
  UTR_EXAMPLE,
} from '../payments.js'

// A 1x1 PNG, small enough to keep the tests fast but a genuinely valid data URL
// — the submit path parses and mime-checks it exactly as a real screenshot.
const PNG_1PX =
  'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg=='

// UTRs are globally unique in the DB, so every test needs its own.
let utrSeq = 0
const nextUtr = () => String(Date.now()).slice(-6) + String(utrSeq++).padStart(6, '0')

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

  // A paid email is not spent. One inbox buys several passes (family, a team),
  // and each purchase must become its own row so it gets its own payment and
  // its own QR pass rather than overwriting the seat already bought.
  it('allows the same email to register again after it has paid (new row, 201)', async () => {
    const first = await createRegistration(validReg('paid'))
    await sql`UPDATE registrations SET payment_status = 'paid' WHERE id = ${first.registration.id}`

    const again = await createRegistration(validReg('paid'))
    expect(again.ok).toBe(true)
    expect(again.status).toBe(201)
    expect(again.resumed).toBeUndefined()
    expect(again.registration.id).not.toBe(first.registration.id)
    expect(again.registration.payment_status).toBe('pending')

    // The paid row is untouched — the second registration is additive.
    const [paidRow] = await sql`
      SELECT payment_status FROM registrations WHERE id = ${first.registration.id}
    `
    expect(paidRow.payment_status).toBe('paid')
    const rows = await sql`SELECT id FROM registrations WHERE LOWER(email) = ${email('paid')}`
    expect(rows.length).toBe(2)
  })

  // The resume path must pick the PENDING row, never the paid one: capturing
  // the paid row would either overwrite a bought seat or match zero rows on the
  // guarded UPDATE and hand back an undefined registration.
  it('resumes the pending row, not the paid one, when both exist for an email', async () => {
    const paid = await createRegistration(validReg('mixed'))
    await sql`UPDATE registrations SET payment_status = 'paid' WHERE id = ${paid.registration.id}`
    const pending = await createRegistration(validReg('mixed'))
    expect(pending.status).toBe(201)

    const third = await createRegistration(validReg('mixed', { fullName: 'Third Attempt' }))
    expect(third.status).toBe(200)
    expect(third.resumed).toBe(true)
    expect(third.registration.id).toBe(pending.registration.id)
    expect(third.registration.id).not.toBe(paid.registration.id)
  })

  // A row awaiting an admin is a seat in flight, not an abandoned checkout.
  // Resuming it overwrote the details of a submission already under review and
  // handed back a row that submitPaymentProof then refuses ("already awaiting
  // verification") — so the buyer could never pay for the second seat at all.
  it('does not resume a submitted registration — it starts a new seat', async () => {
    const first = await createRegistration(validReg('resubmit'))
    const utrId = nextUtr()
    const submitted = await submitPaymentProof({
      registrationId: first.registration.id,
      utrId,
      proof: PNG_1PX,
    })
    expect(submitted.ok).toBe(true)

    const second = await createRegistration(validReg('resubmit', { fullName: 'Second Seat' }))
    expect(second.status).toBe(201)
    expect(second.resumed).toBeUndefined()
    expect(second.registration.id).not.toBe(first.registration.id)

    // The submission under review keeps its own proof and its own details.
    const [original] = await sql`
      SELECT full_name, utr_id, payment_status FROM registrations WHERE id = ${first.registration.id}
    `
    expect(original.payment_status).toBe('submitted')
    expect(original.utr_id).toBe(utrId)
    expect(original.full_name).toBe('E2E Tester')

    // And the new seat can actually be paid for, which is the whole point.
    const secondProof = await submitPaymentProof({
      registrationId: second.registration.id,
      utrId: nextUtr(),
      proof: PNG_1PX,
    })
    expect(secondProof.ok).toBe(true)
  }, 30000)

  // A rejected submission IS resumable: the admin bounced it, the buyer is
  // expected to correct it, and rejectPayment already cleared the UTR and proof.
  it('resumes a rejected registration rather than orphaning it', async () => {
    const first = await createRegistration(validReg('rejectresume'))
    await sql`
      UPDATE registrations SET payment_status = 'rejected', rejected_reason = 'test'
      WHERE id = ${first.registration.id}
    `
    const second = await createRegistration(validReg('rejectresume', { fullName: 'Corrected' }))
    expect(second.status).toBe(200)
    expect(second.resumed).toBe(true)
    expect(second.registration.id).toBe(first.registration.id)
  }, 20000)
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

// --- Manual bank-transfer flow ------------------------------------------------

describe('submitPaymentProof — validation gates', () => {
  it('rejects a malformed registration id without throwing a DB cast error', async () => {
    const res = await submitPaymentProof({
      registrationId: 'not-a-uuid',
      utrId: nextUtr(),
      proof: PNG_1PX,
    })
    expect(res.ok).toBe(false)
    expect(res.status).toBe(400)
  })

  it('rejects a UTR that is not 12 characters', async () => {
    const reg = await createRegistration(validReg('shortutr'))
    const res = await submitPaymentProof({
      registrationId: reg.registration.id,
      utrId: '12345',
      proof: PNG_1PX,
    })
    expect(res.ok).toBe(false)
    expect(res.status).toBe(400)
    expect(res.error).toContain(UTR_EXAMPLE)
  })

  it('requires a screenshot — a submission with no proof is refused', async () => {
    const reg = await createRegistration(validReg('noproof'))
    const res = await submitPaymentProof({
      registrationId: reg.registration.id,
      utrId: nextUtr(),
      proof: '',
    })
    expect(res.ok).toBe(false)
    expect(res.status).toBe(400)
  })

  it('rejects a non-image data URL', async () => {
    const reg = await createRegistration(validReg('pdfproof'))
    const res = await submitPaymentProof({
      registrationId: reg.registration.id,
      utrId: nextUtr(),
      proof: 'data:application/pdf;base64,JVBERi0xLjQK',
    })
    expect(res.ok).toBe(false)
    expect(res.status).toBe(400)
  })
})

describe('submit -> verify -> approve', () => {
  it('moves the row to submitted without paying it or issuing a ticket', async () => {
    const reg = await createRegistration(validReg('flow1'))
    const utr = nextUtr()
    const res = await submitPaymentProof({
      registrationId: reg.registration.id,
      utrId: utr,
      proof: PNG_1PX,
    })
    expect(res.ok).toBe(true)

    const [row] = await sql`
      SELECT payment_status, utr_id, paid_at, ticket_jti, submitted_at
      FROM registrations WHERE id = ${reg.registration.id}
    `
    expect(row.payment_status).toBe('submitted')
    expect(row.utr_id).toBe(utr)
    expect(row.submitted_at).toBeTruthy()
    // The whole point of the manual flow: submitting proves nothing, so no seat
    // is taken and no pass exists yet.
    expect(row.paid_at).toBeNull()
    expect(row.ticket_jti).toBeNull()
  })

  it('surfaces the submission in the admin queue, without the base64 image', async () => {
    const reg = await createRegistration(validReg('flow2'))
    await submitPaymentProof({
      registrationId: reg.registration.id,
      utrId: nextUtr(),
      proof: PNG_1PX,
    })
    const queue = await listPendingVerifications({ limit: 500 })
    const found = queue.registrations.find((r) => r.id === reg.registration.id)
    expect(found).toBeTruthy()
    // The list must stay cheap — the proof is fetched one row at a time.
    expect(found.payment_proof).toBeUndefined()
    // The dashboard prints both timestamps on every queue row. The query used to
    // order by created_at without selecting it, so the column must stay asserted.
    expect(found.created_at).toBeInstanceOf(Date)
    expect(found.submitted_at).toBeInstanceOf(Date)
  })

  it('returns the proof image on demand', async () => {
    const reg = await createRegistration(validReg('flow3'))
    await submitPaymentProof({
      registrationId: reg.registration.id,
      utrId: nextUtr(),
      proof: PNG_1PX,
    })
    const res = await getPaymentProof(reg.registration.id)
    expect(res.ok).toBe(true)
    expect(res.proof).toContain('data:image/png;base64,')
  })

  it('rejects a duplicate UTR — the same reference cannot buy two seats', async () => {
    const utr = nextUtr()
    const a = await createRegistration(validReg('dupa'))
    const b = await createRegistration(validReg('dupb'))
    const first = await submitPaymentProof({
      registrationId: a.registration.id,
      utrId: utr,
      proof: PNG_1PX,
    })
    expect(first.ok).toBe(true)
    const second = await submitPaymentProof({
      registrationId: b.registration.id,
      utrId: utr,
      proof: PNG_1PX,
    })
    expect(second.ok).toBe(false)
    expect(second.status).toBe(409)
  })

  it('refuses a second submission while one is already awaiting verification', async () => {
    const reg = await createRegistration(validReg('twice'))
    await submitPaymentProof({
      registrationId: reg.registration.id,
      utrId: nextUtr(),
      proof: PNG_1PX,
    })
    const again = await submitPaymentProof({
      registrationId: reg.registration.id,
      utrId: nextUtr(),
      proof: PNG_1PX,
    })
    expect(again.ok).toBe(false)
    expect(again.status).toBe(409)
  })
})

describe('rejectPayment', () => {
  it('clears the UTR and proof so the buyer can resubmit', async () => {
    const reg = await createRegistration(validReg('rejected'))
    const utr = nextUtr()
    await submitPaymentProof({ registrationId: reg.registration.id, utrId: utr, proof: PNG_1PX })

    const res = await rejectPayment(
      { registrationId: reg.registration.id, reason: 'No matching credit in the statement.' },
      { adminUsername: 'tester' },
    )
    expect(res.ok).toBe(true)

    const [row] = await sql`
      SELECT payment_status, utr_id, payment_proof, rejected_reason
      FROM registrations WHERE id = ${reg.registration.id}
    `
    expect(row.payment_status).toBe('rejected')
    expect(row.utr_id).toBeNull()
    expect(row.payment_proof).toBeNull()
    expect(row.rejected_reason).toContain('No matching credit')

    // The freed UTR must be reusable — otherwise a bad reject would pin it forever.
    const retry = await submitPaymentProof({
      registrationId: reg.registration.id,
      utrId: utr,
      proof: PNG_1PX,
    })
    expect(retry.ok).toBe(true)
  })

  it('requires a reason', async () => {
    const reg = await createRegistration(validReg('noreason'))
    await submitPaymentProof({
      registrationId: reg.registration.id,
      utrId: nextUtr(),
      proof: PNG_1PX,
    })
    const res = await rejectPayment(
      { registrationId: reg.registration.id, reason: '' },
      { adminUsername: 'tester' },
    )
    expect(res.ok).toBe(false)
    expect(res.status).toBe(400)
  })

  it('will not reject a row that has no pending submission', async () => {
    const reg = await createRegistration(validReg('nosub'))
    const res = await rejectPayment(
      { registrationId: reg.registration.id, reason: 'nothing to reject' },
      { adminUsername: 'tester' },
    )
    expect(res.ok).toBe(false)
    expect(res.status).toBe(409)
  })
})

// The hard anti-oversell gate now lives in approvePayment's paid-flip:
//   ... AND (SELECT COUNT(*) ... WHERE payment_status='paid') < capacity
// Exercised against the real DB with the capacity clamped to the current paid
// count: the flip must match no row, so a submission cannot become the (N+1)th seat.
describe('approvePayment capacity guard', () => {
  it('does not flip a submission to paid when capacity is already full', async () => {
    const reg = await createRegistration(validReg('overcap'))
    await submitPaymentProof({
      registrationId: reg.registration.id,
      utrId: nextUtr(),
      proof: PNG_1PX,
    })

    const [{ count: paidNow }] = await sql`
      SELECT COUNT(*)::int AS count FROM registrations WHERE payment_status = 'paid'
    `
    // Capacity exactly equal to the seats already sold => zero seats remain.
    const capacity = paidNow

    const rows = await sql`
      UPDATE registrations
      SET payment_status = 'paid', paid_at = NOW()
      WHERE id = ${reg.registration.id}
        AND payment_status = 'submitted'
        AND (SELECT COUNT(*) FROM registrations WHERE payment_status = 'paid') < ${capacity}
      RETURNING id
    `
    expect(rows.length).toBe(0)

    const [row] = await sql`
      SELECT payment_status, ticket_jti FROM registrations WHERE id = ${reg.registration.id}
    `
    expect(row.payment_status).toBe('submitted')
    expect(row.ticket_jti).toBeNull()
  })

  it('refuses to approve a registration that was never submitted', async () => {
    const reg = await createRegistration(validReg('neversub'))
    const res = await approvePayment(
      { registrationId: reg.registration.id },
      { adminUsername: 'tester' },
    )
    expect(res.ok).toBe(false)
    expect(res.status).toBe(409)
  })
})
