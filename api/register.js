import 'dotenv/config'
import { createRegistration } from '../server/registrations.js'
import { seatAvailability } from '../server/payments.js'
import { withApi, LIMITS } from '../server/http.js'

// Availability probe for the register page: live pass counts so the buyer sees
// how many are left before committing. Doubles as the DB liveness check this
// GET always was — the count query proves the DB is genuinely reachable.
async function getHandler(_req, res) {
  // Set before the try so the 500 path is never cached by an edge either.
  res.setHeader('Cache-Control', 'no-store')
  try {
    const availability = await seatAvailability()
    return res.status(200).json({ ok: true, db: 'connected', ...availability })
  } catch (err) {
    // Logged, not swallowed — on Vercel this is the ONLY place the failure is
    // visible; the client silently falls back to a static capacity display.
    console.error('Availability check failed:', err)
    return res.status(500).json({ ok: false, db: 'error' })
  }
}

async function postHandler(req, res) {
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

// Two wrappers so GET and POST spend from SEPARATE rate-limit buckets: the
// availability GET fires on every page mount, and sharing register's small
// write budget would let mere page views 429 real submits from one campus NAT.
// Both declare the same methods so CORS/OPTIONS advertise the full set
// (withApi answers OPTIONS before its rate limiter runs, so preflights are
// never billed to either bucket).
const wrappedGet = withApi(getHandler, {
  methods: ['GET', 'POST'],
  limit: LIMITS.availability,
})
const wrappedPost = withApi(postHandler, {
  methods: ['GET', 'POST'],
  limit: LIMITS.register,
})

export default function handler(req, res) {
  return req.method === 'GET' ? wrappedGet(req, res) : wrappedPost(req, res)
}
