// Usage: npm run db:seed-superadmin
//
// Creates (or resets) the single bootstrap superadmin account and makes sure the
// logging tables exist, so one command takes a fresh database to a working
// superadmin panel. Safe to re-run: it is an upsert, and it always reactivates —
// this is the documented way back in after a lockout.
//
// SECURITY: the default password below is a well-known bootstrap credential. It
// is fine for local development and for the first login on a fresh deploy, but
// on anything reachable from the internet set SUPERADMIN_PASSWORD to a real
// secret before running this, or change the password from the Admins screen
// immediately after the first sign-in. The account can read every attendee's
// contact details and the full audit trail.
import 'dotenv/config'
import bcrypt from 'bcryptjs'
import { getSql, ensureAdminsTable, ensureAuditLogTable, ensureEmailLogTable } from './db.js'

const USERNAME = 'superadmin'
const DISPLAY_NAME = process.env.SUPERADMIN_NAME || 'Super Admin'
const PASSWORD = process.env.SUPERADMIN_PASSWORD || 'superadmin123'

try {
  const sql = getSql()
  await ensureAdminsTable(sql)
  await ensureAuditLogTable(sql)
  await ensureEmailLogTable(sql)

  const passwordHash = await bcrypt.hash(PASSWORD, 10)
  const existing = await sql`SELECT id FROM admins WHERE LOWER(username) = ${USERNAME} LIMIT 1`

  if (existing[0]) {
    await sql`
      UPDATE admins
      SET password_hash = ${passwordHash}, display_name = ${DISPLAY_NAME},
          role = 'superadmin', is_active = TRUE
      WHERE id = ${existing[0].id}
    `
    console.log(`Superadmin '${USERNAME}' reset (password + role + reactivated).`)
  } else {
    await sql`
      INSERT INTO admins (username, password_hash, display_name, role, created_by)
      VALUES (${USERNAME}, ${passwordHash}, ${DISPLAY_NAME}, 'superadmin', 'seed-script')
    `
    console.log(`Superadmin '${USERNAME}' created.`)
  }

  if (!process.env.SUPERADMIN_PASSWORD) {
    console.warn(
      'WARNING: seeded with the default password. Set SUPERADMIN_PASSWORD, or change it from the Admins screen after signing in.',
    )
  }
  process.exit(0)
} catch (err) {
  console.error('Seeding superadmin failed:', err)
  process.exit(1)
}
