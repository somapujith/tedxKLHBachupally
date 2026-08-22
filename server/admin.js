import jwt from 'jsonwebtoken'
import bcrypt from 'bcryptjs'
import { getSql, isUuid } from './db.js'
import { verifyTicket, issueTicket } from './tickets.js'
import { getSeatCapacity } from './settings.js'
import { recordAudit, AUDIT_ACTIONS } from './audit.js'

const ADMIN_ISSUER = 'tedxklh-admin'
const STATUSES = ['paid', 'pending', 'submitted', 'checked_in']

export const ROLES = { ADMIN: 'admin', SUPERADMIN: 'superadmin' }

// Roles are additive: a superadmin has every gate-admin power PLUS the audit
// trail, the email log, cross-admin statistics, and account management.
// Anything not explicitly 'superadmin' is treated as a plain admin — so a token
// minted before the role column existed cannot silently gain privilege.
function normalizeRole(value) {
  return value === ROLES.SUPERADMIN ? ROLES.SUPERADMIN : ROLES.ADMIN
}

// Identity of the acting admin, for audit rows. Reads the signed JWT claims —
// never a client-supplied body field.
export function actorFrom(auth) {
  const admin = auth?.admin || {}
  return {
    adminId: admin.aid || null,
    adminUsername: admin.username || 'unknown',
    adminRole: normalizeRole(admin.role),
    displayName: admin.name || admin.username || 'Admin',
  }
}

// Precomputed bcrypt hash of a random string. Compared against when the username
// is unknown so both the known- and unknown-user paths spend equal time hashing —
// closing the login timing oracle. The plaintext is irrelevant (never matched).
const DUMMY_HASH = bcrypt.hashSync('unused-timing-equalizer-password', 10)

export async function loginAdmin({ username, password }, context = {}) {
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
  // COALESCE, not a bare select: a deploy that has not run the migration yet has
  // no role/is_active columns... but the query would then fail on the missing
  // column itself, so instead the columns are guaranteed by ensureAdminsTable in
  // migrate/seed. COALESCE only covers a NULL left by a hand-inserted row.
  const rows = await sql`
    SELECT id, username, password_hash, display_name,
           COALESCE(role, 'admin') AS role,
           COALESCE(is_active, TRUE) AS is_active
    FROM admins WHERE LOWER(username) = ${user} LIMIT 1
  `
  // Uniform failure for unknown user and bad password — no account enumeration.
  // For an unknown user, still run bcrypt.compare against a dummy hash so the
  // response time matches the known-user path (no timing oracle).
  const admin = rows[0]
  const valid = await bcrypt.compare(pass, admin ? admin.password_hash : DUMMY_HASH)
  if (!admin || !valid) {
    await recordAudit({
      action: AUDIT_ACTIONS.LOGIN_FAILED,
      adminUsername: user,
      result: 'failure',
      detail: admin ? 'Wrong password.' : 'Unknown username.',
      ip: context.ip,
      userAgent: context.userAgent,
    })
    return { ok: false, status: 401, error: 'Invalid credentials.' }
  }

  // A deactivated account gets the SAME 401 as a bad password. Saying "account
  // disabled" would confirm the username exists, which is exactly the
  // enumeration signal the uniform-failure path above exists to prevent. The
  // real reason is recorded in the audit trail, where only a superadmin sees it.
  if (admin.is_active === false) {
    await recordAudit({
      action: AUDIT_ACTIONS.LOGIN_FAILED,
      adminId: admin.id,
      adminUsername: admin.username,
      adminRole: normalizeRole(admin.role),
      result: 'failure',
      detail: 'Account is deactivated.',
      ip: context.ip,
      userAgent: context.userAgent,
    })
    return { ok: false, status: 401, error: 'Invalid credentials.' }
  }

  const role = normalizeRole(admin.role)
  const token = jwt.sign(
    { aid: admin.id, username: admin.username, name: admin.display_name, role },
    secret,
    { algorithm: 'HS256', expiresIn: '12h', issuer: ADMIN_ISSUER },
  )

  // Best-effort: a failed stamp must not block a valid login.
  await sql`UPDATE admins SET last_login_at = NOW() WHERE id = ${admin.id}`.catch((err) =>
    console.error('last_login_at update failed:', err?.message || err),
  )
  await recordAudit({
    action: AUDIT_ACTIONS.LOGIN_SUCCESS,
    adminId: admin.id,
    adminUsername: admin.username,
    adminRole: role,
    ip: context.ip,
    userAgent: context.userAgent,
  })

  return {
    ok: true,
    status: 200,
    token,
    admin: { username: admin.username, displayName: admin.display_name, role },
  }
}

// Set an allow-listed CORS origin header on a Vercel response. Echoes the request
// NOTE: admin CORS is now applied by withApi({ scope: 'admin' }) in server/http.js
// for the Vercel handlers, and by the Express cors() middleware in server/index.js
// for the self-host path. The former standalone setAdminCors() helper was removed
// as dead code once every api/admin/* handler moved to the withApi wrapper.

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
    return { ok: true, admin: { ...admin, role: normalizeRole(admin.role) } }
  } catch {
    return { ok: false, status: 401, error: 'Invalid or expired admin token.' }
  }
}

// Superadmin gate for the audit log, email log, cross-admin statistics and
// account management. 403 (not 401) on a valid non-super token: the caller IS
// authenticated, they simply lack the role — a 401 would bounce them to the
// login screen in a loop, since signing in again yields the same token.
export async function requireSuperAdmin(req) {
  const auth = requireAdmin(req)
  if (!auth.ok) return auth
  if (auth.admin.role !== ROLES.SUPERADMIN) {
    return { ok: false, status: 403, error: 'Superadmin access required.' }
  }

  // The signature proves the token was minted by us; it does NOT prove the
  // account still exists, is still active, or is still a superadmin. Tokens live
  // 12 hours, so without this re-read a demoted or deactivated superadmin keeps
  // full access for the rest of the day — deactivation would be cosmetic against
  // a live session. One extra query, only on the privileged routes.
  try {
    const sql = getSql()
    const rows = await sql`
      SELECT role, is_active FROM admins WHERE id = ${auth.admin.aid} LIMIT 1
    `
    const current = rows[0]
    if (!current || current.is_active === false || normalizeRole(current.role) !== ROLES.SUPERADMIN) {
      return { ok: false, status: 403, error: 'Superadmin access required.' }
    }
  } catch (err) {
    // Fail CLOSED. This gate guards account management and the audit trail; a
    // database blip must not hand out access it cannot verify.
    console.error('Superadmin re-check failed:', err?.message || err)
    return { ok: false, status: 503, error: 'Could not verify admin access. Try again.' }
  }
  return auth
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
      capacity: await getSeatCapacity(sql),
      byDesignation: stats.by_designation,
      byCollege: stats.by_college,
    },
  }
}

export async function listRegistrations({ status } = {}) {
  if (status && !STATUSES.includes(status)) {
    return { ok: false, status: 400, error: 'Unknown status filter.' }
  }

  // ticket_issued (never the jti itself — that is the scannable credential)
  // lets the UI show whether a QR pass exists, and offer the superadmin revoke.
  const sql = getSql()
  const rows =
    status === 'checked_in'
      ? await sql`
          SELECT id, full_name, email, phone, designation, college, utr_id,
                 payment_status, amount, created_at, submitted_at, verified_at, paid_at,
                 checked_in_at, checked_in_by,
                 coupon_code, discount_amount,
                 (ticket_jti IS NOT NULL) AS ticket_issued
          FROM registrations
          WHERE checked_in_at IS NOT NULL ORDER BY created_at DESC
        `
      : status
        ? await sql`
            SELECT id, full_name, email, phone, designation, college, utr_id,
                   payment_status, amount, created_at, submitted_at, verified_at, paid_at,
                   checked_in_at, checked_in_by,
                   coupon_code, discount_amount,
                   (ticket_jti IS NOT NULL) AS ticket_issued
            FROM registrations
            WHERE payment_status = ${status} ORDER BY created_at DESC
          `
        : await sql`
            SELECT id, full_name, email, phone, designation, college, utr_id,
                   payment_status, amount, created_at, submitted_at, verified_at, paid_at,
                   checked_in_at, checked_in_by,
                   coupon_code, discount_amount,
                   (ticket_jti IS NOT NULL) AS ticket_issued
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

/**
 * Scan a pass at the gate.
 *
 * Every outcome is audited — success, duplicate and rejection alike. A scan that
 * was refused is the interesting one when reconciling the door later ("who tried
 * to walk in twice, and on whose scanner"), so failures are recorded with the
 * same detail as successes.
 *
 * @param {object} args
 * @param {string} args.token       The ticket JWT read off the QR.
 * @param {string} [args.adminName] Display name written to checked_in_by.
 * @param {object} [args.actor]     actorFrom(auth) — identity for the audit row.
 * @param {object} [args.context]   requestContext(req) — ip + user agent.
 */
export async function checkInTicket({ token, adminName, actor = {}, context = {} }) {
  // The audit row must name a person even on the legacy call shape used by the
  // existing tests, which passes only adminName.
  const audit = {
    adminId: actor.adminId,
    adminUsername: actor.adminUsername || adminName || 'unknown',
    adminRole: actor.adminRole,
    targetType: 'registration',
    ip: context.ip,
    userAgent: context.userAgent,
  }

  const scanned = String(token || '')
  const verified = verifyTicket(scanned)
  if (!verified.ok) {
    // Record WHY, not just "rejected". jsonwebtoken's own message separates the
    // three cases a gate actually has to act on differently, and collapsing
    // them into one fixed string left the door unable to tell a guest holding
    // the wrong image apart from a genuine signing problem:
    //   'jwt malformed'     -> the QR is not a pass at all (a UPI/payment code,
    //                          a poster, someone else's link)
    //   'invalid signature' -> a real JWT signed with a different secret
    //   'jwt expired'       -> a pass older than the 365d issue window
    // The leading characters of the payload are kept alongside it: a pass token
    // always starts 'eyJ', so this shows at a glance which of the two it was.
    // Only a short prefix, and never the trailing signature.
    await recordAudit({
      ...audit,
      action: AUDIT_ACTIONS.CHECKIN_REJECTED,
      result: 'failure',
      detail: `Rejected (${verified.error || 'unreadable'}). Scanned: ${scanned.slice(0, 24) || '(empty)'}…`,
    })
    return {
      ok: false,
      status: 404,
      // 'jwt malformed' is the common, recoverable case at a door, and it has a
      // concrete instruction attached: the person is holding the wrong picture.
      // "Invalid ticket" sent an admin looking for a system fault instead.
      error: /malformed/i.test(verified.error || '')
        ? 'Not a TEDx pass. Ask them to open the “Your TEDxKLH entry pass” email and show that QR.'
        : 'Invalid ticket.',
    }
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
    await recordAudit({
      ...audit,
      action: AUDIT_ACTIONS.CHECKIN_SUCCESS,
      targetId: rows[0].id,
      targetName: rows[0].full_name,
      detail: rows[0].email,
    })
    return { ok: true, status: 200, attendee: rows[0] }
  }

  const failure = await diagnoseCheckIn(sql, verified.payload)
  await recordAudit({
    ...audit,
    action: failure.alreadyCheckedIn ? AUDIT_ACTIONS.CHECKIN_DUPLICATE : AUDIT_ACTIONS.CHECKIN_REJECTED,
    result: 'failure',
    targetId: rid,
    targetName: failure.attendee?.full_name,
    detail: failure.alreadyCheckedIn
      ? `Already checked in by ${failure.attendee?.checked_in_by || 'unknown'}.`
      : failure.error,
  })
  return failure
}

export async function resendTicket({ registrationId, actor = {}, context = {} }) {
  const audit = {
    adminId: actor.adminId,
    adminUsername: actor.adminUsername || 'unknown',
    adminRole: actor.adminRole,
    targetType: 'registration',
    targetId: typeof registrationId === 'string' ? registrationId : null,
    ip: context.ip,
    userAgent: context.userAgent,
  }

  if (!registrationId) {
    return { ok: false, status: 400, error: 'Missing registration id.' }
  }
  // Same uuid shape gate as createOrder — a malformed id must be a 400, not a
  // thrown Postgres error surfacing as a 500. See isUuid().
  if (!isUuid(registrationId)) {
    return { ok: false, status: 400, error: 'Invalid registration id.' }
  }

  const sql = getSql()
  const rows = await sql`
    SELECT id, full_name, email, payment_status, ticket_email_sent_at, ticket_revoked_at
    FROM registrations WHERE id = ${registrationId} LIMIT 1
  `
  if (!rows[0]) {
    return { ok: false, status: 404, error: 'Registration not found.' }
  }
  audit.targetName = rows[0].full_name
  if (rows[0].payment_status !== 'paid') {
    return { ok: false, status: 409, error: 'Registration is not paid.' }
  }

  // A revoked pass may only be re-issued by a superadmin — the same authority
  // that revoked it. Resend is otherwise an admin-level route, so leaving this
  // open would make the superadmin-only revoke reversible by any gate admin
  // (or by a fired one, whose 12h token still passes requireAdmin). Lifting the
  // stamp is deliberate and explicit; it is not a side effect of resending.
  if (rows[0].ticket_revoked_at) {
    if (actor.adminRole !== ROLES.SUPERADMIN) {
      return {
        ok: false,
        status: 403,
        error: 'This pass was revoked by a superadmin. Only a superadmin can issue a new one.',
      }
    }
    await sql`UPDATE registrations SET ticket_revoked_at = NULL WHERE id = ${registrationId}`
  }

  // force:true re-claims + re-sends atomically inside issueTicket (no manual
  // null of the column — that left a window where the row could self-re-email).
  // triggeredBy flows into the email log so a resent pass is distinguishable
  // from the automatic post-payment send.
  const issued = await issueTicket(registrationId, {
    force: true,
    triggeredBy: audit.adminUsername,
  })
  if (!issued.ok) {
    await recordAudit({
      ...audit,
      action: AUDIT_ACTIONS.RESEND_FAILED,
      result: 'failure',
      detail: 'issueTicket returned an error.',
    })
    return { ok: false, status: 502, error: 'Could not resend ticket email.' }
  }
  await recordAudit({
    ...audit,
    action: issued.emailed ? AUDIT_ACTIONS.RESEND_TICKET : AUDIT_ACTIONS.RESEND_FAILED,
    result: issued.emailed ? 'success' : 'failure',
    detail: issued.emailed ? `Pass re-sent to ${rows[0].email}.` : 'Provider did not accept the send.',
  })
  return { ok: true, status: 200, emailed: issued.emailed === true }
}

/**
 * Kill a generated QR pass. Superadmin-only — the route layer gates with
 * requireSuperAdmin() before calling in.
 *
 * Nulling ticket_jti is what invalidates the pass: checkInTicket matches the
 * exact jti inside the scanned token, so every previously emailed QR for this
 * registration stops scanning the moment the row's jti is gone. The email-sent
 * stamp is cleared with it, so a superadmin "Resend pass" mints a FRESH jti
 * (see ensureTicketJti) and emails a brand-new QR immediately — no cooldown
 * fight.
 *
 * ticket_revoked_at is what makes the revoke STICK. Clearing the jti alone
 * returns the row to "paid, never issued", which is exactly the state every
 * idempotent re-issue path treats as "mint one": settlePayment's already-paid
 * branch (reachable forever by replaying the payment/verify triple the buyer's
 * own browser holds — no admin, no auth) and resendTicket (admin-level). The
 * stamp blocks both; only resendTicket's superadmin branch lifts it.
 *
 * A check-in that already happened is deliberately left untouched: revoking a
 * pass is not un-attending the event, and the gate history must stay true.
 */
export async function revokeTicket({ registrationId, actor = {}, context = {} }) {
  const audit = {
    adminId: actor.adminId,
    adminUsername: actor.adminUsername || 'unknown',
    adminRole: actor.adminRole,
    targetType: 'registration',
    targetId: typeof registrationId === 'string' ? registrationId : null,
    ip: context.ip,
    userAgent: context.userAgent,
  }

  if (!registrationId) {
    return { ok: false, status: 400, error: 'Missing registration id.' }
  }
  // Same uuid shape gate as resendTicket — a malformed id must be a 400, not a
  // thrown Postgres error surfacing as a 500. See isUuid().
  if (!isUuid(registrationId)) {
    return { ok: false, status: 400, error: 'Invalid registration id.' }
  }

  const sql = getSql()
  const rows = await sql`
    SELECT id, full_name, email, ticket_jti FROM registrations
    WHERE id = ${registrationId} LIMIT 1
  `
  if (!rows[0]) {
    return { ok: false, status: 404, error: 'Registration not found.' }
  }
  audit.targetName = rows[0].full_name
  if (!rows[0].ticket_jti) {
    return { ok: false, status: 409, error: 'No QR pass has been issued for this registration.' }
  }

  // The jti guard makes concurrent revokes converge: only one matches a row,
  // the loser reads as already-revoked rather than double-logging.
  const updated = await sql`
    UPDATE registrations
    SET ticket_jti = NULL, ticket_issued_at = NULL, ticket_email_sent_at = NULL,
        ticket_revoked_at = NOW()
    WHERE id = ${registrationId} AND ticket_jti IS NOT NULL
    RETURNING id, full_name, email
  `
  if (!updated.length) {
    return { ok: false, status: 409, error: 'No QR pass has been issued for this registration.' }
  }

  await recordAudit({
    ...audit,
    action: AUDIT_ACTIONS.TICKET_REVOKED,
    detail: `QR pass invalidated for ${updated[0].email}. Resend issues a new one.`,
  })
  return { ok: true, status: 200, registration: { id: updated[0].id, ticketIssued: false } }
}

// --- College roll numbers -----------------------------------------------------
//
// The public form never asks for a roll number — requiring one would block the
// guests, speakers and outside attendees who are not students. The college still
// needs its attendance tied to its own student IDs, so an organiser links them
// afterwards by typing part of a name and filling in the number.

const ROLL_SEARCH_MIN = 2
const ROLL_SEARCH_LIMIT = 25
// Long enough for any institutional format, short enough that a pasted line of
// a spreadsheet row is rejected rather than silently stored as an ID.
const ROLL_NUMBER_MAX = 32

/**
 * Type-ahead over registrant names for the roll-number screen.
 *
 * Matches name OR email: an organiser working from a college list often has the
 * address and not the exact spelling of the name. Returns the roll number
 * already on file so the caller can show what is linked and what is still blank
 * without a second query.
 */
export async function searchRegistrants({ q } = {}) {
  const term = String(q ?? '').trim()
  if (term.length < ROLL_SEARCH_MIN) {
    return { ok: true, status: 200, registrants: [] }
  }
  const sql = getSql()
  // Escape the LIKE metacharacters so a name containing % or _ searches for the
  // literal character instead of turning into a wildcard that matches everyone.
  const pattern = `%${term.replace(/[\\%_]/g, (ch) => `\\${ch}`)}%`
  const rows = await sql`
    SELECT id, full_name, email, phone, college, college_other,
           payment_status, roll_number, checked_in_at
    FROM registrations
    WHERE full_name ILIKE ${pattern} ESCAPE '\'
       OR email ILIKE ${pattern} ESCAPE '\'
    ORDER BY
      -- Rows still missing a roll number first: this screen exists to fill the
      -- blanks, so the work left to do sorts above what is already done.
      (roll_number IS NOT NULL),
      full_name ASC
    LIMIT ${ROLL_SEARCH_LIMIT}
  `
  return { ok: true, status: 200, registrants: rows }
}

/**
 * Link (or clear) one registrant's college roll number.
 *
 * Passing an empty value unlinks, which is the only way to correct a number
 * typed onto the wrong person — the unique index would otherwise refuse to let
 * that number be attached to whoever actually owns it.
 */
export async function setRollNumber({ registrationId, rollNumber }, actor = {}, context = {}) {
  const audit = {
    adminId: actor.adminId,
    adminUsername: actor.adminUsername || 'unknown',
    adminRole: actor.adminRole,
    targetType: 'registration',
    targetId: typeof registrationId === 'string' ? registrationId : null,
    ip: context.ip,
    userAgent: context.userAgent,
  }

  if (!isUuid(registrationId)) {
    return { ok: false, status: 400, error: 'Invalid registration id.' }
  }

  const raw = String(rollNumber ?? '').trim()
  // Stored uppercase so "20BCE1234" and "20bce1234" cannot both exist as
  // separate rows and defeat the uniqueness the index is there to guarantee.
  const value = raw === '' ? null : raw.toUpperCase()
  if (value !== null && value.length > ROLL_NUMBER_MAX) {
    return { ok: false, status: 400, error: `A roll number cannot be longer than ${ROLL_NUMBER_MAX} characters.` }
  }

  const sql = getSql()
  const existing = await sql`
    SELECT id, full_name, roll_number FROM registrations WHERE id = ${registrationId} LIMIT 1
  `
  if (!existing[0]) {
    return { ok: false, status: 404, error: 'Registration not found.' }
  }
  audit.targetName = existing[0].full_name

  // Checked before the write so the conflict can name the other person. The
  // unique index still backstops a concurrent double-link below; this exists to
  // turn that raw 23505 into something an organiser can act on.
  if (value !== null) {
    const clash = await sql`
      SELECT id, full_name FROM registrations
      WHERE roll_number = ${value} AND id <> ${registrationId} LIMIT 1
    `
    if (clash[0]) {
      return {
        ok: false,
        status: 409,
        error: `${value} is already linked to ${clash[0].full_name}. Clear it there first if this is the correction.`,
      }
    }
  }

  try {
    const updated = await sql`
      UPDATE registrations SET roll_number = ${value}
      WHERE id = ${registrationId}
      RETURNING id, full_name, roll_number
    `
    await recordAudit({
      ...audit,
      action: AUDIT_ACTIONS.ROLL_NUMBER_LINKED,
      detail: value
        ? `Roll number ${value} linked${existing[0].roll_number ? ` (was ${existing[0].roll_number})` : ''}.`
        : `Roll number ${existing[0].roll_number ?? '—'} cleared.`,
    })
    return { ok: true, status: 200, registrant: updated[0] }
  } catch (err) {
    // Lost the race against a concurrent link of the same number.
    if (String(err?.code) === '23505') {
      return { ok: false, status: 409, error: `${value} was just linked to someone else. Refresh and check.` }
    }
    throw err
  }
}
