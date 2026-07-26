// Usage: node server/seed-admin.js <username> <password> <display name...>
import 'dotenv/config'
import bcrypt from 'bcryptjs'
import { getSql, ensureAdminsTable } from './db.js'

const [username, password, ...nameParts] = process.argv.slice(2)
const displayName = nameParts.join(' ').trim()

if (!username || !password || !displayName) {
  console.error('Usage: node server/seed-admin.js <username> <password> <display name...>')
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
    await sql`
      UPDATE admins
      SET password_hash = ${passwordHash}, display_name = ${displayName}
      WHERE id = ${existing[0].id}
    `
    console.log(`Admin '${username}' updated (password + display name).`)
  } else {
    await sql`
      INSERT INTO admins (username, password_hash, display_name)
      VALUES (${username}, ${passwordHash}, ${displayName})
    `
    console.log(`Admin '${username}' created.`)
  }
  process.exit(0)
} catch (err) {
  console.error('Seeding admin failed:', err)
  process.exit(1)
}
