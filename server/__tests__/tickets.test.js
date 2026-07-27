// @vitest-environment node
// Unit tests for ticket JWT sign/verify — no DB required. The secret is set
// in-process so these run anywhere (CI without secrets included).
import 'dotenv/config'
import crypto from 'node:crypto'
import { describe, it, expect, beforeEach, beforeAll, afterAll } from 'vitest'
import jwt from 'jsonwebtoken'
import { signTicket, verifyTicket, issueTicket } from '../tickets.js'

const ORIGINAL_SECRET = process.env.TICKET_JWT_SECRET
const hasDb = Boolean(process.env.DATABASE_URL)
const registration = { id: '11111111-2222-3333-4444-555555555555', full_name: 'Aarav Sharma' }
const jti = 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee'

beforeEach(() => {
  process.env.TICKET_JWT_SECRET = 'test-ticket-secret'
})

afterAll(() => {
  if (ORIGINAL_SECRET === undefined) delete process.env.TICKET_JWT_SECRET
  else process.env.TICKET_JWT_SECRET = ORIGINAL_SECRET
})

describe('signTicket / verifyTicket round trip', () => {
  it('signs and verifies a ticket, preserving rid and jti', () => {
    const token = signTicket(registration, jti)
    const res = verifyTicket(token)
    expect(res.ok).toBe(true)
    expect(res.payload.rid).toBe(registration.id)
    expect(res.payload.jti).toBe(jti)
    expect(res.payload.iss).toBe('tedxklh')
  })

  it('carries the attendee name so a scan can identify them without a DB read', () => {
    const res = verifyTicket(signTicket(registration, jti))
    expect(res.payload.name).toBe('Aarav Sharma')
  })

  it('signs a null name rather than throwing when the row has none', () => {
    const res = verifyTicket(signTicket({ id: registration.id }, jti))
    expect(res.ok).toBe(true)
    expect(res.payload.name).toBeNull()
  })

  it('throws when TICKET_JWT_SECRET is unset', () => {
    delete process.env.TICKET_JWT_SECRET
    expect(() => signTicket(registration, jti)).toThrow(/TICKET_JWT_SECRET/)
  })
})

describe('verifyTicket rejections', () => {
  it('rejects a tampered token without throwing', () => {
    const token = signTicket(registration, jti)
    const [header, payload, sig] = token.split('.')
    const forged = Buffer.from(
      JSON.stringify({ ...jwt.decode(token), rid: 'someone-else' }),
    ).toString('base64url')
    const res = verifyTicket(`${header}.${forged}.${sig}`)
    expect(res.ok).toBe(false)
    expect(res.error).toBeTruthy()
    expect(payload).not.toBe(forged)
  })

  it('rejects a token signed with the wrong secret', () => {
    const token = signTicket(registration, jti)
    process.env.TICKET_JWT_SECRET = 'a-different-secret'
    const res = verifyTicket(token)
    expect(res.ok).toBe(false)
  })

  it('rejects a token with the wrong issuer', () => {
    // Hand-rolled HS256 JWT with the right secret but a wrong iss claim.
    const b64 = (obj) => Buffer.from(JSON.stringify(obj)).toString('base64url')
    const header = b64({ alg: 'HS256', typ: 'JWT' })
    const payload = b64({ rid: registration.id, jti, iss: 'not-tedxklh' })
    const sig = crypto
      .createHmac('sha256', process.env.TICKET_JWT_SECRET)
      .update(`${header}.${payload}`)
      .digest('base64url')
    const res = verifyTicket(`${header}.${payload}.${sig}`)
    expect(res.ok).toBe(false)
  })

  it('rejects garbage input without throwing', () => {
    expect(verifyTicket('not-a-jwt').ok).toBe(false)
    expect(verifyTicket('').ok).toBe(false)
  })
})

// Claim-then-send race safety (real DB). RESEND_API_KEY is deliberately cleared
// for this block so sendTicketEmail short-circuits to { skipped: true } — that
// forces the stamp to roll back, which is exactly the contract under test, and it
// guarantees the suite never fires a live send at the synthetic @example.com
// addresses below (real bounces would damage the sending domain's reputation).
// We also assert the raw conditional-claim SQL that issueTicket relies on can
// only win once — the property that prevents webhook+verify double-sends.
describe.skipIf(!hasDb)('issueTicket — claim-then-send (real DB)', () => {
  const TAG = 'ticket_claim_test_'
  const ORIGINAL_RESEND_KEY = process.env.RESEND_API_KEY
  let sql

  beforeAll(async () => {
    process.env.TICKET_JWT_SECRET = 'test-ticket-secret'
    delete process.env.RESEND_API_KEY
    const { getSql, ensureRegistrationsTable } = await import('../db.js')
    sql = getSql()
    await ensureRegistrationsTable(sql)
    await sql`DELETE FROM registrations WHERE email LIKE ${TAG + '%'}`
  })

  afterAll(async () => {
    await sql`DELETE FROM registrations WHERE email LIKE ${TAG + '%'}`
    if (ORIGINAL_RESEND_KEY === undefined) delete process.env.RESEND_API_KEY
    else process.env.RESEND_API_KEY = ORIGINAL_RESEND_KEY
  })

  async function insertPaid(n) {
    const rows = await sql`
      INSERT INTO registrations (full_name, phone, email, designation, payment_status, paid_at)
      VALUES ('Claim Tester', '9876500000', ${`${TAG}${n}@example.com`}, 'guest', 'paid', NOW())
      RETURNING id
    `
    return rows[0].id
  }

  it('the conditional email-send claim wins for exactly one of two concurrent callers', async () => {
    const id = await insertPaid('claim')
    // First win: stamp goes NULL -> NOW().
    const first = await sql`
      UPDATE registrations SET ticket_email_sent_at = NOW()
      WHERE id = ${id} AND ticket_email_sent_at IS NULL RETURNING id
    `
    // Second claim on the now-stamped row must return no row (already claimed).
    const second = await sql`
      UPDATE registrations SET ticket_email_sent_at = NOW()
      WHERE id = ${id} AND ticket_email_sent_at IS NULL RETURNING id
    `
    expect(first.length).toBe(1)
    expect(second.length).toBe(0)
  })

  it('issueTicket does not double-send: after a failed send the stamp is rolled back to NULL', async () => {
    const id = await insertPaid('rollback')
    // No RESEND_API_KEY in this block -> sendTicketEmail is skipped -> not emailed.
    const a = await issueTicket(id)
    const b = await issueTicket(id)
    expect(a.ok).toBe(true)
    expect(a.emailed).toBe(false)
    expect(b.ok).toBe(true)
    expect(b.emailed).toBe(false)
    // A jti was still issued (idempotent), and the send stamp was rolled back so a
    // later attempt (once mail is configured) can re-claim and actually send.
    const rows = await sql`
      SELECT ticket_jti, ticket_email_sent_at FROM registrations WHERE id = ${id}
    `
    expect(rows[0].ticket_jti).toBeTruthy()
    expect(rows[0].ticket_email_sent_at).toBeNull()
  })
})
