// Usage: node server/seed-admin.js <username> <password> <display name...> [--role=superadmin]
//
// Role defaults to 'admin', so the original three-argument invocation is
// unchanged. Pass --role=superadmin to grant the audit log, email log,
// cross-admin statistics and account management.
import 'dotenv/config'
import bcrypt from 'bcryptjs'
import { getSql, ensureAdminsTable } from './db.js'

const argv = process.argv.slice(2)
const roleFlag = argv.find((a) => a.startsWith('--role='))
const role = roleFlag ? roleFlag.slice('--role='.length) : 'admin'
const positional = argv.filter((a) => !a.startsWith('--'))

const [username, password, ...nameParts] = positional
const displayName = nameParts.join(' ').trim()

if (!username || !password || !displayName) {
  console.error('Usage: node server/seed-admin.js <username> <password> <display name...> [--role=superadmin]')
  process.exit(1)
}
if (role !== 'admin' && role !== 'superadmin') {
  console.error(`Unknown role '${role}'. Use --role=admin or --role=superadmin.`)
  process.exit(1)
}

try {
  const sql = getSql()
  await ensureAdminsTable(sql)
  const passwordHash = await bcrypt.hash(password, 10)

  const existing = await sql`
    SELECT id FROM admins WHERE LOWER(username) = ${username.toLowerCase()} LIMIT 1
  `
  if (existing[0]) {
    // Re-running always reactivates: this script is the documented way back in
    // after an account is locked out or a password is lost.
    await sql`
      UPDATE admins
      SET password_hash = ${passwordHash}, display_name = ${displayName},
          role = ${role}, is_active = TRUE
      WHERE id = ${existing[0].id}
    `
    console.log(`Admin '${username}' updated (password, display name, role=${role}, active).`)
  } else {
    await sql`
      INSERT INTO admins (username, password_hash, display_name, role, created_by)
      VALUES (${username}, ${passwordHash}, ${displayName}, ${role}, 'seed-script')
    `
    console.log(`Admin '${username}' created with role '${role}'.`)
  }
  process.exit(0)
} catch (err) {
  console.error('Seeding admin failed:', err)
  process.exit(1)
}
