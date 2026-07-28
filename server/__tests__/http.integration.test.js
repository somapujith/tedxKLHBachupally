// @vitest-environment node
// Drives the real Express app through HTTP (supertest) so the actual request path
// is covered: route wiring, status codes, and — critically — the raw-body webhook
// middleware ordering (express.raw before express.json). Real Neon DB + Razorpay.
import 'dotenv/config'
import crypto from 'node:crypto'
import request from 'supertest'
import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { app } from '../index.js'
import { getSql, ensureRegistrationsTable } from '../db.js'

const sql = getSql()
const TAG = 'http_test_'
const email = (n) => `${TAG}${n}@example.com`
const guest = (n) => ({
  fullName: 'HTTP Tester',
  phone: '9876500000',
  email: email(n),
  designation: 'guest',
})

beforeAll(async () => {
  await ensureRegistrationsTable(sql)
  await sql`DELETE FROM registrations WHERE email LIKE ${TAG + '%'}`
})

afterAll(async () => {
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

describe('POST /api/payment/order', () => {
  it('creates an order for a real registration', async () => {
    const reg = await request(app).post('/api/register').send(guest('order'))
    const res = await request(app)
      .post('/api/payment/order')
      .send({ registrationId: reg.body.registration.id })
    expect(res.status).toBe(200)
    expect(res.body.order.id).toMatch(/^order_/)
    expect(res.body.keyId).toBe(process.env.RAZORPAY_KEY_ID)
  })

  it('returns 404 for an unknown registration id', async () => {
    const res = await request(app)
      .post('/api/payment/order')
      .send({ registrationId: '00000000-0000-0000-0000-000000000000' })
    expect(res.status).toBe(404)
  })
})

describe('POST /api/payment/verify', () => {
  it('returns 400 for a bad signature', async () => {
    const res = await request(app).post('/api/payment/verify').send({
      razorpay_order_id: 'order_x',
      razorpay_payment_id: 'pay_x',
      razorpay_signature: 'bad',
    })
    expect(res.status).toBe(400)
    expect(res.body.error).toMatch(/signature/i)
  })
})

describe('POST /api/payment/webhook (raw-body path)', () => {
  const secret = () => process.env.RAZORPAY_WEBHOOK_SECRET

  it('rejects a body whose signature does not match the raw bytes (400)', async () => {
    // A wrong signature over a real JSON body — proves the raw body is being HMAC'd.
    const body = JSON.stringify({ event: 'payment.authorized', payload: {} })
    const res = await request(app)
      .post('/api/payment/webhook')
      .set('Content-Type', 'application/json')
      .set('x-razorpay-signature', 'wrong-signature')
      .send(body)
    expect(res.status).toBe(400)
  })

  it('accepts a correctly-signed body — HMAC computed over the exact raw bytes Express received', async () => {
    // If express.json() ran before express.raw() and reparsed the body, the bytes
    // used for this HMAC would not match and this test would fail — so this guards
    // the middleware ordering in server/index.js.
    const body = JSON.stringify({ event: 'payment.authorized', payload: {} })
    const sig = crypto.createHmac('sha256', secret()).update(body).digest('hex')
    const res = await request(app)
      .post('/api/payment/webhook')
      .set('Content-Type', 'application/json')
      .set('x-razorpay-signature', sig)
      .send(body)
    expect(res.status).toBe(200)
    expect(res.body.ok).toBe(true)
  })
})
