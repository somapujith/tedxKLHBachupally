// @vitest-environment node
// Admin auth unit tests (no DB) + check-in integration tests against the real
// Neon DB (skipped when DATABASE_URL is not configured). Cleans up its own rows.
import 'dotenv/config'
import crypto from 'node:crypto'
import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { loginAdmin, requireAdmin, checkInTicket } from '../admin.js'
import { signTicket } from '../tickets.js'

const ORIGINAL_ADMIN_SECRET = process.env.ADMIN_JWT_SECRET
const ORIGINAL_TICKET_SECRET = process.env.TICKET_JWT_SECRET
const hasDb = Boolean(process.env.DATABASE_URL)

beforeAll(() => {
  process.env.TICKET_JWT_SECRET = 'test-ticket-secret'
})

afterAll(() => {
  if (ORIGINAL_ADMIN_SECRET === undefined) delete process.env.ADMIN_JWT_SECRET
  else process.env.ADMIN_JWT_SECRET = ORIGINAL_ADMIN_SECRET
  if (ORIGINAL_TICKET_SECRET === undefined) delete process.env.TICKET_JWT_SECRET
  else process.env.TICKET_JWT_SECRET = ORIGINAL_TICKET_SECRET
})

describe('loginAdmin — configuration guards', () => {
  it('returns 500 when ADMIN_JWT_SECRET is unset (before touching the DB)', async () => {
    delete process.env.ADMIN_JWT_SECRET
    const res = await loginAdmin({ username: 'gate', password: 'pw' })
    expect(res.ok).toBe(false)
    expect(res.status).toBe(500)
  })

  it('returns 400 when username or password is missing', async () => {
    const res = await loginAdmin({ username: '', password: '' })
    expect(res.ok).toBe(false)
    expect(res.status).toBe(400)
  })
})

// Behavioral (not a timing measurement): an unknown username must still return a
// uniform 401. The implementation runs bcrypt.compare against a dummy hash on the
// unknown-user branch to equalize timing; this test guards the visible contract.
describe.skipIf(!hasDb)('loginAdmin — unknown user (uniform 401)', () => {
  beforeAll(() => {
    process.env.ADMIN_JWT_SECRET = 'test-admin-secret'
  })

  it('returns 401 (not a distinguishable error) for a username that does not exist', async () => {
    const res = await loginAdmin({
      username: `nobody_${crypto.randomUUID()}`,
      password: 'whatever',
    })
    expect(res.ok).toBe(false)
    expect(res.status).toBe(401)
    expect(res.error).toMatch(/invalid credentials/i)
    // No account-enumeration signal leaks (no "user not found" vs "bad password").
    expect(res.token).toBeUndefined()
  })
})

describe('requireAdmin', () => {
  it('rejects a missing Authorization header (401)', () => {
    process.env.ADMIN_JWT_SECRET = 'test-admin-secret'
    const res = requireAdmin({ headers: {} })
    expect(res.ok).toBe(false)
    expect(res.status).toBe(401)
  })

  it('rejects a garbage bearer token (401)', () => {
    process.env.ADMIN_JWT_SECRET = 'test-admin-secret'
    const res = requireAdmin({ headers: { authorization: 'Bearer nope' } })
    expect(res.ok).toBe(false)
    expect(res.status).toBe(401)
  })
})

describe.skipIf(!hasDb)('checkInTicket — single use (real DB)', () => {
  const TAG = 'checkin_test_'
  let sql

  beforeAll(async () => {
    const { getSql, ensureRegistrationsTable } = await import('../db.js')
    sql = getSql()
    await ensureRegistrationsTable(sql)
    await sql`DELETE FROM registrations WHERE email LIKE ${TAG + '%'}`
  })

  afterAll(async () => {
    await sql`DELETE FROM registrations WHERE email LIKE ${TAG + '%'}`
  })

  async function insertPaidWithTicket(n) {
    const jti = crypto.randomUUID()
    const rows = await sql`
      INSERT INTO registrations (
        full_name, phone, email, designation, payment_status, paid_at,
        ticket_jti, ticket_issued_at
      ) VALUES (
        'Checkin Tester', '9876500000', ${`${TAG}${n}@example.com`}, 'guest',
        'paid', NOW(), ${jti}, NOW()
      )
      RETURNING id
    `
    return { id: rows[0].id, token: signTicket({ id: rows[0].id }, jti) }
  }

  it('checks in once, then reports alreadyCheckedIn on the second scan', async () => {
    const { token } = await insertPaidWithTicket('twice')
    const first = await checkInTicket({ token, adminName: 'Gate Admin' })
    expect(first.ok).toBe(true)
    expect(first.status).toBe(200)
    expect(first.attendee.full_name).toBe('Checkin Tester')

    const second = await checkInTicket({ token, adminName: 'Gate Admin' })
    expect(second.ok).toBe(false)
    expect(second.status).toBe(409)
    expect(second.alreadyCheckedIn).toBe(true)
    expect(second.attendee.checked_in_by).toBe('Gate Admin')
  })

  it('rejects a ticket whose jti no longer matches (404)', async () => {
    const { id } = await insertPaidWithTicket('stalejti')
    const staleToken = signTicket({ id }, crypto.randomUUID())
    const res = await checkInTicket({ token: staleToken, adminName: 'Gate Admin' })
    expect(res.ok).toBe(false)
    expect(res.status).toBe(404)
  })

  it('rejects an unpaid registration (409, not paid)', async () => {
    const { id, token } = await insertPaidWithTicket('unpaid')
    await sql`UPDATE registrations SET payment_status = 'pending' WHERE id = ${id}`
    const res = await checkInTicket({ token, adminName: 'Gate Admin' })
    expect(res.ok).toBe(false)
    expect(res.status).toBe(409)
    expect(res.error).toMatch(/not paid/i)
  })

  it('rejects an invalid token string (404)', async () => {
    const res = await checkInTicket({ token: 'garbage', adminName: 'Gate Admin' })
    expect(res.ok).toBe(false)
    expect(res.status).toBe(404)
  })
})
