import 'dotenv/config'
import { createRegistration } from '../server/registrations.js'
import { ensureSchemaOnce } from '../server/db.js'
import { withApi, LIMITS } from '../server/http.js'

async function handler(req, res) {
  if (req.method === 'GET') {
    // Lightweight health probe: confirms the DB is reachable (schema ensure runs
    // at most once per cold start now, so this is cheap on warm instances).
    try {
      await ensureSchemaOnce()
      return res.status(200).json({ ok: true, db: 'connected' })
    } catch {
      return res.status(500).json({ ok: false, db: 'error' })
    }
  }

  const result = await createRegistration(req.body || {})
  if (!result.ok) {
    return res.status(result.status).json({
      ok: false,
      error: result.error,
      errors: result.errors,
    })
  }

  return res.status(result.status).json({
    ok: true,
    registration: result.registration,
    next: result.next,
    message: result.message,
  })
}

export default withApi(handler, { methods: ['GET', 'POST'], limit: LIMITS.register })
