// Runtime-editable event settings. Writes are superadmin-only (gated at the
// route layer); reads feed the public payment path, so they must stay cheap
// and must never widen what a bad row can break.
//
// Seat capacity resolution order: DB override -> SEAT_CAPACITY env -> 250.
// The DB value wins so a superadmin can move the cap mid-sale without a
// redeploy; clearing the override falls straight back to the env/default.

import { getSql, withDbRetry, ensureSettingsTable } from './db.js'
import { recordAudit, AUDIT_ACTIONS } from './audit.js'

const DEFAULT_SEAT_CAPACITY = 250
const SEAT_CAPACITY_KEY = 'seat_capacity'
// Sanity ceiling, not a business rule — it stops a pasted phone number from
// becoming the cap. 0 stays legal: it means the event is closed.
const MAX_SEAT_CAPACITY = 100000

// Parse SEAT_CAPACITY defensively: `Number(env) || 250` would turn a legit 0
// (event closed) and NaN into 250. Accept only a finite, non-negative number.
// A BLANK var falls back too: Number('') is 0, so a dashboard field left empty
// would otherwise silently read as "event closed" and dark the register page.
// Explicit '0' still closes the event.
export function seatCapacity() {
  const raw = process.env.SEAT_CAPACITY
  if (raw === undefined || String(raw).trim() === '') return DEFAULT_SEAT_CAPACITY
  const n = Number(raw)
  return Number.isFinite(n) && n >= 0 ? n : DEFAULT_SEAT_CAPACITY
}

// Same lazy-DDL pattern as server/audit.js: the payment path pays the CREATE
// TABLE once per cold start, memoized; a failed attempt is not cached.
let settingsReady = null
function ensureSettings(sql) {
  if (settingsReady) return settingsReady
  settingsReady = ensureSettingsTable(sql).catch((err) => {
    settingsReady = null
    throw err
  })
  return settingsReady
}

// A stored value only counts when it parses back to a legal capacity. A
// malformed row (hand-edited, or written before validation existed) is treated
// as absent, so the fallback chain still yields a sane number.
//
// The empty/whitespace check is NOT redundant: Number('') and Number('  ') are
// both 0, so without it a blanked-out row would read as a legal "0 = event
// closed" and freeze all sales, which is the opposite of degrading safely.
function parseStoredCapacity(value) {
  if (typeof value !== 'string' && typeof value !== 'number') return null
  if (typeof value === 'string' && value.trim() === '') return null
  const n = Number(value)
  return Number.isInteger(n) && n >= 0 && n <= MAX_SEAT_CAPACITY ? n : null
}

// Last value successfully read from the DB, kept per instance so a later read
// failure degrades to the most recent real override rather than to the env
// value.
// Falling back to env would silently RAISE a deliberately lowered cap, which is
// the one failure mode that oversells the event.
let lastKnownCapacity = null

/**
 * The capacity every seat gate uses (createOrder, settlePayment, getStats).
 *
 * Never throws. This is deliberate and specific to the settlement path: this
 * read sits between "Razorpay captured the money" and "flip the row to paid",
 * so a throw here means a charged buyer with no ticket and — via the webhook,
 * which has no try/catch around settlePayment — a Razorpay retry storm. The
 * write that follows needs the database anyway, so a genuinely dead DB still
 * fails loudly one statement later; swallowing here only covers the case where
 * the settings read alone is broken (a missing DDL grant on app_settings,
 * a blip on this one query), where the correct answer is the last known cap.
 */
export async function getSeatCapacity(sql = getSql()) {
  try {
    await withDbRetry(() => ensureSettings(sql))
    const rows = await withDbRetry(
      () => sql`SELECT value FROM app_settings WHERE key = ${SEAT_CAPACITY_KEY} LIMIT 1`,
    )
    const stored = parseStoredCapacity(rows[0]?.value)
    lastKnownCapacity = stored
    return stored ?? seatCapacity()
  } catch (err) {
    console.error('Seat capacity read failed; using last known value:', err?.message || err)
    return lastKnownCapacity ?? seatCapacity()
  }
}

function settingsPayload({ override, paid, updatedAt = null, updatedBy = null }) {
  return {
    seatCapacity: override ?? seatCapacity(),
    overridden: override !== null,
    fallbackCapacity: seatCapacity(),
    paid,
    updatedAt,
    updatedBy,
  }
}

// Superadmin read: the effective capacity plus enough context for the UI to
// warn — how many seats are already sold, and whether the value is a custom
// override or the deploy-time fallback.
export async function getSettings() {
  const sql = getSql()
  await ensureSettings(sql)
  const [setting] = await sql`
    SELECT value, updated_at, updated_by FROM app_settings
    WHERE key = ${SEAT_CAPACITY_KEY} LIMIT 1
  `
  const [count] = await sql`
    SELECT COUNT(*)::int AS paid FROM registrations WHERE payment_status = 'paid'
  `
  return {
    ok: true,
    status: 200,
    settings: settingsPayload({
      override: parseStoredCapacity(setting?.value),
      paid: count?.paid ?? 0,
      updatedAt: setting?.updated_at ?? null,
      updatedBy: setting?.updated_by ?? null,
    }),
  }
}

/**
 * Set or clear the seat-capacity override. `capacity: null` clears it (back to
 * env/default); anything else must be a whole number within sanity bounds —
 * validated before any query, so a bad payload is a 400, never a thrown cast.
 *
 * Lowering the cap below the current paid count is deliberately allowed: it
 * closes further sales immediately (the event reads as sold out) without
 * touching anyone who already paid. The response carries `paid` so the UI can
 * say exactly that.
 */
export async function updateSeatCapacity({ capacity }, actor = {}, context = {}) {
  const clearing = capacity === null
  // Only a number or a non-empty numeric string counts. Number() alone would
  // quietly coerce '' and [] to 0 (event closed!) and true to 1 — a fat-fingered
  // payload must be a 400, never an accidental sales freeze.
  const n =
    typeof capacity === 'number'
      ? capacity
      : typeof capacity === 'string' && capacity.trim() !== ''
        ? Number(capacity)
        : NaN
  if (!clearing && (!Number.isInteger(n) || n < 0 || n > MAX_SEAT_CAPACITY)) {
    return {
      ok: false,
      status: 400,
      error: `Capacity must be a whole number between 0 and ${MAX_SEAT_CAPACITY}.`,
    }
  }

  const sql = getSql()
  await ensureSettings(sql)
  const before = await getSeatCapacity(sql)

  if (clearing) {
    await sql`DELETE FROM app_settings WHERE key = ${SEAT_CAPACITY_KEY}`
  } else {
    await sql`
      INSERT INTO app_settings (key, value, updated_at, updated_by)
      VALUES (${SEAT_CAPACITY_KEY}, ${String(n)}, NOW(), ${actor.adminUsername || null})
      ON CONFLICT (key) DO UPDATE
      SET value = EXCLUDED.value, updated_at = NOW(), updated_by = EXCLUDED.updated_by
    `
  }

  const after = clearing ? seatCapacity() : n
  const [count] = await sql`
    SELECT COUNT(*)::int AS paid FROM registrations WHERE payment_status = 'paid'
  `

  await recordAudit({
    adminId: actor.adminId,
    adminUsername: actor.adminUsername || 'unknown',
    adminRole: actor.adminRole,
    action: AUDIT_ACTIONS.CAPACITY_UPDATED,
    targetType: 'setting',
    targetId: SEAT_CAPACITY_KEY,
    targetName: 'Seat capacity',
    detail: clearing
      ? `Override cleared; capacity back to ${after}.`
      : `Capacity ${before} -> ${after}.`,
    ip: context.ip,
    userAgent: context.userAgent,
  })

  return {
    ok: true,
    status: 200,
    settings: settingsPayload({
      override: clearing ? null : n,
      paid: count?.paid ?? 0,
      updatedBy: actor.adminUsername || null,
    }),
  }
}
