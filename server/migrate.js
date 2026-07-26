import 'dotenv/config'
import { ensureRegistrationsTable, ensureAdminsTable, ensureContactMessagesTable } from './db.js'

try {
  await ensureRegistrationsTable()
  console.log('Registrations table ready.')
  await ensureAdminsTable()
  console.log('Admins table ready.')
  await ensureContactMessagesTable()
  console.log('Contact messages table ready.')
  process.exit(0)
} catch (err) {
  console.error('Migration failed:', err)
  process.exit(1)
}
