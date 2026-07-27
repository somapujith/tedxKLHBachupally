import 'dotenv/config'
import {
  ensureRegistrationsTable,
  ensureAdminsTable,
  ensureContactMessagesTable,
  ensureAuditLogTable,
  ensureEmailLogTable,
} from './db.js'

try {
  await ensureRegistrationsTable()
  console.log('Registrations table ready.')
  await ensureAdminsTable()
  console.log('Admins table ready (role, is_active, last_login_at).')
  await ensureContactMessagesTable()
  console.log('Contact messages table ready.')
  await ensureAuditLogTable()
  console.log('Admin audit log table ready.')
  await ensureEmailLogTable()
  console.log('Email log table ready.')
  process.exit(0)
} catch (err) {
  console.error('Migration failed:', err)
  process.exit(1)
}
