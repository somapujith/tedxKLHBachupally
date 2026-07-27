// @vitest-environment node
// Superadmin role gate, admin account management invariants, and audit log
// round-trip. No-DB tests cover the JWT gate and the pre-query validation
// 400s; DB tests run against the real Neon DB (skipped when DATABASE_URL is
// not configured) and clean up their own tagged rows. The production
// 'superadmin' row is never touched — guard tests create their own tagged
// superadmins instead.
import 'dotenv/config'
import crypto from 'node:crypto'
import jwt from 'jsonwebtoken'
import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { loginAdmin, requireAdmin, requireSuperAdmin, actorFrom, ROLES } from '../admin.js'
import { createAdmin, updateAdmin, setAdminActive, listAdmins } from '../admin-users.js'
import {
  recordAudit,
  listAuditLog,
  listEmailLog,
  getSuperStats,
  AUDIT_ACTIONS,
} from '../audit.js'

const ORIGINAL_ADMIN_SECRET = process.env.ADMIN_JWT_SECRET
const hasDb = Boolean(process.env.DATABASE_URL)

const TEST_SECRET = 'test-superadmin-secret'
const ISSUER = 'tedxklh-admin'
const TAG = 'superadmin_test_'

beforeAll(() => {
  process.env.ADMIN_JWT_SECRET = TEST_SECRET
})

afterAll(() => {
  if (ORIGINAL_ADMIN_SECRET === undefined) delete process.env.ADMIN_JWT_SECRET
  else process.env.ADMIN_JWT_SECRET = ORIGINAL_ADMIN_SECRET
})

function bearer(payload, { secret = TEST_SECRET, issuer = ISSUER } = {}) {
  const token = jwt.sign(payload, secret, {
    algorithm: 'HS256',
    issuer,
    expiresIn: '5m',
  })
  return { headers: { authorization: `Bearer ${token}` } }
}

describe('requireSuperAdmin — role gate (no DB)', () => {
  it('returns 401 for a missing token', async () => {
    const res = await requireSuperAdmin({ headers: {} })
    expect(res.ok).toBe(false)
    expect(res.status).toBe(401)
  })

  it('returns 401 for a garbage bearer token', async () => {
    const res = await requireSuperAdmin({ headers: { authorization: 'Bearer nope' } })
    expect(res.ok).toBe(false)
    expect(res.status).toBe(401)
  })

  it('returns 401 for a token signed with the wrong secret', async () => {
    const req = bearer({ username: 'evil', role: 'superadmin' }, { secret: 'other-secret' })
    const res = await requireSuperAdmin(req)
    expect(res.ok).toBe(false)
    expect(res.status).toBe(401)
  })

  it('returns 401 for a token minted by a different issuer', async () => {
    const req = bearer({ username: 'evil', role: 'superadmin' }, { issuer: 'not-tedxklh' })
    const res = await requireSuperAdmin(req)
    expect(res.ok).toBe(false)
    expect(res.status).toBe(401)
  })

  it('returns 403 (authenticated but not authorized) for a valid admin-role token', async () => {
    const req = bearer({ aid: crypto.randomUUID(), username: 'gate', role: 'admin' })
    expect(requireAdmin(req).ok).toBe(true)
    const res = await requireSuperAdmin(req)
    expect(res.ok).toBe(false)
    expect(res.status).toBe(403)
    expect(res.error).toMatch(/superadmin/i)
  })

  it('returns 403 for a legacy token with no role claim (cannot silently gain privilege)', async () => {
    const req = bearer({ aid: crypto.randomUUID(), username: 'old-token' })
    const auth = requireAdmin(req)
    expect(auth.ok).toBe(true)
    expect(auth.admin.role).toBe(ROLES.ADMIN)
    const res = await requireSuperAdmin(req)
    expect(res.ok).toBe(false)
    expect(res.status).toBe(403)
  })

  // A correctly signed superadmin token is NOT sufficient on its own: the gate
  // re-reads the account so a demoted or deactivated superadmin loses access
  // immediately instead of keeping it until the 12-hour token expires. A token
  // naming an account that does not exist is therefore refused, not admitted.
  // The genuine success path (real row, real login) is covered by the DB suite
  // in 'admin account lifecycle (real DB)'.
  it.skipIf(!hasDb)('refuses a well-signed superadmin token whose account does not exist', async () => {
    const req = bearer({ aid: crypto.randomUUID(), username: 'boss', role: 'superadmin' })
    const res = await requireSuperAdmin(req)
    expect(res.ok).toBe(false)
    expect(res.status).toBe(403)
  })
})

describe('actorFrom — audit identity mapping (no DB)', () => {
  it('maps aid/username/role/name from the verified claims', () => {
    const actor = actorFrom({
      admin: { aid: 'id-123', username: 'boss', role: 'superadmin', name: 'The Boss' },
    })
    expect(actor).toEqual({
      adminId: 'id-123',
      adminUsername: 'boss',
      adminRole: 'superadmin',
      displayName: 'The Boss',
    })
  })

  it('defaults an unknown role to admin', () => {
    const actor = actorFrom({ admin: { aid: 'id-1', username: 'gate', role: 'root' } })
    expect(actor.adminRole).toBe(ROLES.ADMIN)
  })

  it('degrades safely when auth is missing entirely', () => {
    const actor = actorFrom(undefined)
    expect(actor.adminId).toBeNull()
    expect(actor.adminUsername).toBe('unknown')
    expect(actor.adminRole).toBe(ROLES.ADMIN)
    expect(actor.displayName).toBe('Admin')
  })
})

// DATABASE_URL is removed for this block: if any of these calls reached
// getSql() the promise would reject with "DATABASE_URL is not set" and the
// test would fail — so a passing 400 proves the shape gate runs before any
// query. (Runs before the DB suites, so no memoized sql client exists yet.)
describe('admin-users validation — 400 before any DB access', () => {
  const ORIGINAL_DB_URL = process.env.DATABASE_URL

  beforeAll(() => {
    delete process.env.DATABASE_URL
  })

  afterAll(() => {
    if (ORIGINAL_DB_URL === undefined) delete process.env.DATABASE_URL
    else process.env.DATABASE_URL = ORIGINAL_DB_URL
  })

  it.each([
    ['a too-short username', { username: 'ab', password: 'long-enough-pass', displayName: 'Valid Name', role: 'admin' }],
    ['an invalid username shape', { username: 'Bad User!', password: 'long-enough-pass', displayName: 'Valid Name', role: 'admin' }],
    ['a short password', { username: 'valid.user', password: 'short', displayName: 'Valid Name', role: 'admin' }],
    ['a bad display name', { username: 'valid.user', password: 'long-enough-pass', displayName: 'X', role: 'admin' }],
    ['a bad role', { username: 'valid.user', password: 'long-enough-pass', displayName: 'Valid Name', role: 'root' }],
  ])('createAdmin rejects %s with 400', async (_label, body) => {
    const res = await createAdmin(body)
    expect(res.ok).toBe(false)
    expect(res.status).toBe(400)
  })

  it.each([
    ['a missing id', undefined],
    ['a non-uuid string', 'not-a-uuid'],
    ['a numeric id', 12345],
    ['a sql-ish payload', "' OR 1=1 --"],
  ])('updateAdmin rejects %s with 400', async (_label, id) => {
    const res = await updateAdmin({ id, displayName: 'New Name' })
    expect(res.ok).toBe(false)
    expect(res.status).toBe(400)
  })

  it('setAdminActive rejects a non-uuid id with 400', async () => {
    const res = await setAdminActive({ id: 'not-a-uuid', isActive: false })
    expect(res.ok).toBe(false)
    expect(res.status).toBe(400)
  })

  it('setAdminActive rejects a non-boolean isActive with 400', async () => {
    const res = await setAdminActive({ id: crypto.randomUUID(), isActive: 'yes' })
    expect(res.ok).toBe(false)
    expect(res.status).toBe(400)
  })
})

describe.skipIf(!hasDb)('admin account lifecycle (real DB)', () => {
  const suffix = crypto.randomUUID().slice(0, 8)
  const PASSWORD = 'correct-horse-battery'
  const creator = { adminId: crypto.randomUUID(), adminUsername: `${TAG}creator` }
  let sql

  beforeAll(async () => {
    const { getSql, ensureAdminsTable } = await import('../db.js')
    sql = getSql()
    await ensureAdminsTable(sql)
    await sql`DELETE FROM admins WHERE username LIKE ${TAG + '%'}`
  }, 30000)

  afterAll(async () => {
    await sql`DELETE FROM admins WHERE username LIKE ${TAG + '%'}`
    await sql`DELETE FROM admin_audit_log WHERE admin_username LIKE ${TAG + '%'}`
  }, 30000)

  it('create -> login carries role in body and token; deactivation flips login to 401', async () => {
    const username = `${TAG}gate_${suffix}`
    const created = await createAdmin(
      { username, password: PASSWORD, displayName: 'Gate Tester', role: ROLES.ADMIN },
      creator,
    )
    expect(created.ok).toBe(true)
    expect(created.status).toBe(201)
    expect(created.admin.role).toBe(ROLES.ADMIN)

    const login = await loginAdmin({ username, password: PASSWORD })
    expect(login.ok).toBe(true)
    expect(login.admin.role).toBe(ROLES.ADMIN)
    // Claim contents only — the signature itself is verified by requireAdmin
    // below, which accepts this exact token against the env secret.
    const claims = jwt.decode(login.token)
    expect(claims.role).toBe(ROLES.ADMIN)
    expect(claims.username).toBe(username)
    expect(claims.iss).toBe(ISSUER)

    // The real login token authenticates but does not clear the super gate.
    const req = { headers: { authorization: `Bearer ${login.token}` } }
    expect(requireAdmin(req).ok).toBe(true)
    expect((await requireSuperAdmin(req)).status).toBe(403)

    const off = await setAdminActive({ id: created.admin.id, isActive: false }, creator)
    expect(off.ok).toBe(true)
    expect(off.admin.is_active).toBe(false)

    // Same uniform 401 as a bad password — no enumeration signal.
    const denied = await loginAdmin({ username, password: PASSWORD })
    expect(denied.ok).toBe(false)
    expect(denied.status).toBe(401)
    expect(denied.token).toBeUndefined()
  }, 30000)

  it('rejects a duplicate username with 409', async () => {
    const username = `${TAG}dupe_${suffix}`
    const first = await createAdmin(
      { username, password: PASSWORD, displayName: 'Dupe One', role: ROLES.ADMIN },
      creator,
    )
    expect(first.ok).toBe(true)
    const second = await createAdmin(
      { username, password: PASSWORD, displayName: 'Dupe Two', role: ROLES.ADMIN },
      creator,
    )
    expect(second.ok).toBe(false)
    expect(second.status).toBe(409)
  }, 30000)

  it('superadmin login token clears requireSuperAdmin; self-demotion 409, peer demotion ok', async () => {
    const a = await createAdmin(
      { username: `${TAG}super_a_${suffix}`, password: PASSWORD, displayName: 'Super A', role: ROLES.SUPERADMIN },
      creator,
    )
    const b = await createAdmin(
      { username: `${TAG}super_b_${suffix}`, password: PASSWORD, displayName: 'Super B', role: ROLES.SUPERADMIN },
      creator,
    )
    expect(a.ok).toBe(true)
    expect(b.ok).toBe(true)

    const login = await loginAdmin({ username: a.admin.username, password: PASSWORD })
    expect(login.ok).toBe(true)
    expect(login.admin.role).toBe(ROLES.SUPERADMIN)
    const gate = await requireSuperAdmin({ headers: { authorization: `Bearer ${login.token}` } })
    expect(gate.ok).toBe(true)
    expect(gate.admin.role).toBe(ROLES.SUPERADMIN)

    // Invariant 2: a superadmin can never demote themselves, even though
    // another tagged superadmin (and the production one) still exists.
    const selfDemote = await updateAdmin(
      { id: a.admin.id, role: ROLES.ADMIN },
      { adminId: a.admin.id, adminUsername: a.admin.username },
    )
    expect(selfDemote.ok).toBe(false)
    expect(selfDemote.status).toBe(409)
    expect(selfDemote.error).toMatch(/own superadmin/i)

    // Invariant 2 again, for deactivation.
    const selfOff = await setAdminActive(
      { id: b.admin.id, isActive: false },
      { adminId: b.admin.id, adminUsername: b.admin.username },
    )
    expect(selfOff.ok).toBe(false)
    expect(selfOff.status).toBe(409)
    expect(selfOff.error).toMatch(/own account/i)

    // A DIFFERENT superadmin may demote — other active superadmins remain.
    const demoted = await updateAdmin(
      { id: a.admin.id, role: ROLES.ADMIN },
      { adminId: b.admin.id, adminUsername: b.admin.username },
    )
    expect(demoted.ok).toBe(true)
    expect(demoted.admin.role).toBe(ROLES.ADMIN)
  }, 30000)

  it('listAdmins includes the tagged rows and never exposes password_hash', async () => {
    const res = await listAdmins()
    expect(res.ok).toBe(true)
    const mine = res.admins.filter((row) => row.username.startsWith(TAG))
    expect(mine.length).toBeGreaterThan(0)
    for (const row of res.admins) {
      expect(row).not.toHaveProperty('password_hash')
    }
  }, 30000)
})

describe.skipIf(!hasDb)('audit log round-trip (real DB)', () => {
  const auditUser = `${TAG}audit_${crypto.randomUUID().slice(0, 8)}`
  let sql

  beforeAll(async () => {
    const { getSql } = await import('../db.js')
    sql = getSql()
  })

  afterAll(async () => {
    await sql`DELETE FROM admin_audit_log WHERE admin_username LIKE ${TAG + '%'}`
  }, 30000)

  it('recordAudit + listAuditLog round-trips action and target fields', async () => {
    const targetId = crypto.randomUUID()
    await recordAudit({
      action: AUDIT_ACTIONS.RESEND_TICKET,
      adminUsername: auditUser,
      adminRole: 'superadmin',
      targetType: 'registration',
      targetId,
      targetName: 'Round Trip',
      detail: 'superadmin.test.js round-trip',
    })

    const res = await listAuditLog({ admin: auditUser, limit: 10 })
    expect(res.ok).toBe(true)
    const row = res.entries.find((entry) => entry.target_id === targetId)
    expect(row).toBeDefined()
    expect(row.action).toBe('resend_ticket')
    expect(row.admin_username).toBe(auditUser)
    expect(row.target_type).toBe('registration')
    expect(row.target_name).toBe('Round Trip')
    expect(row.result).toBe('success')
  }, 30000)

  it('recordAudit never throws, even when the INSERT itself fails', async () => {
    // A missing action violates admin_audit_log.action NOT NULL, so the write
    // fails — recordAudit must swallow that and resolve (rule 1 in audit.js).
    await expect(recordAudit({ adminUsername: auditUser })).resolves.toBeUndefined()
  }, 30000)

  it('bounded reads: listAuditLog clamps an oversized limit', async () => {
    const res = await listAuditLog({ limit: 99999 })
    expect(res.ok).toBe(true)
    expect(res.limit).toBe(500)
    expect(res.entries.length).toBeLessThanOrEqual(500)
  }, 30000)

  it('listEmailLog and getSuperStats read without error', async () => {
    const emails = await listEmailLog({ limit: 5 })
    expect(emails.ok).toBe(true)
    expect(emails.entries.length).toBeLessThanOrEqual(5)

    const stats = await getSuperStats()
    expect(stats.ok).toBe(true)
    expect(Array.isArray(stats.superStats.byAdmin)).toBe(true)
    expect(Array.isArray(stats.superStats.admins)).toBe(true)
    expect(typeof stats.superStats.failedLogins24h).toBe('number')
    expect(typeof stats.superStats.actionsLastHour).toBe('number')
  }, 30000)
})
