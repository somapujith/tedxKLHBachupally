// @vitest-environment node
// Drives the real Express app through HTTP (supertest) so the actual request path
// is covered: route wiring, status codes, and — critically — the raw-body webhook
// Real Neon DB. Covers the register + manual bank-transfer submit endpoints.
import 'dotenv/config'
import request from 'supertest'
import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { app } from '../index.js'
import { getSql, ensureRegistrationsTable, ensureSupportTicketsTable } from '../db.js'

const sql = getSql()
const TAG = 'http_test_'
const email = (n) => `${TAG}${n}@example.com`
const PROOF_PNG =
  'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg=='

const guest = (n) => ({
  fullName: 'HTTP Tester',
  phone: '9876500000',
  email: email(n),
  designation: 'guest',
})

beforeAll(async () => {
  await ensureRegistrationsTable(sql)
  // Created here, not left to the first request: the cleanup below queries the
  // table before any handler has had a chance to create it.
  await ensureSupportTicketsTable(sql)
  // Tickets first: they carry a registration_id, and leaving them behind would
  // also leave rows the next run's assertions can see.
  await sql`DELETE FROM support_tickets WHERE email LIKE ${TAG + '%'}`
  await sql`DELETE FROM registrations WHERE email LIKE ${TAG + '%'}`
})

afterAll(async () => {
  // Tickets first: they carry a registration_id, and leaving them behind would
  // also leave rows the next run's assertions can see.
  await sql`DELETE FROM support_tickets WHERE email LIKE ${TAG + '%'}`
  await sql`DELETE FROM registrations WHERE email LIKE ${TAG + '%'}`
})

describe('GET /api/health', () => {
  it('reports the DB as connected', async () => {
    const res = await request(app).get('/api/health')
    expect(res.status).toBe(200)
    expect(res.body).toEqual({ ok: true, db: 'connected' })
  })
})

describe('GET /api/register', () => {
  // Asserted against the DATABASE, not against the response's own other fields:
  // deriving remaining from the returned capacity would pass even if the handler
  // invented both numbers.
  it('reports live availability matching the configured cap and the paid count', async () => {
    const { getSql } = await import('../db.js')
    const { getSeatCapacity } = await import('../settings.js')
    const sql = getSql()

    const res = await request(app).get('/api/register')
    expect(res.status).toBe(200)
    expect(res.body.ok).toBe(true)

    const [row] = await sql`
      SELECT COUNT(*)::int AS paid FROM registrations WHERE payment_status = 'paid'
    `
    const capacity = await getSeatCapacity()
    expect(res.body.capacity).toBe(capacity)
    expect(res.body.remaining).toBe(Math.max(0, capacity - row.paid))
    expect(res.body.soldOut).toBe(res.body.remaining === 0)
    // The paid count itself must NOT be public — it is a live revenue feed.
    expect(res.body.sold).toBeUndefined()
  })

  it('clamps remaining to zero rather than going negative when sold exceeds capacity', async () => {
    const { seatAvailability } = await import('../payments.js')
    const { getSql } = await import('../db.js')
    const sql = getSql()
    const [row] = await sql`
      SELECT COUNT(*)::int AS paid FROM registrations WHERE payment_status = 'paid'
    `

    // Drive the clamp for real by pinning the cap below the true paid count.
    // Restored immediately. No DB override exists in the test environment, so
    // SEAT_CAPACITY is the effective value here.
    const original = process.env.SEAT_CAPACITY
    process.env.SEAT_CAPACITY = String(Math.max(0, row.paid - 1))
    try {
      const availability = await seatAvailability()
      expect(availability.remaining).toBe(0)
      expect(availability.soldOut).toBe(true)
    } finally {
      if (original === undefined) delete process.env.SEAT_CAPACITY
      else process.env.SEAT_CAPACITY = original
    }
  })
})

describe('POST /api/register', () => {
  it('creates a registration and returns 201 JSON', async () => {
    const res = await request(app).post('/api/register').send(guest('reg'))
    expect(res.status).toBe(201)
    expect(res.body.ok).toBe(true)
    expect(res.body.registration.id).toBeTruthy()
  })

  it('returns 400 with an error list for invalid input', async () => {
    const res = await request(app)
      .post('/api/register')
      .send({ ...guest('bad'), email: 'nope' })
    expect(res.status).toBe(400)
    expect(res.body.ok).toBe(false)
    expect(Array.isArray(res.body.errors)).toBe(true)
  })
})

describe('POST /api/payment/submit', () => {
  const PNG_1PX =
    'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg=='
  const utr = () => String(Date.now()).slice(-6) + Math.random().toString().slice(2, 8)

  it('accepts a UTR + screenshot and leaves the row awaiting verification', async () => {
    const reg = await request(app).post('/api/register').send(guest('submit'))
    const res = await request(app)
      .post('/api/payment/submit')
      .send({ registrationId: reg.body.registration.id, utrId: utr(), proof: PNG_1PX })
    expect(res.status).toBe(200)
    expect(res.body.ok).toBe(true)
    expect(res.body.registration.payment_status).toBe('submitted')
  })

  it('returns 404 for an unknown registration id', async () => {
    const res = await request(app)
      .post('/api/payment/submit')
      .send({
        registrationId: '00000000-0000-0000-0000-000000000000',
        utrId: utr(),
        proof: PNG_1PX,
      })
    expect(res.status).toBe(404)
  })

  it('rejects a submission with no screenshot (400)', async () => {
    const reg = await request(app).post('/api/register').send(guest('noproofhttp'))
    const res = await request(app)
      .post('/api/payment/submit')
      .send({ registrationId: reg.body.registration.id, utrId: utr(), proof: '' })
    expect(res.status).toBe(400)
  })

  it('rejects a malformed UTR (400)', async () => {
    const reg = await request(app).post('/api/register').send(guest('badutrhttp'))
    const res = await request(app)
      .post('/api/payment/submit')
      .send({ registrationId: reg.body.registration.id, utrId: 'abc', proof: PNG_1PX })
    expect(res.status).toBe(400)
  })
})

describe('POST /api/support', () => {
  it('raises a ticket and returns the wait-for-us confirmation', async () => {
    const reg = await request(app).post('/api/register').send(guest('supporthttp'))
    const res = await request(app)
      .post('/api/support')
      .send({
        registrationId: reg.body.registration.id,
        fullName: 'HTTP Tester',
        phone: '9876500000',
        email: email('supporthttp'),
        subject: 'Payment issue',
        message: 'My payment went through but I have no pass yet.',
      })
    expect(res.status).toBe(201)
    expect(res.body.ok).toBe(true)
    expect(res.body.message).toMatch(/contact you as soon as possible/i)

    // Stored, linked, and open — the admin queue is what this exists to feed.
    const rows = await sql`
      SELECT status, registration_id FROM support_tickets WHERE id = ${res.body.ticket.id}
    `
    expect(rows[0].status).toBe('open')
    expect(rows[0].registration_id).toBe(reg.body.registration.id)
  }, 20000)

  it('rejects a ticket with no phone number (400)', async () => {
    const res = await request(app)
      .post('/api/support')
      .send({
        phone: '',
        email: email('nophonehttp'),
        message: 'Something is wrong with my registration.',
      })
    expect(res.status).toBe(400)
  })

  it('never changes the registration it references', async () => {
    const reg = await request(app).post('/api/register').send(guest('untouchedhttp'))
    await request(app)
      .post('/api/support')
      .send({
        registrationId: reg.body.registration.id,
        phone: '9876500000',
        email: email('untouchedhttp'),
        message: 'Please cancel my registration and refund me.',
      })
    const rows = await sql`
      SELECT payment_status FROM registrations WHERE id = ${reg.body.registration.id}
    `
    expect(rows[0].payment_status).toBe('pending')
  }, 20000)
})

describe('/api/admin/support', () => {
  it('requires authentication to read the queue', async () => {
    const res = await request(app).get('/api/admin/support')
    expect(res.status).toBe(401)
  })

  it('requires authentication to resolve a ticket', async () => {
    const res = await request(app)
      .post('/api/admin/support')
      .send({ ticketId: '11111111-2222-4333-8444-555555555555' })
    expect(res.status).toBe(401)
  })
})

// The admin dashboard speaks ONE API shape across both deploy targets. These
// pin the Express side to what src/admin/AdminDashboard.jsx actually sends —
// the shape drifted once already, and the divergence was invisible to every
// test because the Vercel handler was correct while Render served the client.
describe('/api/admin/verifications — client shape', () => {
  it('GET with ?id= returns that row proof, not the whole queue', async () => {
    const jwt = (await import('jsonwebtoken')).default
    const token = jwt.sign(
      { aid: '00000000-0000-0000-0000-000000000001', username: 'shape_probe', name: 'Shape Probe', role: 'admin' },
      process.env.ADMIN_JWT_SECRET,
      { algorithm: 'HS256', expiresIn: '1h', issuer: 'tedxklh-admin' },
    )

    const reg = await request(app).post('/api/register').send(guest('proofshape'))
    const id = reg.body.registration.id
    const utrId = String(Date.now()).slice(-6) + Math.random().toString().slice(2, 8)
    await request(app)
      .post('/api/payment/submit')
      .send({ registrationId: id, utrId, proof: PROOF_PNG })

    const res = await request(app)
      .get(`/api/admin/verifications?id=${id}`)
      .set('Authorization', `Bearer ${token}`)

    expect(res.status).toBe(200)
    // The bug: ?id= was ignored and the LIST came back, so the dashboard had no
    // image to render and showed "No screenshot available."
    expect(res.body.proof).toMatch(/^data:image\/png;base64,/)
    expect(res.body.registrations).toBeUndefined()
  }, 30000)

  it('POST /verifications is routed (approve/reject), not a 404', async () => {
    const res = await request(app)
      .post('/api/admin/verifications')
      .send({ registrationId: '11111111-2222-4333-8444-555555555555' })
    expect(res.status).toBe(401)
    expect(res.status).not.toBe(404)
  })

  it('POST /verifications with reject is routed the same way', async () => {
    const res = await request(app)
      .post('/api/admin/verifications')
      .send({ registrationId: '11111111-2222-4333-8444-555555555555', reject: true, reason: 'x' })
    expect(res.status).toBe(401)
    expect(res.status).not.toBe(404)
  })
})
