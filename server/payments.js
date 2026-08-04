// Manual bank-transfer settlement.
//
// There is no payment gateway. The buyer scans a bank QR out-of-band, pays from
// their own banking app, then submits the UTR reference and a screenshot of the
// transaction. An admin compares both against the bank statement and approves;
// approval is what issues the pass and sends the confirmation mail.
//
// The consequence worth stating plainly: a UTR is unverifiable from here. Anyone
// can type twelve digits. Nothing in this file proves a payment happened — the
// admin's eyes on the bank statement are the only real check, which is exactly
// why the ticket is issued at approval and never at submission.

import { getSql, ensureSchemaOnce, withDbRetry, isUuid } from './db.js'
import { issueTicket } from './tickets.js'
import { getSeatCapacity, getPassPrice } from './settings.js'
import { recordAudit, AUDIT_ACTIONS } from './audit.js'

export const CURRENCY = 'INR'

// Indian bank UTR/RRN references are 12 alphanumeric characters (commonly all
// digits for UPI, alphanumeric for NEFT/IMPS). Kept permissive on case, strict
// on length, so a pasted reference with different casing is still accepted.
const UTR_PATTERN = /^[A-Za-z0-9]{12}$/
export const UTR_EXAMPLE = '123456789012'

// Base64 payload ceiling. Vercel caps a request body near 4.5MB and base64
// inflates by ~33%, so the client compresses to well under this; the server
// still enforces it because a client check is not a control.
const MAX_PROOF_BYTES = 1_500_000
const ALLOWED_PROOF_MIME = ['image/jpeg', 'image/png', 'image/webp']

export { seatCapacity } from './settings.js'
export { getPassPrice } from './settings.js'

// Public availability snapshot for the register page. `sold` counts only paid
// rows — submitted-but-unverified rows hold no seat, because a seat is only
// committed when an admin approves.
export async function seatAvailability() {
  const sql = getSql()
  await ensureSchemaOnce(sql)
  const capacity = await getSeatCapacity(sql)
  const passPrice = await getPassPrice(sql)
  const paidCount = await withDbRetry(() => sql`
    SELECT COUNT(*)::int AS count FROM registrations WHERE payment_status = 'paid'
  `)
  const sold = paidCount[0]?.count ?? 0
  const remaining = Math.max(0, capacity - sold)
  // `sold` stays server-side: remaining/capacity is everything the page needs,
  // and a public paid-count is a real-time revenue feed for anyone with curl.
  return { capacity, remaining, soldOut: remaining === 0, passPrice, currency: CURRENCY }
}

// Split a data URL into its mime type and raw base64 payload. Returns null for
// anything that is not a well-formed image data URL.
function parseDataUrl(value) {
  const match = /^data:([a-z]+\/[a-z0-9+.-]+);base64,([A-Za-z0-9+/=]+)$/i.exec(String(value || ''))
  if (!match) return null
  return { mime: match[1].toLowerCase(), data: match[2] }
}

/**
 * Buyer submits their bank-transfer proof: UTR reference plus a screenshot.
 *
 * Moves the row pending|rejected -> submitted. Deliberately does NOT issue a
 * ticket, send mail, or consume a seat — all three wait for admin approval.
 */
export async function submitPaymentProof({ registrationId, utrId, proof }) {
  if (!registrationId) {
    return { ok: false, status: 400, error: 'Missing registration id.' }
  }
  // Shape-check before the query: a non-uuid id makes Postgres throw rather than
  // return zero rows, turning a client mistake into a 500.
  if (!isUuid(registrationId)) {
    return { ok: false, status: 400, error: 'Invalid registration id.' }
  }

  const utr = String(utrId || '').trim().toUpperCase()
  if (!UTR_PATTERN.test(utr)) {
    return {
      ok: false,
      status: 400,
      error: `Enter a valid 12-character UTR reference (example: ${UTR_EXAMPLE}).`,
    }
  }

  const parsed = parseDataUrl(proof)
  if (!parsed) {
    return { ok: false, status: 400, error: 'Attach a screenshot of your transaction.' }
  }
  if (!ALLOWED_PROOF_MIME.includes(parsed.mime)) {
    return { ok: false, status: 400, error: 'Screenshot must be a JPG, PNG, or WebP image.' }
  }
  if (parsed.data.length > MAX_PROOF_BYTES) {
    return { ok: false, status: 400, error: 'Screenshot is too large. Please upload a smaller image.' }
  }

  const sql = getSql()
  await ensureSchemaOnce(sql)

  const rows = await withDbRetry(() => sql`
    SELECT id, email, full_name, payment_status
    FROM registrations WHERE id = ${registrationId} LIMIT 1
  `)
  const reg = rows[0]
  if (!reg) {
    return { ok: false, status: 404, error: 'Registration not found.' }
  }
  if (reg.payment_status === 'paid') {
    return { ok: false, status: 409, error: 'This registration is already confirmed.' }
  }
  if (reg.payment_status === 'submitted') {
    return {
      ok: false,
      status: 409,
      error: 'Your payment is already awaiting verification.',
    }
  }

  // Advisory sold-out gate so a closed event does not collect proof it cannot
  // honour. The binding gate is the atomic flip in approvePayment.
  const capacity = await getSeatCapacity(sql)
  const paidCount = await withDbRetry(() => sql`
    SELECT COUNT(*)::int AS count FROM registrations WHERE payment_status = 'paid'
  `)
  if (paidCount[0].count >= capacity) {
    return { ok: false, status: 409, error: 'Sold out. All seats have been claimed.', soldOut: true }
  }

  const price = await getPassPrice(sql)

  try {
    const updated = await withDbRetry(() => sql`
      UPDATE registrations
      SET payment_status = 'submitted',
          utr_id = ${utr},
          payment_proof = ${parsed.data},
          proof_mime = ${parsed.mime},
          amount = ${price},
          submitted_at = NOW(),
          rejected_reason = NULL
      WHERE id = ${reg.id}
        AND payment_status <> 'paid'
        AND payment_status <> 'submitted'
      RETURNING id, email, payment_status, submitted_at
    `)
    if (!updated.length) {
      // Lost a race with a concurrent submit for this same row.
      return { ok: false, status: 409, error: 'Your payment is already awaiting verification.' }
    }
    return { ok: true, status: 200, registration: updated[0] }
  } catch (err) {
    // 23505 on registrations_utr_unique: this reference is already on another
    // row. Reported honestly rather than as a generic failure, because the buyer
    // can act on it — they have almost certainly pasted the wrong transaction.
    if (String(err?.code) === '23505') {
      return {
        ok: false,
        status: 409,
        error: 'This UTR reference has already been submitted. Check that you copied the right transaction.',
      }
    }
    console.error('submitPaymentProof failed:', err)
    return { ok: false, status: 500, error: 'Could not submit your payment. Please try again.' }
  }
}

// Admin queue: submissions waiting on a human, oldest first. The base64 proof is
// deliberately excluded — a queue of inline images would be megabytes per page.
// The dashboard fetches one proof at a time via getPaymentProof.
export async function listPendingVerifications({ limit = 100 } = {}) {
  const sql = getSql()
  await ensureSchemaOnce(sql)
  const capped = Math.min(Math.max(Number(limit) || 100, 1), 500)
  const rows = await withDbRetry(() => sql`
    SELECT id, full_name, email, phone, designation, college, college_other,
           utr_id, amount, submitted_at, proof_mime
    FROM registrations
    WHERE payment_status = 'submitted'
    ORDER BY submitted_at ASC
    LIMIT ${capped}
  `)
  return { ok: true, status: 200, registrations: rows }
}

// Single proof image, fetched on demand when an admin opens a submission.
export async function getPaymentProof(registrationId) {
  if (!isUuid(registrationId)) {
    return { ok: false, status: 400, error: 'Invalid registration id.' }
  }
  const sql = getSql()
  await ensureSchemaOnce(sql)
  const rows = await withDbRetry(() => sql`
    SELECT payment_proof, proof_mime FROM registrations WHERE id = ${registrationId} LIMIT 1
  `)
  if (!rows[0]?.payment_proof) {
    return { ok: false, status: 404, error: 'No payment proof on file.' }
  }
  return {
    ok: true,
    status: 200,
    proof: `data:${rows[0].proof_mime || 'image/jpeg'};base64,${rows[0].payment_proof}`,
  }
}

/**
 * Admin approves a submission: the seat is committed and the pass is issued.
 *
 * This is the only place a registration becomes paid, so it carries the hard
 * capacity gate. The count subquery runs inside the same statement as the
 * UPDATE, so concurrent approvals are serialized by row locks and cannot
 * collectively oversell past capacity.
 */
export async function approvePayment({ registrationId }, actor = {}, context = {}) {
  if (!isUuid(registrationId)) {
    return { ok: false, status: 400, error: 'Invalid registration id.' }
  }

  const sql = getSql()
  await ensureSchemaOnce(sql)
  const capacity = await getSeatCapacity(sql)

  const rows = await withDbRetry(() => sql`
    UPDATE registrations
    SET payment_status = 'paid',
        paid_at = COALESCE(paid_at, NOW()),
        verified_at = NOW(),
        verified_by = ${actor.adminUsername || null},
        rejected_reason = NULL
    WHERE id = ${registrationId}
      AND payment_status = 'submitted'
      AND (SELECT COUNT(*) FROM registrations WHERE payment_status = 'paid') < ${capacity}
    RETURNING id, email, full_name, utr_id, amount, payment_status, paid_at
  `)

  if (!rows.length) {
    // Disambiguate: already handled, gone, or blocked by the capacity gate.
    const existing = await withDbRetry(() => sql`
      SELECT id, payment_status FROM registrations WHERE id = ${registrationId} LIMIT 1
    `)
    if (!existing[0]) {
      return { ok: false, status: 404, error: 'Registration not found.' }
    }
    if (existing[0].payment_status === 'paid') {
      return { ok: false, status: 409, error: 'This registration is already confirmed.' }
    }
    if (existing[0].payment_status !== 'submitted') {
      return { ok: false, status: 409, error: 'This registration has no pending submission.' }
    }
    // Still submitted, flip lost: capacity is full. Real money may already be in
    // the bank, so this needs a human decision (raise the cap, or refund).
    console.error('OVERSELL: approval blocked by capacity, needs manual handling', {
      registrationId,
    })
    return { ok: false, status: 409, error: 'Sold out — cannot approve without raising capacity.', soldOut: true }
  }

  // Awaited, not fire-and-forget (serverless). issueTicket never throws, so a
  // mail failure cannot turn a committed approval into an error response — the
  // seat is already paid and the admin can resend from the dashboard.
  await issueTicket(rows[0].id)

  await recordAudit({
    adminId: actor.adminId,
    adminUsername: actor.adminUsername || 'unknown',
    adminRole: actor.adminRole,
    action: AUDIT_ACTIONS.PAYMENT_APPROVED,
    targetType: 'registration',
    targetId: rows[0].id,
    targetName: rows[0].full_name,
    detail: `Approved UTR ${rows[0].utr_id} (₹${rows[0].amount}). Ticket issued.`,
    ip: context.ip,
    userAgent: context.userAgent,
  })

  return { ok: true, status: 200, registration: rows[0] }
}

/**
 * Every verified payment, newest first — the money ledger.
 *
 * Deliberately reads from `verified_at`, not `paid_at`: paid_at is COALESCEd on
 * approval and so survives from an older flow, while verified_at is stamped by
 * the human who actually checked the bank statement. Reconciling against the
 * bank means asking "what did we approve, and who approved it", which is
 * verified_at's question.
 *
 * The base64 proof column is NOT selected — this is a list view, and pulling a
 * megabyte per row would make the ledger unopenable at scale. The dashboard's
 * single-row proof fetch already covers looking at one screenshot.
 *
 * `search` matches a UTR reference or an attendee, since reconciliation starts
 * from a line on a bank statement.
 */
export async function listVerifiedPayments({ search, limit = 200 } = {}) {
  const sql = getSql()
  await ensureSchemaOnce(sql)
  const capped = Math.min(Math.max(Number(limit) || 200, 1), 1000)
  const q = String(search || '').trim().toLowerCase()
  // A LIKE pattern built here rather than inline, so the parameter stays a bound
  // value and the query is not string-concatenated.
  const pattern = q ? `%${q}%` : null

  const rows = await withDbRetry(() => sql`
    SELECT id, full_name, email, phone, designation, college, college_other,
           utr_id, amount, payment_status, submitted_at, verified_at, verified_by,
           paid_at, checked_in_at,
           (ticket_jti IS NOT NULL) AS ticket_issued,
           (ticket_revoked_at IS NOT NULL) AS ticket_revoked
    FROM registrations
    WHERE payment_status = 'paid'
      AND (
        ${pattern}::text IS NULL
        OR LOWER(utr_id) LIKE ${pattern}::text
        OR LOWER(full_name) LIKE ${pattern}::text
        OR LOWER(email) LIKE ${pattern}::text
      )
    ORDER BY COALESCE(verified_at, paid_at) DESC NULLS LAST
    LIMIT ${capped}
  `)

  // Totals describe the WHOLE ledger, not the page or the current search — a
  // filtered subtotal shown as "total collected" would be read as revenue.
  const [totals] = await withDbRetry(() => sql`
    SELECT COUNT(*)::int AS count, COALESCE(SUM(amount), 0)::int AS total
    FROM registrations WHERE payment_status = 'paid'
  `)

  return {
    ok: true,
    status: 200,
    payments: rows,
    totalCount: totals.count,
    totalAmount: totals.total,
  }
}

/**
 * Admin rejects a submission — the UTR did not match the bank statement.
 *
 * Clears the proof and UTR so the buyer can resubmit (and so the unique index
 * does not pin a bad reference to this row forever). No mail is sent; the
 * rejection reason surfaces when they return to the register page.
 */
export async function rejectPayment({ registrationId, reason }, actor = {}, context = {}) {
  if (!isUuid(registrationId)) {
    return { ok: false, status: 400, error: 'Invalid registration id.' }
  }
  const note = String(reason || '').trim().slice(0, 500)
  if (note.length < 3) {
    return { ok: false, status: 400, error: 'Give a reason for the rejection.' }
  }

  const sql = getSql()
  await ensureSchemaOnce(sql)

  const rows = await withDbRetry(() => sql`
    UPDATE registrations
    SET payment_status = 'rejected',
        rejected_reason = ${note},
        verified_at = NOW(),
        verified_by = ${actor.adminUsername || null},
        utr_id = NULL,
        payment_proof = NULL,
        proof_mime = NULL
    WHERE id = ${registrationId} AND payment_status = 'submitted'
    RETURNING id, email, full_name, payment_status
  `)

  if (!rows.length) {
    const existing = await withDbRetry(() => sql`
      SELECT id, payment_status FROM registrations WHERE id = ${registrationId} LIMIT 1
    `)
    if (!existing[0]) return { ok: false, status: 404, error: 'Registration not found.' }
    if (existing[0].payment_status === 'paid') {
      return { ok: false, status: 409, error: 'This registration is already confirmed.' }
    }
    return { ok: false, status: 409, error: 'This registration has no pending submission.' }
  }

  await recordAudit({
    adminId: actor.adminId,
    adminUsername: actor.adminUsername || 'unknown',
    adminRole: actor.adminRole,
    action: AUDIT_ACTIONS.PAYMENT_REJECTED,
    targetType: 'registration',
    targetId: rows[0].id,
    targetName: rows[0].full_name,
    detail: `Rejected: ${note}`,
    ip: context.ip,
    userAgent: context.userAgent,
  })

  return { ok: true, status: 200, registration: rows[0] }
}
