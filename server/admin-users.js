// Admin account management. Every function here is superadmin-only — the route
// layer gates with requireSuperAdmin() before calling in.
//
// Two invariants are enforced in code rather than left to the caller, because
// violating either one locks the event out of its own admin panel mid-event:
//
//   1. The last active superadmin can never be demoted or deactivated.
//   2. A superadmin can never demote or deactivate THEMSELVES, even when another
//      superadmin exists — an accidental self-demotion is the likeliest way to
//      lose access, and it is trivially avoidable.

import bcrypt from 'bcryptjs'
import { getSql, isUuid, ensureAdminsTable } from './db.js'
import { ROLES } from './admin.js'
import { recordAudit, AUDIT_ACTIONS } from './audit.js'

const USERNAME_RE = /^[a-z0-9._-]{3,40}$/
const MIN_PASSWORD = 8
const MAX_PASSWORD = 200
const BCRYPT_ROUNDS = 10

// Schema is ensured lazily here (not in the hot public path) — same reasoning as
// server/audit.js. Memoized per cold start; a failure is not cached.
let adminsReady = null
function ensureAdmins(sql) {
  if (adminsReady) return adminsReady
  adminsReady = ensureAdminsTable(sql).catch((err) => {
    adminsReady = null
    throw err
  })
  return adminsReady
}

function validRole(value) {
  return value === ROLES.ADMIN || value === ROLES.SUPERADMIN
}

// Shape checks run before any query so a malformed payload is a 400, never a
// thrown Postgres error surfacing as a 500 (same reasoning as the isUuid gates).
function validateNewAdmin({ username, password, displayName, role }) {
  const user = String(username || '').trim().toLowerCase()
  const pass = String(password || '')
  const name = String(displayName || '').trim()

  if (!USERNAME_RE.test(user)) {
    return { error: 'Username must be 3-40 characters: letters, numbers, dot, dash or underscore.' }
  }
  if (pass.length < MIN_PASSWORD || pass.length > MAX_PASSWORD) {
    return { error: `Password must be between ${MIN_PASSWORD} and ${MAX_PASSWORD} characters.` }
  }
  if (name.length < 2 || name.length > 80) {
    return { error: 'Display name must be between 2 and 80 characters.' }
  }
  if (!validRole(role)) {
    return { error: 'Role must be admin or superadmin.' }
  }
  return { user, pass, name, role }
}

// Rows never include password_hash — not even for a superadmin. No screen needs
// it, and a hash in a JSON response is a hash in a browser cache, a proxy log,
// and a screenshot. `scans` joins on display_name because that is what the
// check-in path writes into registrations.checked_in_by.
export async function listAdmins() {
  const sql = getSql()
  await ensureAdmins(sql)
  const rows = await sql`
    SELECT a.id, a.username, a.display_name, a.role, a.is_active,
           a.last_login_at, a.created_at, a.created_by,
           (SELECT COUNT(*)::int FROM registrations r WHERE r.checked_in_by = a.display_name) AS scans
    FROM admins a
    ORDER BY a.role DESC, LOWER(a.username)
  `
  return { ok: true, status: 200, admins: rows }
}

export async function createAdmin(
  { username, password, displayName, role = ROLES.ADMIN },
  actor = {},
  context = {},
) {
  const parsed = validateNewAdmin({ username, password, displayName, role })
  if (parsed.error) {
    return { ok: false, status: 400, error: parsed.error }
  }

  const sql = getSql()
  await ensureAdmins(sql)

  const existing = await sql`SELECT id FROM admins WHERE LOWER(username) = ${parsed.user} LIMIT 1`
  if (existing[0]) {
    return { ok: false, status: 409, error: 'That username is already taken.' }
  }

  const passwordHash = await bcrypt.hash(parsed.pass, BCRYPT_ROUNDS)
  const rows = await sql`
    INSERT INTO admins (username, password_hash, display_name, role, created_by)
    VALUES (${parsed.user}, ${passwordHash}, ${parsed.name}, ${parsed.role}, ${actor.adminUsername || null})
    RETURNING id, username, display_name, role, is_active, created_at
  `

  await recordAudit({
    adminId: actor.adminId,
    adminUsername: actor.adminUsername || 'unknown',
    adminRole: actor.adminRole,
    action: AUDIT_ACTIONS.ADMIN_CREATED,
    targetType: 'admin',
    targetId: rows[0].id,
    targetName: rows[0].username,
    detail: `Created as ${rows[0].role}.`,
    ip: context.ip,
    userAgent: context.userAgent,
  })
  return { ok: true, status: 201, admin: rows[0] }
}

/**
 * Update a display name, password and/or role. Every field is optional; only
 * the ones present are written (COALESCE keeps the rest untouched).
 */
export async function updateAdmin({ id, displayName, password, role }, actor = {}, context = {}) {
  if (!isUuid(id)) {
    return { ok: false, status: 400, error: 'Invalid admin id.' }
  }

  const sql = getSql()
  await ensureAdmins(sql)
  const rows = await sql`
    SELECT id, username, display_name, role, is_active FROM admins WHERE id = ${id} LIMIT 1
  `
  const target = rows[0]
  if (!target) {
    return { ok: false, status: 404, error: 'Admin not found.' }
  }

  const nextName = displayName === undefined ? null : String(displayName).trim()
  const nextPass = password === undefined ? null : String(password)
  const nextRole = role === undefined ? null : String(role)

  if (nextName !== null && (nextName.length < 2 || nextName.length > 80)) {
    return { ok: false, status: 400, error: 'Display name must be between 2 and 80 characters.' }
  }
  if (nextPass !== null && (nextPass.length < MIN_PASSWORD || nextPass.length > MAX_PASSWORD)) {
    return {
      ok: false,
      status: 400,
      error: `Password must be between ${MIN_PASSWORD} and ${MAX_PASSWORD} characters.`,
    }
  }
  if (nextRole !== null && !validRole(nextRole)) {
    return { ok: false, status: 400, error: 'Role must be admin or superadmin.' }
  }

  // Invariants 1 and 2 — see the file header.
  const demoting = nextRole === ROLES.ADMIN && target.role === ROLES.SUPERADMIN
  if (demoting && actor.adminId === target.id) {
    return { ok: false, status: 409, error: 'You cannot remove your own superadmin role.' }
  }

  // Invariant 3: a superadmin's password may only be set by that superadmin.
  // Guarding `role` while leaving the credential open would be theatre — anyone
  // who could reset a peer's password could simply log in AS them and hold the
  // role that way, permanently, surviving both token expiry and a later demotion.
  if (
    nextPass !== null &&
    target.role === ROLES.SUPERADMIN &&
    target.is_active &&
    actor.adminId !== target.id
  ) {
    return {
      ok: false,
      status: 409,
      error: 'Another superadmin must change their own password.',
    }
  }

  const passwordHash = nextPass === null ? null : await bcrypt.hash(nextPass, BCRYPT_ROUNDS)
  // The last-superadmin check lives INSIDE the UPDATE, not in a preceding
  // SELECT. Every Neon call is a separate HTTP round-trip, so a check-then-write
  // pair leaves a window in which two concurrent demotions each see the other as
  // "the remaining superadmin" and both succeed — locking the panel out entirely.
  // Postgres evaluates this subquery against the same snapshot as the write, so
  // one of the two racers matches zero rows and gets the 409 below.
  const updated = await sql`
    UPDATE admins SET
      display_name  = COALESCE(${nextName}, display_name),
      password_hash = COALESCE(${passwordHash}, password_hash),
      role          = COALESCE(${nextRole}, role)
    WHERE id = ${id}
      AND (
        ${demoting} = FALSE
        OR EXISTS (
          SELECT 1 FROM admins peer
          WHERE peer.role = 'superadmin' AND peer.is_active = TRUE AND peer.id <> ${id}
        )
      )
    RETURNING id, username, display_name, role, is_active, last_login_at, created_at
  `
  if (!updated.length) {
    return { ok: false, status: 409, error: 'At least one active superadmin must remain.' }
  }

  const changed = [
    nextName !== null && 'display name',
    passwordHash !== null && 'password',
    nextRole !== null && `role -> ${nextRole}`,
  ].filter(Boolean)

  await recordAudit({
    adminId: actor.adminId,
    adminUsername: actor.adminUsername || 'unknown',
    adminRole: actor.adminRole,
    action: AUDIT_ACTIONS.ADMIN_UPDATED,
    targetType: 'admin',
    targetId: target.id,
    targetName: target.username,
    detail: changed.length ? `Changed ${changed.join(', ')}.` : 'No fields changed.',
    ip: context.ip,
    userAgent: context.userAgent,
  })
  return { ok: true, status: 200, admin: updated[0] }
}

/**
 * Deactivate or reactivate an account. Deactivation is used instead of DELETE so
 * the audit trail keeps a resolvable identity for every scan that admin made.
 */
export async function setAdminActive({ id, isActive }, actor = {}, context = {}) {
  if (!isUuid(id)) {
    return { ok: false, status: 400, error: 'Invalid admin id.' }
  }
  if (typeof isActive !== 'boolean') {
    return { ok: false, status: 400, error: 'isActive must be true or false.' }
  }

  const sql = getSql()
  await ensureAdmins(sql)
  const rows = await sql`
    SELECT id, username, display_name, role, is_active FROM admins WHERE id = ${id} LIMIT 1
  `
  const target = rows[0]
  if (!target) {
    return { ok: false, status: 404, error: 'Admin not found.' }
  }

  if (!isActive && actor.adminId === target.id) {
    return { ok: false, status: 409, error: 'You cannot deactivate your own account.' }
  }

  // Same atomic guard as updateAdmin: two superadmins deactivating each other at
  // the same moment must not both succeed. Only a deactivation of a superadmin
  // needs the check, so the condition short-circuits for every other case.
  const guarded = !isActive && target.role === ROLES.SUPERADMIN
  const updated = await sql`
    UPDATE admins SET is_active = ${isActive}
    WHERE id = ${id}
      AND (
        ${guarded} = FALSE
        OR EXISTS (
          SELECT 1 FROM admins peer
          WHERE peer.role = 'superadmin' AND peer.is_active = TRUE AND peer.id <> ${id}
        )
      )
    RETURNING id, username, display_name, role, is_active, last_login_at, created_at
  `
  if (!updated.length) {
    return { ok: false, status: 409, error: 'At least one active superadmin must remain.' }
  }

  await recordAudit({
    adminId: actor.adminId,
    adminUsername: actor.adminUsername || 'unknown',
    adminRole: actor.adminRole,
    action: isActive ? AUDIT_ACTIONS.ADMIN_REACTIVATED : AUDIT_ACTIONS.ADMIN_DEACTIVATED,
    targetType: 'admin',
    targetId: target.id,
    targetName: target.username,
    ip: context.ip,
    userAgent: context.userAgent,
  })
  return { ok: true, status: 200, admin: updated[0] }
}
