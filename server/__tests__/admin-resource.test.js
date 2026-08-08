// @vitest-environment node
// Drives the Vercel admin handler (api/admin/[resource].js) directly, because
// its request shape differs from Express in one way that has already caused a
// production bug: Vercel's dynamic-route matcher can deliver a query value as
// an ARRAY, and every validator downstream is string-only.
import 'dotenv/config'
// See server/__tests__/payments.integration.test.js for why: this suite drives
// real registration/verification endpoints against the real DB, which sends
// real booking emails as a side effect. Deleting the key routes those through
// email.js's existing "no key -> skip" path instead of a real Resend call.
delete process.env.RESEND_API_KEY
import jwt from 'jsonwebtoken'
import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import handler from '../../api/admin/[resource].js'
import { getSql, ensureRegistrationsTable } from '../db.js'
import { createRegistration } from '../registrations.js'
import { submitPaymentProof } from '../payments.js'

const sql = getSql()
const TAG = 'resource_test_'
const email = (n) => `${TAG}${n}@example.com`

// A 1x1 PNG — a genuinely valid data URL, parsed and mime-checked like a real
// screenshot by the submit path.
const PNG_1PX =
  'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg=='

const token = () =>
  jwt.sign(
    {
      aid: '00000000-0000-0000-0000-000000000001',
      username: 'resource_test_admin',
      name: 'Resource Test Admin',
      role: 'admin',
    },
    process.env.ADMIN_JWT_SECRET,
    { algorithm: 'HS256', expiresIn: '1h', issuer: 'tedxklh-admin' },
  )

// Minimal res double capturing what the handler wrote.
function mockRes() {
  const out = { code: 0, body: null, headers: {}, headersSent: false }
  return {
    out,
    setHeader(k, v) {
      out.headers[k] = v
    },
    get headersSent() {
      return out.headersSent
    },
    status(c) {
      out.code = c
      return this
    },
    json(b) {
      out.body = b
      return this
    },
    end() {
      return this
    },
  }
}

async function call(query) {
  const res = mockRes()
  await handler(
    {
      method: 'GET',
      headers: { authorization: `Bearer ${token()}`, origin: 'https://tedxklhbachupally.in' },
      query,
      socket: { remoteAddress: '127.0.0.1' },
    },
    res,
  )
  return res.out
}

let registrationId

beforeAll(async () => {
  await ensureRegistrationsTable(sql)
  await sql`DELETE FROM registrations WHERE email LIKE ${TAG + '%'}`

  const reg = await createRegistration({
    fullName: 'Resource Tester',
    phone: '9876500000',
    email: email('proof'),
    designation: 'guest',
  })
  registrationId = reg.registration.id
  const utr = String(Date.now()).slice(-6) + Math.random().toString().slice(2, 8)
  const submitted = await submitPaymentProof({ registrationId, utrId: utr, proof: PNG_1PX })
  expect(submitted.ok).toBe(true)
}, 30000)

afterAll(async () => {
  await sql`DELETE FROM registrations WHERE email LIKE ${TAG + '%'}`
})

describe('admin verifications resource', () => {
  it('returns the proof for a plain string id', async () => {
    const out = await call({ resource: 'verifications', id: registrationId })
    expect(out.code).toBe(200)
    expect(out.body.proof).toMatch(/^data:image\/png;base64,/)
  }, 20000)

  it('returns the proof when Vercel delivers the id as an array', async () => {
    // The production shape: a repeated/merged query key arrives as an array.
    // Before the boundary normalization this failed isUuid() and answered 400,
    // which is exactly how the admin screen lost its screenshot.
    const out = await call({ resource: 'verifications', id: [registrationId] })
    expect(out.code).toBe(200)
    expect(out.body.proof).toMatch(/^data:image\/png;base64,/)
  }, 20000)

  it('lists the queue when no id is present', async () => {
    const out = await call({ resource: 'verifications' })
    expect(out.code).toBe(200)
    expect(Array.isArray(out.body.registrations)).toBe(true)
    // The list must never carry the base64 image — that is what keeps the queue cheap.
    const row = out.body.registrations.find((r) => r.id === registrationId)
    expect(row).toBeTruthy()
    expect(row.payment_proof).toBeUndefined()
  }, 20000)

  it('still rejects a genuinely malformed id with 400', async () => {
    const out = await call({ resource: 'verifications', id: 'not-a-uuid' })
    expect(out.code).toBe(400)
  }, 20000)

  it('404s an unknown resource rather than leaking a prototype member', async () => {
    const out = await call({ resource: 'constructor' })
    expect(out.code).toBe(404)
  })
})
