import 'dotenv/config'
import { ensureRegistrationsTable } from './db.js'

try {
  await ensureRegistrationsTable()
  console.log('Registrations table ready.')
  process.exit(0)
} catch (err) {
  console.error('Migration failed:', err)
  process.exit(1)
}
