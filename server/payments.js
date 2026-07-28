import crypto from 'node:crypto'
import Razorpay from 'razorpay'
import { getSql, ensureSchemaOnce, withDbRetry, isUuid } from './db.js'
import { issueTicket } from './tickets.js'
import { getSeatCapacity } from './settings.js'

// Razorpay's SDK has no built-in timeout — a slow API call would otherwise hang
// the serverless function until Vercel's platform limit, burning an invocation
// and blocking a user during a launch spike. Wrap every Razorpay call in a race
// against a timeout, and retry idempotent reads a bounded number of times.
const RZP_TIMEOUT_MS = Number(process.env.RAZORPAY_TIMEOUT_MS) || 10000

function withTimeout(promise, ms, label) {
  let timer
  const timeout = new Promise((_resolve, reject) => {
    timer = setTimeout(() => reject(new Error(`${label} timed out after ${ms}ms`)), ms)
  })
  // If the timeout wins the race, the underlying promise is still pending; attach
  // a no-op catch so its LATER rejection cannot surface as an unhandled rejection
  // (which on some Node/serverless runtimes terminates the instance).
  promise.catch(() => {})
  return Promise.race([promise, timeout]).finally(() => clearTimeout(timer))
}

// Retry-with-backoff for idempotent Razorpay reads (payments.fetch). NOT used for
// orders.create — creating twice would mint two orders; that call gets a timeout
// but no retry. A 4xx from Razorpay (bad id) is not retried; only timeouts and
// 5xx/network errors are.
async function rzpCall(fn, { label, retries = 0 }) {
  let lastErr
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      return await withTimeout(Promise.resolve().then(fn), RZP_TIMEOUT_MS, label)
    } catch (err) {
      lastErr = err
      const status = Number(err?.statusCode || err?.status || 0)
      const retriable = status === 0 || status >= 500 || /timed out|network|ECONN/i.test(String(err?.message))
      if (!retriable || attempt === retries) throw err
      await new Promise((r) => setTimeout(r, 200 * 2 ** attempt))
    }
  }
  throw lastErr
}

// Amount in paise (₹1 placeholder). Change here when real pricing is decided.
export const REGISTRATION_AMOUNT = 100
export const CURRENCY = 'INR'

// Capacity now lives in server/settings.js so a superadmin can edit it at
// runtime (DB override -> SEAT_CAPACITY env -> 250). seatCapacity is
// re-exported unchanged for existing importers/tests of the env fallback.
export { seatCapacity } from './settings.js'

// Public availability snapshot for the register page: how many passes exist and
// how many are left. Advisory only — a count read here can be stale by the time
// the buyer pays; the atomic gate in settlePayment is what actually prevents
// oversell. `sold` counts only paid registrations, matching both capacity gates.
export async function seatAvailability() {
  const sql = getSql()
  await ensureSchemaOnce(sql)
  const capacity = await getSeatCapacity(sql)
  const paidCount = await withDbRetry(() => sql`
    SELECT COUNT(*)::int AS count FROM registrations WHERE payment_status = 'paid'
  `)
  const sold = paidCount[0]?.count ?? 0
  const remaining = Math.max(0, capacity - sold)
  // `sold` stays server-side: remaining/capacity is everything the page needs,
  // and a public paid-count is a real-time revenue feed for anyone with curl.
  return { capacity, remaining, soldOut: remaining === 0 }
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
  // Shape-check before the query: a non-uuid id makes Postgres throw rather than
  // return zero rows, turning a client mistake into a 500. See isUuid().
  if (!isUuid(registrationId)) {
    return { ok: false, status: 400, error: 'Invalid registration id.' }
  }

  const sql = getSql()
  await ensureSchemaOnce(sql)

  const rows = await withDbRetry(() => sql`
    SELECT id, email, full_name, payment_status
    FROM registrations
    WHERE id = ${registrationId}
    LIMIT 1
  `)
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
  const capacity = await getSeatCapacity(sql)
  const paidCount = await withDbRetry(() => sql`
    SELECT COUNT(*)::int AS count FROM registrations WHERE payment_status = 'paid'
  `)
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
    // No retry: orders.create is not idempotent — a retry after a timeout could
    // mint a second order for the same registration. Timeout only.
    order = await rzpCall(
      () =>
        getClient().orders.create({
          amount: REGISTRATION_AMOUNT,
          currency: CURRENCY,
          receipt: `reg_${reg.id}`,
          notes: { registrationId: reg.id, email: reg.email },
        }),
      { label: 'Razorpay orders.create', retries: 0 },
    )
  } catch (err) {
    console.error('Razorpay order create failed:', err?.error || err)
    return { ok: false, status: 502, error: 'Could not start payment. Please try again.' }
  }

  await withDbRetry(() => sql`
    UPDATE registrations
    SET razorpay_order_id = ${order.id}, amount = ${REGISTRATION_AMOUNT}
    WHERE id = ${reg.id}
  `)

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
    // Idempotent read — safe to retry on a transient failure so a flaky Razorpay
    // response during a spike does not falsely reject a real, captured payment.
    // retries: 1 (not 2) — keep server-side amplification low. The verify path
    // (client) + webhook path both converge on settlePayment for the same
    // payment, so total Razorpay read fan-out per payment must stay bounded.
    payment = await rzpCall(() => getClient().payments.fetch(paymentId), {
      label: 'Razorpay payments.fetch',
      retries: 1,
    })
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
  const capacity = await getSeatCapacity(sql)
  // Hard, atomic capacity gate: the paid-flip only wins if the current paid count
  // is still under capacity. The subquery runs inside the same statement as the
  // UPDATE, so N concurrent flips are serialized by row/table locks and cannot
  // collectively oversell past SEAT_CAPACITY.
  // Retry-safe: the `payment_status <> 'paid'` guard makes a replay flip nothing
  // (0 rows) and converge to the already-paid re-read below, so a retried UPDATE
  // after a transient failure cannot double-charge or oversell.
  const rows = await withDbRetry(() => sql`
    UPDATE registrations
    SET payment_status = 'paid',
        razorpay_payment_id = ${paymentId},
        amount = ${Number(payment.amount)},
        paid_at = COALESCE(paid_at, NOW())
    WHERE razorpay_order_id = ${orderId}
      AND payment_status <> 'paid'
      AND (SELECT COUNT(*) FROM registrations WHERE payment_status = 'paid') < ${capacity}
    RETURNING id, email, payment_status, razorpay_payment_id, paid_at
  `)

  if (rows.length) {
    // Awaited (serverless — cannot fire-and-forget); issueTicket never throws
    // and its failure must not turn a settled payment into an error response.
    await issueTicket(rows[0].id)
    return { ok: true, status: 200, registration: rows[0] }
  }

  // No row flipped: already paid (idempotent replay), order unknown, or the
  // capacity guard blocked it. Re-read to disambiguate.
  const existing = await withDbRetry(() => sql`
    SELECT id, email, payment_status, razorpay_payment_id, paid_at
    FROM registrations WHERE razorpay_order_id = ${orderId} LIMIT 1
  `)
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
