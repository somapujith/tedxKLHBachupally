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
// Pass price in whole rupees, shown on the bank-QR screen.
//
// The rate rises to ₹599 at midnight on 13 Aug 2026. This is a SCHEDULE, not a
// cron job or a one-off write, because the cutover has to survive things a job
// cannot: a redeploy at 23:59, a cold serverless instance booting at 00:01, a
// missed run. Every process that asks for the price derives the same answer
// from the same clock, so there is no moment where two instances disagree about
// what a seat costs.
//
// Entries are ordered oldest first; the last one whose `from` has passed wins.
// A superadmin's app_settings override still beats this outright — the schedule
// is the default, not a ceiling.
const PASS_PRICE_SCHEDULE = [
  { from: '2026-01-01T00:00:00+05:30', price: 449 },
  { from: '2026-08-13T00:00:00+05:30', price: 599 },
]

// `now` is injectable so tests can stand either side of the cutover without
// touching the system clock.
export function scheduledPassPrice(now = new Date()) {
  const t = now.getTime()
  let price = PASS_PRICE_SCHEDULE[0].price
  for (const entry of PASS_PRICE_SCHEDULE) {
    if (new Date(entry.from).getTime() <= t) price = entry.price
  }
  return price
}

const PASS_PRICE_KEY = 'pass_price'
const MAX_PASS_PRICE = 1000000
const REGISTRATION_OPEN_OVERRIDE_KEY = 'registration_open_override'
const REGISTRATION_OPENS_AT = '2026-08-05T07:00:00+05:30'
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
 * read sits between an admin approving a payment and the row flipping to paid,
 * so a throw here means a buyer who has really paid ends up with no ticket. The
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

// Same "a malformed row counts as absent" rule as capacity, so a hand-edited or
// blanked value degrades to the default instead of pricing the pass at ₹0.
function parseStoredPrice(value) {
  if (typeof value !== 'string' && typeof value !== 'number') return null
  if (typeof value === 'string' && value.trim() === '') return null
  const n = Number(value)
  return Number.isInteger(n) && n >= 0 && n <= MAX_PASS_PRICE ? n : null
}

let lastKnownPrice = null
let lastKnownRegistrationOpenOverride = null

function registrationOpensAt() {
  return REGISTRATION_OPENS_AT
}

function registrationsScheduledOpen() {
  const at = Date.parse(REGISTRATION_OPENS_AT)
  return Number.isFinite(at) ? Date.now() >= at : true
}

function parseStoredRegistrationOpenOverride(value) {
  if (typeof value !== 'string' && typeof value !== 'number' && typeof value !== 'boolean') return null
  if (typeof value === 'string' && value.trim() === '') return null
  const v = String(value).trim().toLowerCase()
  if (v === 'true' || v === '1') return true
  if (v === 'false' || v === '0') return false
  return null
}

// Never throws, for the same reason getSeatCapacity does not: this read sits on
// the public register page, and a settings blip must not dark the pay screen.
export async function getPassPrice(sql = getSql()) {
  try {
    await withDbRetry(() => ensureSettings(sql))
    const rows = await withDbRetry(
      () => sql`SELECT value FROM app_settings WHERE key = ${PASS_PRICE_KEY} LIMIT 1`,
    )
    const stored = parseStoredPrice(rows[0]?.value)
    lastKnownPrice = stored
    // A superadmin's explicit override wins; otherwise the schedule decides.
    return stored ?? scheduledPassPrice()
  } catch (err) {
    console.error('Pass price read failed; using last known value:', err?.message || err)
    return lastKnownPrice ?? scheduledPassPrice()
  }
}

// Flat ₹449 for students at TEDxKLH's own campuses, regardless of where the
// schedule/override above has the general public price. Kept as an override
// applied on top of getPassPrice rather than a schedule entry, since it turns
// on a registrant attribute (designation + campus), not a date.
export const KLH_STUDENT_CAMPUSES = ['KLH Bachupally Campus', 'KL GBS Campus', 'KL Aziz Nagar Campus']
export const KLH_STUDENT_PRICE = 449

export function resolvePassPrice(listPrice, { designation, college } = {}) {
  if (designation === 'student' && KLH_STUDENT_CAMPUSES.includes(college)) {
    return KLH_STUDENT_PRICE
  }
  return listPrice
}

export async function updatePassPrice({ price }, actor = {}, context = {}) {
  const n =
    typeof price === 'number'
      ? price
      : typeof price === 'string' && price.trim() !== ''
        ? Number(price)
        : NaN
  if (!Number.isInteger(n) || n < 0 || n > MAX_PASS_PRICE) {
    return {
      ok: false,
      status: 400,
      error: `Price must be a whole number between 0 and ${MAX_PASS_PRICE}.`,
    }
  }

  const sql = getSql()
  await ensureSettings(sql)
  const before = await getPassPrice(sql)

  await sql`
    INSERT INTO app_settings (key, value, updated_at, updated_by)
    VALUES (${PASS_PRICE_KEY}, ${String(n)}, NOW(), ${actor.adminUsername || null})
    ON CONFLICT (key) DO UPDATE
    SET value = EXCLUDED.value, updated_at = NOW(), updated_by = EXCLUDED.updated_by
  `

  await recordAudit({
    adminId: actor.adminId,
    adminUsername: actor.adminUsername || 'unknown',
    adminRole: actor.adminRole,
    action: AUDIT_ACTIONS.PRICE_UPDATED,
    targetType: 'setting',
    targetId: PASS_PRICE_KEY,
    targetName: 'Pass price',
    detail: `Price ₹${before} -> ₹${n}.`,
    ip: context.ip,
    userAgent: context.userAgent,
  })

  return { ok: true, status: 200, passPrice: n }
}

export async function getRegistrationStatus(sql = getSql()) {
  try {
    await withDbRetry(() => ensureSettings(sql))
    const rows = await withDbRetry(
      () => sql`SELECT value, updated_at, updated_by FROM app_settings WHERE key = ${REGISTRATION_OPEN_OVERRIDE_KEY} LIMIT 1`,
    )
    const stored = parseStoredRegistrationOpenOverride(rows[0]?.value)
    lastKnownRegistrationOpenOverride = stored
    return {
      open: stored === true || registrationsScheduledOpen(),
      opensAt: registrationOpensAt(),
      overridden: stored === true,
      updatedAt: rows[0]?.updated_at ?? null,
      updatedBy: rows[0]?.updated_by ?? null,
    }
  } catch (err) {
    console.error('Registration-open read failed; using last known value:', err?.message || err)
    return {
      open: lastKnownRegistrationOpenOverride === true || registrationsScheduledOpen(),
      opensAt: registrationOpensAt(),
      overridden: lastKnownRegistrationOpenOverride === true,
      updatedAt: null,
      updatedBy: null,
    }
  }
}

function settingsPayload({
  override,
  paid,
  updatedAt = null,
  updatedBy = null,
  registrationOpen = registrationsScheduledOpen(),
  registrationOpenOverridden = false,
  registrationUpdatedAt = null,
  registrationUpdatedBy = null,
}) {
  return {
    seatCapacity: override ?? seatCapacity(),
    overridden: override !== null,
    fallbackCapacity: seatCapacity(),
    paid,
    updatedAt,
    updatedBy,
    registrationOpen,
    registrationOpensAt: registrationOpensAt(),
    registrationOpenOverridden,
    registrationUpdatedAt,
    registrationUpdatedBy,
  }
}

// Superadmin read: the effective capacity plus enough context for the UI to
// warn — how many seats are already sold, and whether the value is a custom
// override or the deploy-time fallback.
export async function getSettings() {
  const sql = getSql()
  await ensureSettings(sql)
  const rows = await sql`
    SELECT key, value, updated_at, updated_by FROM app_settings
    WHERE key IN (${SEAT_CAPACITY_KEY}, ${REGISTRATION_OPEN_OVERRIDE_KEY})
  `
  const byKey = new Map(rows.map((row) => [row.key, row]))
  const setting = byKey.get(SEAT_CAPACITY_KEY)
  const registrationSetting = byKey.get(REGISTRATION_OPEN_OVERRIDE_KEY)
  const [count] = await sql`
    SELECT COUNT(*)::int AS paid FROM registrations WHERE payment_status = 'paid'
  `
  const registrationOverride = parseStoredRegistrationOpenOverride(registrationSetting?.value)
  return {
    ok: true,
    status: 200,
    settings: settingsPayload({
      override: parseStoredCapacity(setting?.value),
      paid: count?.paid ?? 0,
      updatedAt: setting?.updated_at ?? null,
      updatedBy: setting?.updated_by ?? null,
      registrationOpen: registrationOverride === true || registrationsScheduledOpen(),
      registrationOpenOverridden: registrationOverride === true,
      registrationUpdatedAt: registrationSetting?.updated_at ?? null,
      registrationUpdatedBy: registrationSetting?.updated_by ?? null,
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

export async function updateRegistrationOpenOverride({ forceOpen }, actor = {}, context = {}) {
  if (typeof forceOpen !== 'boolean') {
    return { ok: false, status: 400, error: 'registrationOpenOverride must be true or false.' }
  }

  const sql = getSql()
  await ensureSettings(sql)
  const before = await getRegistrationStatus(sql)

  if (forceOpen) {
    await sql`
      INSERT INTO app_settings (key, value, updated_at, updated_by)
      VALUES (${REGISTRATION_OPEN_OVERRIDE_KEY}, 'true', NOW(), ${actor.adminUsername || null})
      ON CONFLICT (key) DO UPDATE
      SET value = EXCLUDED.value, updated_at = NOW(), updated_by = EXCLUDED.updated_by
    `
  } else {
    await sql`DELETE FROM app_settings WHERE key = ${REGISTRATION_OPEN_OVERRIDE_KEY}`
  }

  await recordAudit({
    adminId: actor.adminId,
    adminUsername: actor.adminUsername || 'unknown',
    adminRole: actor.adminRole,
    action: AUDIT_ACTIONS.REGISTRATION_ACCESS_UPDATED,
    targetType: 'setting',
    targetId: REGISTRATION_OPEN_OVERRIDE_KEY,
    targetName: 'Registration access',
    detail: forceOpen
      ? `Registrations opened early. Scheduled opening remains ${registrationOpensAt()}.`
      : `Manual early-open cleared; registrations follow the scheduled opening (${registrationOpensAt()}).`,
    ip: context.ip,
    userAgent: context.userAgent,
  })

  const [capacitySetting] = await sql`
    SELECT value FROM app_settings WHERE key = ${SEAT_CAPACITY_KEY} LIMIT 1
  `
  const [count] = await sql`
    SELECT COUNT(*)::int AS paid FROM registrations WHERE payment_status = 'paid'
  `

  return {
    ok: true,
    status: 200,
    settings: settingsPayload({
      override: parseStoredCapacity(capacitySetting?.value),
      paid: count?.paid ?? 0,
      registrationOpen: forceOpen || registrationsScheduledOpen(),
      registrationOpenOverridden: forceOpen,
      registrationUpdatedBy: actor.adminUsername || null,
    }),
    previousRegistrationOpen: before.open,
  }
}
