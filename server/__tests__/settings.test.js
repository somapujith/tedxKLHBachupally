// @vitest-environment node
// Seat-capacity override and QR revoke. No-DB tests prove validation runs
// before any query (DATABASE_URL removed, so a query would reject loudly);
// DB tests run against the real Neon DB (skipped without DATABASE_URL),
// restore the pre-test seat_capacity row in afterAll so the live cap never
// shifts, and clean up their own tagged rows.
import 'dotenv/config'
import crypto from 'node:crypto'
import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import {
  seatCapacity,
  getSeatCapacity,
  getSettings,
  getRegistrationStatus,
  updateRegistrationOpenOverride,
  updateSeatCapacity,
} from '../settings.js'
import { revokeTicket } from '../admin.js'

const hasDb = Boolean(process.env.DATABASE_URL)
const TAG = 'settings_test_'
const actor = {
  adminId: crypto.randomUUID(),
  adminUsername: `${TAG}boss`,
  adminRole: 'superadmin',
}

describe('updateSeatCapacity validation — 400 before any DB access', () => {
  const ORIGINAL_DB_URL = process.env.DATABASE_URL

  beforeAll(() => {
    delete process.env.DATABASE_URL
  })

  afterAll(() => {
    if (ORIGINAL_DB_URL === undefined) delete process.env.DATABASE_URL
    else process.env.DATABASE_URL = ORIGINAL_DB_URL
  })

  it.each([
    ['a missing capacity', {}],
    ['a fractional capacity', { capacity: 12.5 }],
    ['a negative capacity', { capacity: -1 }],
    ['a non-numeric capacity', { capacity: 'lots' }],
    ['an above-ceiling capacity', { capacity: 100001 }],
    // Coercion traps: Number('') and Number([]) are 0, Number(true) is 1 — any
    // of these slipping through would silently close or nearly close sales.
    ['an empty-string capacity', { capacity: '' }],
    ['a boolean capacity', { capacity: true }],
    ['an array capacity', { capacity: [] }],
  ])('rejects %s with 400', async (_label, body) => {
    const res = await updateSeatCapacity(body, actor)
    expect(res.ok).toBe(false)
    expect(res.status).toBe(400)
  })

  it('rejects a non-boolean registration override before any DB access', async () => {
    const res = await updateRegistrationOpenOverride({ forceOpen: 'yes' }, actor)
    expect(res.ok).toBe(false)
    expect(res.status).toBe(400)
  })

  it.each([
    ['a missing id', undefined],
    ['a non-uuid string', 'not-a-uuid'],
    ['a numeric id', 12345],
  ])('revokeTicket rejects %s with 400', async (_label, registrationId) => {
    const res = await revokeTicket({ registrationId, actor })
    expect(res.ok).toBe(false)
    expect(res.status).toBe(400)
  })
})

describe.skipIf(!hasDb)('seat capacity override round-trip (real DB)', () => {
  let sql
  let priorValue = null

  beforeAll(async () => {
    const { getSql, ensureSettingsTable } = await import('../db.js')
    sql = getSql()
    await ensureSettingsTable(sql)
    const rows = await sql`SELECT value FROM app_settings WHERE key = 'seat_capacity' LIMIT 1`
    priorValue = rows[0]?.value ?? null
  }, 30000)

  afterAll(async () => {
    if (priorValue === null) {
      await sql`DELETE FROM app_settings WHERE key = 'seat_capacity'`
    } else {
      await sql`
        INSERT INTO app_settings (key, value) VALUES ('seat_capacity', ${priorValue})
        ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value
      `
    }
    await sql`DELETE FROM admin_audit_log WHERE admin_username LIKE ${TAG + '%'}`
  }, 30000)

  // The override value written equals the CURRENT effective capacity, so a
  // parallel live sale never sees a different cap while this test runs.
  it('DB override wins, clearing falls back to env/default, both audited', async () => {
    const effective = await getSeatCapacity()

    const set = await updateSeatCapacity({ capacity: effective }, actor)
    expect(set.ok).toBe(true)
    expect(set.status).toBe(200)
    expect(set.settings.seatCapacity).toBe(effective)
    expect(set.settings.overridden).toBe(true)
    expect(typeof set.settings.paid).toBe('number')

    const read = await getSettings()
    expect(read.ok).toBe(true)
    expect(read.settings.overridden).toBe(true)
    expect(read.settings.seatCapacity).toBe(effective)
    expect(read.settings.updatedBy).toBe(actor.adminUsername)
    expect(await getSeatCapacity()).toBe(effective)

    const cleared = await updateSeatCapacity({ capacity: null }, actor)
    expect(cleared.ok).toBe(true)
    expect(cleared.settings.overridden).toBe(false)
    expect(cleared.settings.seatCapacity).toBe(seatCapacity())
    expect(await getSeatCapacity()).toBe(seatCapacity())

    const { listAuditLog } = await import('../audit.js')
    const log = await listAuditLog({ action: 'capacity_updated', admin: actor.adminUsername, limit: 10 })
    expect(log.ok).toBe(true)
    expect(log.entries.length).toBeGreaterThanOrEqual(2)
    expect(log.entries[0].target_id).toBe('seat_capacity')
  }, 30000)

  it('a numeric string is accepted (JSON forms often send strings)', async () => {
    const effective = await getSeatCapacity()
    const res = await updateSeatCapacity({ capacity: String(effective) }, actor)
    expect(res.ok).toBe(true)
    expect(res.settings.seatCapacity).toBe(effective)
    await updateSeatCapacity({ capacity: null }, actor)
  }, 30000)
})

describe.skipIf(!hasDb)('registration access override round-trip (real DB)', () => {
  let sql
  let priorValue = null

  beforeAll(async () => {
    const { getSql, ensureSettingsTable } = await import('../db.js')
    sql = getSql()
    await ensureSettingsTable(sql)
    const rows = await sql`SELECT value FROM app_settings WHERE key = 'registration_open_override' LIMIT 1`
    priorValue = rows[0]?.value ?? null
  }, 30000)

  afterAll(async () => {
    if (priorValue === null) {
      await sql`DELETE FROM app_settings WHERE key = 'registration_open_override'`
    } else {
      await sql`
        INSERT INTO app_settings (key, value) VALUES ('registration_open_override', ${priorValue})
        ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value
      `
    }
    await sql`DELETE FROM admin_audit_log WHERE admin_username LIKE ${TAG + '%'}`
  }, 30000)

  it('opens early when overridden and falls back to schedule when cleared', async () => {
    const opened = await updateRegistrationOpenOverride({ forceOpen: true }, actor)
    expect(opened.ok).toBe(true)
    expect(opened.settings.registrationOpen).toBe(true)
    expect(opened.settings.registrationOpenOverridden).toBe(true)

    const read = await getRegistrationStatus()
    expect(read.open).toBe(true)
    expect(read.overridden).toBe(true)
    expect(read.opensAt).toBe('2026-08-05T07:00:00+05:30')

    const cleared = await updateRegistrationOpenOverride({ forceOpen: false }, actor)
    expect(cleared.ok).toBe(true)
    expect(cleared.settings.registrationOpenOverridden).toBe(false)
    expect(cleared.settings.registrationOpensAt).toBe('2026-08-05T07:00:00+05:30')
  }, 30000)
})

describe.skipIf(!hasDb)('revokeTicket round-trip (real DB)', () => {
  let sql
  const email = `${TAG}${crypto.randomUUID().slice(0, 8)}@example.test`
  let regId

  beforeAll(async () => {
    const { getSql, ensureRegistrationsTable } = await import('../db.js')
    sql = getSql()
    await ensureRegistrationsTable(sql)
    // Deliberately 'pending', not 'paid': revokeTicket keys off ticket_jti and
    // never reads payment_status, and a stray 'paid' row would consume a real
    // seat in every capacity gate if this suite died before its cleanup ran.
    const rows = await sql`
      INSERT INTO registrations
        (full_name, phone, email, designation, college, payment_status,
         ticket_jti, ticket_issued_at, ticket_email_sent_at)
      VALUES
        ('Settings Test Attendee', '+911234567890', ${email}, 'guest', NULL, 'pending',
         ${crypto.randomUUID()}, NOW(), NOW())
      RETURNING id
    `
    regId = rows[0].id
  }, 30000)

  afterAll(async () => {
    await sql`DELETE FROM registrations WHERE email = ${email}`
    await sql`DELETE FROM admin_audit_log WHERE admin_username LIKE ${TAG + '%'}`
  }, 30000)

  it('nulls jti + issue/sent stamps, audits, and 409s on replay', async () => {
    const res = await revokeTicket({ registrationId: regId, actor })
    expect(res.ok).toBe(true)
    expect(res.status).toBe(200)
    expect(res.registration.ticketIssued).toBe(false)

    const rows = await sql`
      SELECT ticket_jti, ticket_issued_at, ticket_email_sent_at, checked_in_at
      FROM registrations WHERE id = ${regId}
    `
    expect(rows[0].ticket_jti).toBeNull()
    expect(rows[0].ticket_issued_at).toBeNull()
    expect(rows[0].ticket_email_sent_at).toBeNull()

    // Replay converges to already-revoked, not a second audit-logged success.
    const replay = await revokeTicket({ registrationId: regId, actor })
    expect(replay.ok).toBe(false)
    expect(replay.status).toBe(409)

    const { listAuditLog } = await import('../audit.js')
    const log = await listAuditLog({ action: 'ticket_revoked', admin: actor.adminUsername, limit: 10 })
    expect(log.ok).toBe(true)
    const mine = log.entries.filter((e) => e.target_id === regId)
    expect(mine.length).toBe(1)
  }, 30000)

  it('404s for an unknown registration id', async () => {
    const res = await revokeTicket({ registrationId: crypto.randomUUID(), actor })
    expect(res.ok).toBe(false)
    expect(res.status).toBe(404)
  }, 30000)
})

// A revoke that any idempotent re-issue path can undo is not a revoke. These
// cover the three ways a fresh pass could be minted after one: the replayable
// unauthenticated settle path, a plain admin's Resend, and the superadmin's own
// deliberate re-issue (which must still work).
describe.skipIf(!hasDb)('revocation is durable (real DB)', () => {
  let sql
  const email = `${TAG}durable_${crypto.randomUUID().slice(0, 8)}@example.test`
  let regId

  beforeAll(async () => {
    const { getSql, ensureRegistrationsTable } = await import('../db.js')
    sql = getSql()
    await ensureRegistrationsTable(sql)
    // 'paid' is required here — issueTicket refuses an unpaid row before it ever
    // reaches the revocation check, which would make the test pass vacuously.
    // Deleted in afterAll, which runs even when an assertion fails.
    const rows = await sql`
      INSERT INTO registrations
        (full_name, phone, email, designation, college, payment_status,
         ticket_jti, ticket_issued_at, ticket_email_sent_at)
      VALUES
        ('Revoke Durability', '+911234567890', ${email}, 'guest', NULL, 'paid',
         ${crypto.randomUUID()}, NOW(), NOW())
      RETURNING id
    `
    regId = rows[0].id
  }, 30000)

  afterAll(async () => {
    await sql`DELETE FROM registrations WHERE email = ${email}`
    await sql`DELETE FROM email_log WHERE to_email = ${email}`
    await sql`DELETE FROM admin_audit_log WHERE admin_username LIKE ${TAG + '%'}`
  }, 30000)

  it('blocks the unauthenticated re-issue path and a plain admin resend, but not a superadmin', async () => {
    const { issueTicket } = await import('../tickets.js')
    const { resendTicket } = await import('../admin.js')

    expect((await revokeTicket({ registrationId: regId, actor })).ok).toBe(true)

    // 1. settlePayment's already-paid branch calls exactly this. Reachable by
    //    replaying a payment/verify triple the buyer's browser keeps forever.
    const replay = await issueTicket(regId)
    expect(replay.ok).toBe(false)
    expect(replay.error).toMatch(/revoked/i)
    let [row] = await sql`SELECT ticket_jti FROM registrations WHERE id = ${regId}`
    expect(row.ticket_jti).toBeNull()

    // 2. A plain admin pressing Resend must not be able to undo a superadmin.
    const byAdmin = await resendTicket({
      registrationId: regId,
      actor: { adminId: crypto.randomUUID(), adminUsername: `${TAG}gate`, adminRole: 'admin' },
    })
    expect(byAdmin.ok).toBe(false)
    expect(byAdmin.status).toBe(403)
    ;[row] = await sql`SELECT ticket_jti, ticket_revoked_at FROM registrations WHERE id = ${regId}`
    expect(row.ticket_jti).toBeNull()
    expect(row.ticket_revoked_at).not.toBeNull()

    // 3. The superadmin CAN deliberately issue a new pass — that is the
    //    documented recovery path, and the UI promises it.
    const bySuper = await resendTicket({ registrationId: regId, actor })
    expect(bySuper.ok).toBe(true)
    ;[row] = await sql`SELECT ticket_jti, ticket_revoked_at FROM registrations WHERE id = ${regId}`
    expect(row.ticket_revoked_at).toBeNull()
    expect(row.ticket_jti).not.toBeNull()
  }, 60000)
})
