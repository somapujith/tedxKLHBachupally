// Audit + email logging, and the superadmin statistics that read off them.
//
// Two hard rules hold everywhere in this file:
//
//   1. Writing a log entry MUST NEVER break the action it describes. A check-in
//      at the gate cannot fail because the audit INSERT timed out, so every
//      writer swallows its own error and logs to the console instead. The trail
//      is evidence, not a correctness barrier.
//   2. Reads are superadmin-only and always bounded (capped LIMIT). The audit
//      table grows once per privileged action; an unbounded SELECT would
//      eventually pull the whole event's history into one response.

import { getSql, ensureAuditLogTable, ensureEmailLogTable } from './db.js'

// Action vocabulary. A closed set so the UI can label and filter without
// string-matching free text, and so a typo at a call site is visible.
export const AUDIT_ACTIONS = {
  LOGIN_SUCCESS: 'login_success',
  LOGIN_FAILED: 'login_failed',
  CHECKIN_SUCCESS: 'checkin_success',
  CHECKIN_DUPLICATE: 'checkin_duplicate',
  CHECKIN_REJECTED: 'checkin_rejected',
  RESEND_TICKET: 'resend_ticket',
  RESEND_FAILED: 'resend_failed',
  ADMIN_CREATED: 'admin_created',
  ADMIN_UPDATED: 'admin_updated',
  ADMIN_DEACTIVATED: 'admin_deactivated',
  ADMIN_REACTIVATED: 'admin_reactivated',
  TICKET_REVOKED: 'ticket_revoked',
  CAPACITY_UPDATED: 'capacity_updated',
  REGISTRATION_ACCESS_UPDATED: 'registration_access_updated',
  PRICE_UPDATED: 'price_updated',
  PAYMENT_APPROVED: 'payment_approved',
  PAYMENT_REJECTED: 'payment_rejected',
  SUPPORT_RESOLVED: 'support_resolved',
  SUPPORT_REOPENED: 'support_reopened',
}

const MAX_PAGE = 500
const DEFAULT_PAGE = 100

// The log tables are created on demand rather than in ensureSchemaOnce(): the
// hot public path (register/payment/health) must not pay for DDL it never uses.
// Memoized per cold start; a failure is not cached so the next call retries.
let logSchemaReady = null
function ensureLogSchema(sql) {
  if (logSchemaReady) return logSchemaReady
  logSchemaReady = Promise.all([ensureAuditLogTable(sql), ensureEmailLogTable(sql)]).catch((err) => {
    logSchemaReady = null
    throw err
  })
  return logSchemaReady
}

function clampLimit(value) {
  const n = Number(value)
  if (!Number.isFinite(n) || n <= 0) return DEFAULT_PAGE
  return Math.min(MAX_PAGE, Math.floor(n))
}

// Truncate free-text before it reaches the database. A user agent is
// client-controlled and unbounded; an error message can carry a whole provider
// payload. Neither is worth an unbounded TEXT column full of junk.
function trim(value, max) {
  if (value === null || value === undefined) return null
  const s = String(value)
  if (!s) return null
  return s.length > max ? s.slice(0, max) : s
}

// Request context for an audit row. Same header precedence as the rate limiter
// (clientIp in server/http.js): edge-injected headers first, because a raw
// x-forwarded-for is client-spoofable and would put a forged IP in the trail.
export function requestContext(req) {
  const h = req?.headers || {}
  const pick = (v) => (typeof v === 'string' && v ? v.split(',')[0].trim() : '')
  return {
    ip:
      pick(h['x-vercel-forwarded-for']) ||
      pick(h['x-real-ip']) ||
      pick(h['x-forwarded-for']) ||
      req?.socket?.remoteAddress ||
      null,
    userAgent: pick(h['user-agent']) || null,
  }
}

/**
 * Append one audit row. Never throws and never rejects — see rule 1 above.
 *
 * @param {object} entry
 * @param {string} entry.action        One of AUDIT_ACTIONS.
 * @param {string} entry.adminUsername Who acted ('unknown' for a failed login).
 * @param {string} [entry.adminId]     admins.id when known.
 * @param {string} [entry.adminRole]   Role at the time of the action.
 * @param {'success'|'failure'} [entry.result]
 * @param {string} [entry.targetType]  'registration' | 'admin'
 * @param {string} [entry.targetId]
 * @param {string} [entry.targetName]  Attendee/admin name, copied in at write time.
 * @param {string} [entry.detail]      Short human-readable reason.
 * @param {string} [entry.ip]
 * @param {string} [entry.userAgent]
 */
export async function recordAudit(entry) {
  try {
    const sql = getSql()
    await ensureLogSchema(sql)
    await sql`
      INSERT INTO admin_audit_log
        (admin_id, admin_username, admin_role, action, result,
         target_type, target_id, target_name, detail, ip, user_agent)
      VALUES (
        ${entry.adminId || null},
        ${trim(entry.adminUsername, 120) || 'unknown'},
        ${trim(entry.adminRole, 20)},
        ${trim(entry.action, 40)},
        ${entry.result === 'failure' ? 'failure' : 'success'},
        ${trim(entry.targetType, 20)},
        ${trim(entry.targetId, 80)},
        ${trim(entry.targetName, 160)},
        ${trim(entry.detail, 300)},
        ${trim(entry.ip, 60)},
        ${trim(entry.userAgent, 300)}
      )
    `
  } catch (err) {
    console.error('Audit write failed (action continued):', err?.message || err)
  }
}

/**
 * Append one email-send row. Never throws — a ticket that reached the attendee
 * must not be reported as failed because the log write did.
 */
export async function recordEmail({
  registrationId,
  toEmail,
  fullName,
  emailType = 'ticket',
  status,
  providerMessageId,
  error,
  triggeredBy = 'system',
}) {
  try {
    const sql = getSql()
    await ensureLogSchema(sql)
    await sql`
      INSERT INTO email_log
        (registration_id, to_email, full_name, email_type, status,
         provider_message_id, error, triggered_by)
      VALUES (
        ${registrationId || null},
        ${trim(toEmail, 200) || 'unknown'},
        ${trim(fullName, 160)},
        ${trim(emailType, 30)},
        ${trim(status, 20)},
        ${trim(providerMessageId, 120)},
        ${trim(error, 300)},
        ${trim(triggeredBy, 120) || 'system'}
      )
    `
  } catch (err) {
    console.error('Email log write failed (send continued):', err?.message || err)
  }
}

// --- Reads (superadmin) -------------------------------------------------------

export async function listAuditLog({ action, admin, limit } = {}) {
  const sql = getSql()
  await ensureLogSchema(sql)
  const take = clampLimit(limit)
  const actionFilter = action && action !== 'all' ? String(action) : null
  const adminFilter = admin && admin !== 'all' ? String(admin).toLowerCase() : null

  // Filters arrive from the query string, so they are bound parameters, never
  // concatenated. The NULL-or-match form keeps this one prepared statement
  // instead of four hand-built query variants.
  const rows = await sql`
    SELECT id, admin_id, admin_username, admin_role, action, result,
           target_type, target_id, target_name, detail, ip, user_agent, created_at
    FROM admin_audit_log
    WHERE (${actionFilter}::text IS NULL OR action = ${actionFilter})
      AND (${adminFilter}::text IS NULL OR LOWER(admin_username) = ${adminFilter})
    ORDER BY created_at DESC
    LIMIT ${take}
  `
  return { ok: true, status: 200, entries: rows, limit: take }
}

export async function listEmailLog({ status, limit } = {}) {
  const sql = getSql()
  await ensureLogSchema(sql)
  const take = clampLimit(limit)
  const statusFilter = status && status !== 'all' ? String(status) : null

  const rows = await sql`
    SELECT id, registration_id, to_email, full_name, email_type, status,
           provider_message_id, error, triggered_by, created_at
    FROM email_log
    WHERE (${statusFilter}::text IS NULL OR status = ${statusFilter})
    ORDER BY created_at DESC
    LIMIT ${take}
  `
  return { ok: true, status: 200, entries: rows, limit: take }
}

/**
 * The superadmin statistics block: per-admin scan counts, check-in pace, email
 * delivery health, and login activity. One round-trip — the rollups are
 * subqueries rather than separate calls, so every number on screen describes
 * the same instant rather than drifting between queries.
 */
export async function getSuperStats() {
  const sql = getSql()
  await ensureLogSchema(sql)

  const rows = await sql`
    SELECT
      (SELECT COALESCE(json_agg(a), '[]'::json) FROM (
        SELECT
          r.checked_in_by AS admin,
          COUNT(*)::int AS scans,
          MIN(r.checked_in_at) AS first_scan,
          MAX(r.checked_in_at) AS last_scan
        FROM registrations r
        WHERE r.checked_in_at IS NOT NULL
        GROUP BY r.checked_in_by
        ORDER BY COUNT(*) DESC
      ) a) AS by_admin,

      (SELECT COALESCE(json_agg(h), '[]'::json) FROM (
        SELECT
          to_char(date_trunc('hour', checked_in_at AT TIME ZONE 'Asia/Kolkata'), 'YYYY-MM-DD HH24:00') AS hour,
          COUNT(*)::int AS scans
        FROM registrations
        WHERE checked_in_at IS NOT NULL
        GROUP BY 1 ORDER BY 1
      ) h) AS checkins_by_hour,

      (SELECT COALESCE(json_agg(e), '[]'::json) FROM (
        SELECT status, COUNT(*)::int AS count
        FROM email_log GROUP BY status ORDER BY COUNT(*) DESC
      ) e) AS email_by_status,

      (SELECT COALESCE(json_agg(t), '[]'::json) FROM (
        SELECT triggered_by, COUNT(*)::int AS count
        FROM email_log GROUP BY triggered_by ORDER BY COUNT(*) DESC
      ) t) AS email_by_trigger,

      (SELECT COALESCE(json_agg(x), '[]'::json) FROM (
        SELECT action, COUNT(*)::int AS count
        FROM admin_audit_log GROUP BY action ORDER BY COUNT(*) DESC
      ) x) AS actions_by_type,

      (SELECT COALESCE(json_agg(s), '[]'::json) FROM (
        SELECT id, username, display_name, role, is_active, last_login_at, created_at
        FROM admins ORDER BY role DESC, LOWER(username)
      ) s) AS admins,

      (SELECT COUNT(*)::int FROM admin_audit_log
        WHERE action = 'login_failed' AND created_at > NOW() - INTERVAL '24 hours'
      ) AS failed_logins_24h,

      (SELECT COUNT(*)::int FROM admin_audit_log
        WHERE created_at > NOW() - INTERVAL '1 hour'
      ) AS actions_last_hour
  `

  const s = rows[0]
  return {
    ok: true,
    status: 200,
    superStats: {
      byAdmin: s.by_admin,
      checkinsByHour: s.checkins_by_hour,
      emailByStatus: s.email_by_status,
      emailByTrigger: s.email_by_trigger,
      actionsByType: s.actions_by_type,
      admins: s.admins,
      failedLogins24h: s.failed_logins_24h,
      actionsLastHour: s.actions_last_hour,
    },
  }
}
