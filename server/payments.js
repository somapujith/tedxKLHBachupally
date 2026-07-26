import crypto from 'node:crypto'
import Razorpay from 'razorpay'
import { getSql, ensureRegistrationsTable } from './db.js'
import { issueTicket } from './tickets.js'

// Amount in paise (₹1 placeholder). Change here when real pricing is decided.
export const REGISTRATION_AMOUNT = 100
export const CURRENCY = 'INR'

const DEFAULT_SEAT_CAPACITY = 250

// Parse SEAT_CAPACITY defensively: `Number(env) || 250` would turn a legit 0
// (event closed) and NaN into 250. Accept only a finite, non-negative number.
export function seatCapacity() {
  const n = Number(process.env.SEAT_CAPACITY)
  return Number.isFinite(n) && n >= 0 ? n : DEFAULT_SEAT_CAPACITY
}

let client = null
function getClient() {
  const key_id = process.env.RAZORPAY_KEY_ID
  const key_secret = process.env.RAZORPAY_KEY_SECRET
  if (!key_id || !key_secret) {
    throw new Error('Razorpay keys are not set (RAZORPAY_KEY_ID / RAZORPAY_KEY_SECRET).')
  }
  if (!client) {
    client = new Razorpay({ key_id, key_secret })
  }
  return client
}

// Timing-safe HMAC compare. Returns false on any length mismatch instead of throwing.
function safeEqual(expected, actual) {
  const a = Buffer.from(String(expected), 'utf8')
  const b = Buffer.from(String(actual || ''), 'utf8')
  if (a.length !== b.length) return false
  return crypto.timingSafeEqual(a, b)
}

// Create a Razorpay order for an existing (pending) registration.
export async function createOrder({ registrationId }) {
  if (!registrationId) {
    return { ok: false, status: 400, error: 'Missing registration id.' }
  }

  const sql = getSql()
  await ensureRegistrationsTable(sql)

  const rows = await sql`
    SELECT id, email, full_name, payment_status
    FROM registrations
    WHERE id = ${registrationId}
    LIMIT 1
  `
  const reg = rows[0]
  if (!reg) {
    return { ok: false, status: 404, error: 'Registration not found.' }
  }
  if (reg.payment_status === 'paid') {
    return { ok: false, status: 409, error: 'This registration is already paid.' }
  }

  // Capacity gate: never sell a seat past capacity. Checked before the Razorpay
  // order so a sold-out event cannot even start a checkout. This is a soft gate —
  // the hard, atomic gate is in settlePayment's paid-flip.
  const capacity = seatCapacity()
  const paidCount = await sql`
    SELECT COUNT(*)::int AS count FROM registrations WHERE payment_status = 'paid'
  `
  if (paidCount[0].count >= capacity) {
    return {
      ok: false,
      status: 409,
      error: 'Sold out. All seats have been claimed.',
      soldOut: true,
    }
  }

  let order
  try {
    order = await getClient().orders.create({
      amount: REGISTRATION_AMOUNT,
      currency: CURRENCY,
      receipt: `reg_${reg.id}`,
      notes: { registrationId: reg.id, email: reg.email },
    })
  } catch (err) {
    console.error('Razorpay order create failed:', err?.error || err)
    return { ok: false, status: 502, error: 'Could not start payment. Please try again.' }
  }

  await sql`
    UPDATE registrations
    SET razorpay_order_id = ${order.id}, amount = ${REGISTRATION_AMOUNT}
    WHERE id = ${reg.id}
  `

  return {
    ok: true,
    status: 200,
    order: {
      id: order.id,
      amount: order.amount,
      currency: order.currency,
    },
    keyId: process.env.RAZORPAY_KEY_ID,
    registration: { id: reg.id, fullName: reg.full_name, email: reg.email },
  }
}

// Source-of-truth settlement check: fetch the payment from Razorpay and confirm
// it is captured/authorized for the RIGHT order, amount, and currency before we
// ever mark a registration paid. Signatures prove authenticity, not the amount —
// this is the amount/currency gate. Marks paid atomically and idempotently.
async function settlePayment({ orderId, paymentId }) {
  if (!orderId || !paymentId) {
    return { ok: false, status: 400, error: 'Missing order or payment id.' }
  }

  let payment
  try {
    payment = await getClient().payments.fetch(paymentId)
  } catch (err) {
    console.error('Razorpay payment fetch failed:', err?.error || err)
    return { ok: false, status: 502, error: 'Could not verify payment with Razorpay.' }
  }

  // Bind payment -> order, and enforce exact amount + currency + captured state.
  if (payment.order_id !== orderId) {
    return { ok: false, status: 400, error: 'Payment does not match this order.' }
  }
  if (payment.currency !== CURRENCY) {
    return { ok: false, status: 400, error: 'Payment currency mismatch.' }
  }
  if (Number(payment.amount) !== REGISTRATION_AMOUNT) {
    return { ok: false, status: 400, error: 'Payment amount mismatch.' }
  }
  if (payment.status !== 'captured' && payment.status !== 'authorized') {
    return { ok: false, status: 400, error: 'Payment not completed.' }
  }

  const sql = getSql()
  const capacity = seatCapacity()
  // Hard, atomic capacity gate: the paid-flip only wins if the current paid count
  // is still under capacity. The subquery runs inside the same statement as the
  // UPDATE, so N concurrent flips are serialized by row/table locks and cannot
  // collectively oversell past SEAT_CAPACITY.
  const rows = await sql`
    UPDATE registrations
    SET payment_status = 'paid',
        razorpay_payment_id = ${paymentId},
        amount = ${Number(payment.amount)},
        paid_at = COALESCE(paid_at, NOW())
    WHERE razorpay_order_id = ${orderId}
      AND payment_status <> 'paid'
      AND (SELECT COUNT(*) FROM registrations WHERE payment_status = 'paid') < ${capacity}
    RETURNING id, email, payment_status, razorpay_payment_id, paid_at
  `

  if (rows.length) {
    // Awaited (serverless — cannot fire-and-forget); issueTicket never throws
    // and its failure must not turn a settled payment into an error response.
    await issueTicket(rows[0].id)
    return { ok: true, status: 200, registration: rows[0] }
  }

  // No row flipped: already paid (idempotent replay), order unknown, or the
  // capacity guard blocked it. Re-read to disambiguate.
  const existing = await sql`
    SELECT id, email, payment_status, razorpay_payment_id, paid_at
    FROM registrations WHERE razorpay_order_id = ${orderId} LIMIT 1
  `
  if (existing[0]?.payment_status === 'paid') {
    // Replay path (webhook + verify double-delivery) converges here — retries
    // the ticket email if a previous attempt failed.
    await issueTicket(existing[0].id)
    return { ok: true, status: 200, registration: existing[0], alreadyPaid: true }
  }
  if (!existing[0]) {
    return { ok: false, status: 404, error: 'No registration matched this order.' }
  }

  // Row exists, still unpaid, and the flip did not win. If we are at/over
  // capacity, this is a captured payment that arrived after the event sold out.
  // We must NOT issue a ticket — flag it loudly so ops can refund manually.
  const paidCount = await sql`
    SELECT COUNT(*)::int AS count FROM registrations WHERE payment_status = 'paid'
  `
  if (paidCount[0].count >= capacity) {
    console.error(
      'OVERSELL: paid payment over capacity, needs refund',
      { orderId, paymentId },
    )
    return { ok: false, status: 409, error: 'Sold out.', soldOut: true }
  }
  return { ok: false, status: 404, error: 'No registration matched this order.' }
}

// Verify the checkout callback signature, then settle against Razorpay.
export async function verifyPayment(body) {
  const orderId = String(body.razorpay_order_id || '')
  const paymentId = String(body.razorpay_payment_id || '')
  const signature = String(body.razorpay_signature || '')

  if (!orderId || !paymentId || !signature) {
    return { ok: false, status: 400, error: 'Missing payment verification fields.' }
  }

  const expected = crypto
    .createHmac('sha256', process.env.RAZORPAY_KEY_SECRET || '')
    .update(`${orderId}|${paymentId}`)
    .digest('hex')

  if (!safeEqual(expected, signature)) {
    return { ok: false, status: 400, error: 'Payment signature verification failed.' }
  }

  // Signature is authentic; now confirm amount/currency/capture with Razorpay.
  return settlePayment({ orderId, paymentId })
}

// Verify a Razorpay webhook against the raw request body, then settle.
// rawBody MUST be the exact bytes Razorpay sent — parsed JSON will not match the HMAC.
export async function handleWebhook(rawBody, signature) {
  const secret = process.env.RAZORPAY_WEBHOOK_SECRET
  if (!secret) {
    return { ok: false, status: 500, error: 'Webhook secret not configured.' }
  }

  // Guard against empty/non-buffer bodies so HMAC never throws (500 -> retry storm).
  if (!Buffer.isBuffer(rawBody) && typeof rawBody !== 'string') {
    return { ok: false, status: 400, error: 'Invalid webhook body.' }
  }
  const buf = Buffer.isBuffer(rawBody) ? rawBody : Buffer.from(String(rawBody), 'utf8')
  if (buf.length === 0) {
    return { ok: false, status: 400, error: 'Empty webhook body.' }
  }

  const expected = crypto.createHmac('sha256', secret).update(buf).digest('hex')
  if (!safeEqual(expected, signature)) {
    return { ok: false, status: 400, error: 'Invalid webhook signature.' }
  }

  let event
  try {
    event = JSON.parse(buf.toString('utf8'))
  } catch {
    return { ok: false, status: 400, error: 'Invalid webhook payload.' }
  }

  // Only payment.captured carries a payment entity we can settle against.
  // Ack everything else with 200 so Razorpay stops retrying.
  if (event.event === 'payment.captured') {
    const entity = event.payload?.payment?.entity || {}
    const orderId = entity.order_id
    const paymentId = entity.id
    if (orderId && paymentId) {
      const result = await settlePayment({ orderId, paymentId })
      // Swallow settle-level 4xx here: a bad webhook event should not trigger
      // infinite Razorpay retries. Log and ack.
      if (!result.ok) {
        console.warn('Webhook settle skipped:', result.error, orderId)
      }
    }
  }

  return { ok: true, status: 200, received: true }
}
