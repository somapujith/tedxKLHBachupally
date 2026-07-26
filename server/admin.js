import jwt from 'jsonwebtoken'
import bcrypt from 'bcryptjs'
import { getSql } from './db.js'
import { verifyTicket, issueTicket } from './tickets.js'
import { seatCapacity } from './payments.js'

const ADMIN_ISSUER = 'tedxklh-admin'
const STATUSES = ['paid', 'pending', 'checked_in']

// Precomputed bcrypt hash of a random string. Compared against when the username
// is unknown so both the known- and unknown-user paths spend equal time hashing —
// closing the login timing oracle. The plaintext is irrelevant (never matched).
const DUMMY_HASH = bcrypt.hashSync('unused-timing-equalizer-password', 10)

export async function loginAdmin({ username, password }) {
  const user = String(username || '').trim().toLowerCase()
  const pass = String(password || '')
  if (!user || !pass) {
    return { ok: false, status: 400, error: 'Username and password are required.' }
  }

  const secret = process.env.ADMIN_JWT_SECRET
  if (!secret) {
    return { ok: false, status: 500, error: 'Admin auth is not configured.' }
  }

  const sql = getSql()
  const rows = await sql`
    SELECT id, username, password_hash, display_name
    FROM admins WHERE LOWER(username) = ${user} LIMIT 1
  `
  // Uniform failure for unknown user and bad password — no account enumeration.
  // For an unknown user, still run bcrypt.compare against a dummy hash so the
  // response time matches the known-user path (no timing oracle).
  const admin = rows[0]
  const valid = await bcrypt.compare(pass, admin ? admin.password_hash : DUMMY_HASH)
  if (!admin || !valid) {
    return { ok: false, status: 401, error: 'Invalid credentials.' }
  }

  const token = jwt.sign(
    { aid: admin.id, username: admin.username, name: admin.display_name },
    secret,
    { algorithm: 'HS256', expiresIn: '12h', issuer: ADMIN_ISSUER },
  )
  return {
    ok: true,
    status: 200,
    token,
    admin: { username: admin.username, displayName: admin.display_name },
  }
}

// Set an allow-listed CORS origin header on a Vercel response. Echoes the request
// Origin only when it is in ADMIN_ALLOWED_ORIGIN (comma-separated); otherwise
// falls back to the first configured origin. Never emits '*' for admin endpoints.
// If the env var is unset (local dev), falls back to '*' so dev is not blocked.
export function setAdminCors(req, res) {
  const configured = String(process.env.ADMIN_ALLOWED_ORIGIN || '')
    .split(',')
    .map((o) => o.trim())
    .filter(Boolean)
  const origin = req.headers?.origin
  let allow = '*'
  if (configured.length) {
    allow = origin && configured.includes(origin) ? origin : configured[0]
    res.setHeader('Vary', 'Origin')
  }
  res.setHeader('Access-Control-Allow-Origin', allow)
}

// Plain function (not Express middleware) so both Express routes and Vercel
// handlers can gate on it.
export function requireAdmin(req) {
  const secret = process.env.ADMIN_JWT_SECRET
  if (!secret) {
    return { ok: false, status: 500, error: 'Admin auth is not configured.' }
  }
  const header = String(req.headers?.authorization || '')
  const token = header.startsWith('Bearer ') ? header.slice(7) : ''
  if (!token) {
    return { ok: false, status: 401, error: 'Missing admin token.' }
  }
  try {
    const admin = jwt.verify(token, secret, { algorithms: ['HS256'], issuer: ADMIN_ISSUER })
    return { ok: true, admin }
  } catch {
    return { ok: false, status: 401, error: 'Invalid or expired admin token.' }
  }
}

export async function getStats() {
  const sql = getSql()
  const rows = await sql`
    SELECT
      COUNT(*)::int AS total,
      COUNT(*) FILTER (WHERE payment_status = 'paid')::int AS paid,
      COUNT(*) FILTER (WHERE payment_status = 'pending')::int AS pending,
      COUNT(*) FILTER (WHERE checked_in_at IS NOT NULL)::int AS checked_in,
      COALESCE(SUM(amount) FILTER (WHERE payment_status = 'paid'), 0)::int AS revenue,
      (SELECT COALESCE(json_agg(d), '[]'::json) FROM (
        SELECT designation, COUNT(*)::int AS count FROM registrations
        WHERE payment_status = 'paid' GROUP BY designation ORDER BY count DESC
      ) d) AS by_designation,
      (SELECT COALESCE(json_agg(c), '[]'::json) FROM (
        SELECT COALESCE(NULLIF(college_other, ''), college, 'Guest / Other') AS college,
               COUNT(*)::int AS count
        FROM registrations WHERE payment_status = 'paid'
        GROUP BY 1 ORDER BY count DESC
      ) c) AS by_college
    FROM registrations
  `
  const stats = rows[0]
  return {
    ok: true,
    status: 200,
    stats: {
      total: stats.total,
      paid: stats.paid,
      pending: stats.pending,
      checkedIn: stats.checked_in,
      revenue: stats.revenue,
      capacity: seatCapacity(),
      byDesignation: stats.by_designation,
      byCollege: stats.by_college,
    },
  }
}

export async function listRegistrations({ status } = {}) {
  if (status && !STATUSES.includes(status)) {
    return { ok: false, status: 400, error: 'Unknown status filter.' }
  }

  const sql = getSql()
  const rows =
    status === 'checked_in'
      ? await sql`
          SELECT id, full_name, email, phone, designation, college,
                 payment_status, paid_at, checked_in_at, checked_in_by
          FROM registrations
          WHERE checked_in_at IS NOT NULL ORDER BY created_at DESC
        `
      : status
        ? await sql`
            SELECT id, full_name, email, phone, designation, college,
                   payment_status, paid_at, checked_in_at, checked_in_by
            FROM registrations
            WHERE payment_status = ${status} ORDER BY created_at DESC
          `
        : await sql`
            SELECT id, full_name, email, phone, designation, college,
                   payment_status, paid_at, checked_in_at, checked_in_by
            FROM registrations ORDER BY created_at DESC
          `

  return { ok: true, status: 200, registrations: rows }
}

// Diagnose why the atomic check-in UPDATE matched nothing.
async function diagnoseCheckIn(sql, payload) {
  const rows = await sql`
    SELECT id, full_name, ticket_jti, payment_status, checked_in_at, checked_in_by
    FROM registrations WHERE id = ${payload.rid} LIMIT 1
  `
  const reg = rows[0]
  if (!reg || reg.ticket_jti !== payload.jti) {
    return { ok: false, status: 404, error: 'Invalid ticket.' }
  }
  if (reg.payment_status !== 'paid') {
    return { ok: false, status: 409, error: 'Ticket not paid.' }
  }
  if (reg.checked_in_at) {
    return {
      ok: false,
      status: 409,
      alreadyCheckedIn: true,
      attendee: {
        full_name: reg.full_name,
        checked_in_at: reg.checked_in_at,
        checked_in_by: reg.checked_in_by,
      },
      error: 'Already checked in.',
    }
  }
  return { ok: false, status: 409, error: 'Could not check in. Please retry.' }
}

export async function checkInTicket({ token, adminName }) {
  const verified = verifyTicket(String(token || ''))
  if (!verified.ok) {
    return { ok: false, status: 404, error: 'Invalid ticket.' }
  }

  const { rid, jti } = verified.payload
  const sql = getSql()
  // Single-use gate: only one scan can flip checked_in_at from NULL.
  const rows = await sql`
    UPDATE registrations
    SET checked_in_at = NOW(), checked_in_by = ${String(adminName || '')}
    WHERE id = ${rid}
      AND ticket_jti = ${jti}
      AND payment_status = 'paid'
      AND checked_in_at IS NULL
    RETURNING id, full_name, email, designation, checked_in_at
  `
  if (rows.length) {
    return { ok: true, status: 200, attendee: rows[0] }
  }
  return diagnoseCheckIn(sql, verified.payload)
}

export async function resendTicket({ registrationId }) {
  if (!registrationId) {
    return { ok: false, status: 400, error: 'Missing registration id.' }
  }

  const sql = getSql()
  const rows = await sql`
    SELECT id, payment_status, ticket_email_sent_at
    FROM registrations WHERE id = ${registrationId} LIMIT 1
  `
  if (!rows[0]) {
    return { ok: false, status: 404, error: 'Registration not found.' }
  }
  if (rows[0].payment_status !== 'paid') {
    return { ok: false, status: 409, error: 'Registration is not paid.' }
  }

  // Cooldown: a ticket emailed within the last 2 minutes cannot be re-sent again,
  // so a stuck admin cannot spam the attendee's inbox.
  const sentAt = rows[0].ticket_email_sent_at
  if (sentAt && Date.now() - new Date(sentAt).getTime() < 2 * 60 * 1000) {
    return {
      ok: false,
      status: 429,
      error: 'Ticket was re-sent recently. Try again in a few minutes.',
    }
  }

  // force:true re-claims + re-sends atomically inside issueTicket (no manual
  // null of the column — that left a window where the row could self-re-email).
  const issued = await issueTicket(registrationId, { force: true })
  if (!issued.ok) {
    return { ok: false, status: 502, error: 'Could not resend ticket email.' }
  }
  return { ok: true, status: 200, emailed: issued.emailed === true }
}
