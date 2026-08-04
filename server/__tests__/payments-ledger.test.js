// @vitest-environment node
// Verified-payment ledger against the real Neon database. Cleans up its own rows.
import 'dotenv/config'
import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { getSql, ensureRegistrationsTable } from '../db.js'
import { createRegistration } from '../registrations.js'
import { listVerifiedPayments } from '../payments.js'

const sql = getSql()
const TAG = 'ledger_test_'
const email = (n) => `${TAG}${n}@example.com`

let paidId
const UTR = 'LEDGER' + String(Date.now()).slice(-6)

beforeAll(async () => {
  await ensureRegistrationsTable(sql)
  await sql`DELETE FROM registrations WHERE email LIKE ${TAG + '%'}`

  const paid = await createRegistration({
    fullName: 'Ledger Paid',
    phone: '9876500000',
    email: email('paid'),
    designation: 'guest',
  })
  paidId = paid.registration.id
  await sql`
    UPDATE registrations
    SET payment_status = 'paid', utr_id = ${UTR}, amount = 449,
        verified_at = NOW(), verified_by = 'ledger_admin', paid_at = NOW()
    WHERE id = ${paidId}
  `

  // A submitted row must never appear in a ledger of VERIFIED payments.
  const pendingReg = await createRegistration({
    fullName: 'Ledger Pending',
    phone: '9876500001',
    email: email('pending'),
    designation: 'guest',
  })
  await sql`
    UPDATE registrations SET payment_status = 'submitted', utr_id = ${'SUB' + Date.now().toString().slice(-9)}
    WHERE id = ${pendingReg.registration.id}
  `
}, 40000)

afterAll(async () => {
  await sql`DELETE FROM registrations WHERE email LIKE ${TAG + '%'}`
})

describe('listVerifiedPayments', () => {
  it('lists paid rows with their UTR, amount and approver', async () => {
    const res = await listVerifiedPayments({})
    expect(res.ok).toBe(true)
    const row = res.payments.find((p) => p.id === paidId)
    expect(row).toBeTruthy()
    expect(row.utr_id).toBe(UTR)
    expect(row.amount).toBe(449)
    expect(row.verified_by).toBe('ledger_admin')
  }, 20000)

  it('excludes submissions that are still awaiting verification', async () => {
    const res = await listVerifiedPayments({})
    const emails = res.payments.map((p) => p.email)
    expect(emails).toContain(email('paid'))
    expect(emails).not.toContain(email('pending'))
  }, 20000)

  it('never returns the base64 proof — the ledger must stay cheap to open', async () => {
    const res = await listVerifiedPayments({})
    for (const p of res.payments) {
      expect(p.payment_proof).toBeUndefined()
    }
  }, 20000)

  it('finds a payment by its exact UTR reference', async () => {
    const res = await listVerifiedPayments({ search: UTR })
    expect(res.payments.length).toBeGreaterThan(0)
    expect(res.payments.every((p) => p.utr_id?.includes(UTR))).toBe(true)
  }, 20000)

  it('searches by attendee name and email too', async () => {
    const byName = await listVerifiedPayments({ search: 'Ledger Paid' })
    expect(byName.payments.some((p) => p.id === paidId)).toBe(true)
    const byEmail = await listVerifiedPayments({ search: email('paid') })
    expect(byEmail.payments.some((p) => p.id === paidId)).toBe(true)
  }, 20000)

  it('reports totals for the whole ledger, not just the filtered page', async () => {
    const all = await listVerifiedPayments({})
    const filtered = await listVerifiedPayments({ search: UTR })
    // A filtered subtotal shown as "total collected" would be read as revenue.
    expect(filtered.totalCount).toBe(all.totalCount)
    expect(filtered.totalAmount).toBe(all.totalAmount)
    expect(filtered.payments.length).toBeLessThanOrEqual(all.payments.length)
  }, 20000)

  it('returns an empty list rather than throwing for a no-match search', async () => {
    const res = await listVerifiedPayments({ search: 'zzz-no-such-reference-zzz' })
    expect(res.ok).toBe(true)
    expect(res.payments).toEqual([])
  }, 20000)
})
