import 'dotenv/config'
import { ensureSchemaOnce, getSql } from '../server/db.js'
import { withApi } from '../server/http.js'

// Warm-up / liveness probe, mirroring the Express route in server/index.js so the
// same '/api/health' path works whichever way the API is deployed (Render Express
// or Vercel functions).
//
// The public site pings this on every route change and on a keep-alive interval
// (src/lib/backendHealth.js) so a cold instance is already booted by the time
// someone reaches the register page.
//
// Cheap but honest: ensureSchemaOnce() keeps the schema DDL to once per isolate,
// and a single trivial query then proves the database is genuinely reachable on
// every call. Memoized DDL on its own would let this endpoint answer "connected"
// long after the database had died.
//
// Rate limited despite being a health check. On Vercel the memoization is
// PER ISOLATE, and a burst of concurrent requests spins up an isolate each — so
// an unthrottled endpoint lets anyone force the full CREATE/ALTER/CREATE INDEX
// sequence thousands of times over. Those statements take table locks that
// serialize against the very registrations this event depends on. The cap is set
// far above real usage (a queueing client polls at most ~20/min) so genuine
// warm-up traffic is never touched.
const HEALTH_LIMIT = { name: 'health', max: 60, windowSeconds: 60 }

// 503 (not 500) on failure: "temporarily unavailable, try again shortly" is
// exactly what a cold or booting backend means, and it is what the client-side
// queue gate polls for.
async function handler(_req, res) {
  res.setHeader('Cache-Control', 'no-store')
  try {
    const sql = getSql()
    await ensureSchemaOnce(sql)
    await sql`SELECT 1`
    return res.status(200).json({ ok: true, db: 'connected' })
  } catch (err) {
    // Logged, not swallowed — a silent 503 makes a database outage invisible.
    console.error('Health check failed:', err)
    return res.status(503).json({ ok: false, db: 'error' })
  }
}

export default withApi(handler, { methods: ['GET'], limit: HEALTH_LIMIT })
