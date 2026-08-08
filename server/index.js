import 'dotenv/config'
import express from 'express'
import cors from 'cors'
import rateLimit from 'express-rate-limit'
import { createRegistration } from './registrations.js'
import { ensureSchemaOnce, getSql } from './db.js'
import {
  submitPaymentProof,
  listPendingVerifications,
  listVerifiedPayments,
  getPaymentProof,
  approvePayment,
  rejectPayment,
  seatAvailability,
} from './payments.js'
import { createContactMessage } from './contact.js'
import { createSupportTicket, listSupportTickets, resolveSupportTicket } from './support.js'
import { startKeepAlive } from './keepAlive.js'
import {
  loginAdmin,
  requireAdmin,
  requireSuperAdmin,
  actorFrom,
  getStats,
  listRegistrations,
  checkInTicket,
  resendTicket,
  revokeTicket,
} from './admin.js'
import { listAdmins, createAdmin, updateAdmin, setAdminActive } from './admin-users.js'
import { listAuditLog, listEmailLog, getSuperStats, requestContext } from './audit.js'
import { getSettings, updateRegistrationOpenOverride, updateSeatCapacity } from './settings.js'

const app = express()
const port = Number(process.env.PORT) || 3001

// CORS allow-lists from env (comma-separated). Only the request Origin is echoed
// back, and only when it matches; unset/unknown origins fall back to the first
// configured origin so browsers get a concrete value, never '*'.
//
// There are TWO lists, and conflating them breaks the public site. The admin
// panel and the public site are documented in .env.example as DIFFERENT hosts
// (admin.tedxklhbachupally.com vs tedxklhbachupally.com). Serving the admin
// origin to a public caller means the browser rejects every /api/register,
// /api/payment and /api/health call the main site makes — and because a
// CORS-blocked probe is indistinguishable from an unreachable backend, the
// register page's queue gate would hold every visitor for its full ceiling
// before failing. Public routes therefore get the public list, mirroring the
// scoping that server/http.js already applies to the Vercel handlers.
function parseOrigins(value) {
  return String(value || '')
    .split(',')
    .map((o) => o.trim())
    .filter(Boolean)
}

const adminOrigins = parseOrigins(process.env.ADMIN_ALLOWED_ORIGIN)
// Falls back to the admin list when unset, so a single-origin deploy still works.
const publicOrigins = parseOrigins(
  process.env.PUBLIC_ALLOWED_ORIGIN || process.env.ADMIN_ALLOWED_ORIGIN,
)

function originChecker(allowList) {
  return (origin, callback) => {
    if (allowList.length === 0) return callback(null, true) // dev: no list set
    if (origin && allowList.includes(origin)) return callback(null, origin)
    return callback(null, allowList[0])
  }
}

const adminCors = cors({ origin: originChecker(adminOrigins), credentials: true })
const publicCors = cors({ origin: originChecker(publicOrigins), credentials: true })

// One middleware that dispatches, rather than two stacked ones — stacking would
// let the second overwrite the first's Access-Control-Allow-Origin header.
app.use((req, res, next) =>
  (req.path.startsWith('/api/admin') ? adminCors : publicCors)(req, res, next),
)

// Rate limiters (Express/self-host only). NOTE: express-rate-limit's default store
// is in-memory and per-instance — on Vercel's serverless deployment it does NOT
// share counts across function instances. A KV-backed store (Upstash / Vercel KV)
// is required for real limiting there; the api/* wrappers do not include this.
// Disabled under test so the supertest suite is not throttled.
const isTest = process.env.NODE_ENV === 'test'

// Behind Render's edge the socket peer is Render's router for EVERY request, so
// req.ip is the same value for the whole internet — one global bucket. That is
// not merely a weak limiter, it is an outage: 11 failed logins from anywhere
// would lock every admin out, and the 60-per-15-min action cap would be shared
// across all gate scanners combined rather than applied per device.
//
// The repair is a keyGenerator, NOT `app.set('trust proxy', true)`: the
// permissive setting re-opens the spoofable raw x-forwarded-for bypass that
// server/http.js already documents. This mirrors clientIp() there — prefer the
// edge-injected headers a client cannot forge, and fall back to the socket.
function limiterKey(req) {
  const h = req.headers || {}
  const first = (v) => (typeof v === 'string' && v ? v.split(',')[0].trim() : '')
  return (
    first(h['x-render-forwarded-for']) ||
    first(h['x-real-ip']) ||
    first(h['x-forwarded-for']) ||
    req.socket?.remoteAddress ||
    'unknown'
  )
}

const makeLimiter = (max) =>
  rateLimit({
    windowMs: 15 * 60 * 1000,
    max: isTest ? 100000 : max,
    standardHeaders: true,
    legacyHeaders: false,
    keyGenerator: limiterKey,
    // express-rate-limit otherwise throws ERR_ERL_UNEXPECTED_X_FORWARDED_FOR
    // because trust proxy is off — which is deliberate here, see above.
    validate: { xForwardedForHeader: false },
    message: { ok: false, error: 'Too many requests. Please try again later.' },
  })

const loginLimiter = makeLimiter(10) // 10 login attempts / 15 min / IP
const adminActionLimiter = makeLimiter(60) // lighter cap for checkin / resend
const contactLimiter = makeLimiter(5) // 5 contact messages / 15 min / IP
// Support tickets are raised by someone who has already registered and is often
// anxious (paid, no pass yet), so the IP cap is looser than contact's — the real
// abuse guard is the per-email hourly cap enforced in the DB by support.js.
const supportLimiter = makeLimiter(15)
// Availability GET does real COUNT work per hit; unlimited it is a free DB
// amplifier. Generous cap — a real visitor produces 1-2 per page view.
const availabilityLimiter = makeLimiter(120)

// 4mb, not the 100kb default: a payment submission carries a base64 screenshot
// inline. The server-side ceiling that actually protects the DB is
// MAX_PROOF_BYTES in payments.js — this limit only has to be wide enough not to
// reject a legitimate compressed screenshot before that check can run.
app.use(express.json({ limit: '4mb' }))

// Warm-up / liveness probe. The public site pings this on every route change and
// on a keep-alive interval (src/lib/backendHealth.js) so a spun-down Render
// instance is already booted by the time someone reaches the register page, and
// render.yaml points its healthCheckPath here.
//
// Two competing requirements, and getting the balance wrong breaks something:
//
//   - It must be CHEAP, because it is called constantly. ensureSchemaOnce()
//     memoizes the ~15 DDL round-trips so they happen once per process, not on
//     every ping.
//   - It must still be TRUE. Memoized DDL alone would mean that after the first
//     success this endpoint never touches the database again — it would answer
//     "connected" with Neon completely down, Render would never restart the
//     instance, and the register page's gate would wave users through to a 500.
//
// So: schema once, then one trivial round-trip every time. That is a single
// cheap query that still proves the database is actually reachable right now.
app.get('/api/health', async (_req, res) => {
  res.setHeader('Cache-Control', 'no-store')
  try {
    const sql = getSql()
    await ensureSchemaOnce(sql)
    await sql`SELECT 1`
    res.json({ ok: true, db: 'connected' })
  } catch (err) {
    console.error('Health check failed:', err)
    res.status(503).json({ ok: false, db: 'error' })
  }
})

// Availability probe, mirroring the GET branch of api/register.js so the same
// path answers on both deploy targets. Live pass counts for the register page.
app.get('/api/register', availabilityLimiter, async (_req, res) => {
  res.setHeader('Cache-Control', 'no-store')
  try {
    const availability = await seatAvailability()
    return res.json({ ok: true, db: 'connected', ...availability })
  } catch (err) {
    console.error('Availability check failed:', err)
    return res.status(500).json({ ok: false, db: 'error' })
  }
})

app.post('/api/register', async (req, res) => {
  try {
    const result = await createRegistration(req.body || {})
    if (!result.ok) {
      return res.status(result.status).json({
        ok: false,
        error: result.error,
        errors: result.errors,
        registrationOpen: result.registrationOpen,
        registrationOpensAt: result.registrationOpensAt,
      })
    }
    return res.status(result.status).json({
      ok: true,
      registration: result.registration,
      next: result.next,
      message: result.message,
    })
  } catch (err) {
    console.error('Register error:', err)
    return res.status(500).json({ ok: false, error: 'Could not register.' })
  }
})

// Buyer submits their bank-transfer proof. No ticket is issued here — an admin
// has to approve it first.
app.post('/api/payment/submit', async (req, res) => {
  try {
    const result = await submitPaymentProof({
      registrationId: req.body?.registrationId,
      utrId: req.body?.utrId,
      proof: req.body?.proof,
    })
    return res.status(result.status).json(result)
  } catch (err) {
    console.error('Payment submit error:', err)
    return res.status(500).json({ ok: false, error: 'Could not submit payment.' })
  }
})

app.post('/api/contact', contactLimiter, async (req, res) => {
  try {
    const result = await createContactMessage(req.body || {})
    if (!result.ok) {
      return res.status(result.status).json({
        ok: false,
        error: result.error,
        errors: result.errors,
      })
    }
    return res.status(result.status).json({ ok: true, message: result.message })
  } catch (err) {
    console.error('Contact error:', err)
    return res.status(500).json({ ok: false, error: 'Could not send your message.' })
  }
})

// Attendee raises a support ticket from the confirmation screen. Message only —
// this never changes a registration's payment state.
app.post('/api/support', supportLimiter, async (req, res) => {
  try {
    const result = await createSupportTicket(req.body || {})
    return res.status(result.status).json(result)
  } catch (err) {
    console.error('Support ticket error:', err)
    return res.status(500).json({ ok: false, error: 'Could not raise your ticket.' })
  }
})

app.post('/api/admin/login', loginLimiter, async (req, res) => {
  try {
    const result = await loginAdmin(req.body || {}, requestContext(req))
    return res.status(result.status).json(result)
  } catch (err) {
    console.error('Admin login error:', err)
    return res.status(500).json({ ok: false, error: 'Could not log in.' })
  }
})

app.get('/api/admin/stats', async (req, res) => {
  const auth = requireAdmin(req)
  if (!auth.ok) return res.status(auth.status).json({ ok: false, error: auth.error })
  try {
    const result = await getStats()
    return res.status(result.status).json(result)
  } catch (err) {
    console.error('Admin stats error:', err)
    return res.status(500).json({ ok: false, error: 'Could not load stats.' })
  }
})

app.get('/api/admin/registrations', async (req, res) => {
  const auth = requireAdmin(req)
  if (!auth.ok) return res.status(auth.status).json({ ok: false, error: auth.error })
  try {
    const result = await listRegistrations({ status: req.query?.status })
    return res.status(result.status).json(result)
  } catch (err) {
    console.error('Admin registrations error:', err)
    return res.status(500).json({ ok: false, error: 'Could not load registrations.' })
  }
})

app.post('/api/admin/checkin', adminActionLimiter, async (req, res) => {
  const auth = requireAdmin(req)
  if (!auth.ok) return res.status(auth.status).json({ ok: false, error: auth.error })
  try {
    const result = await checkInTicket({
      token: req.body?.token,
      adminName: auth.admin.name || auth.admin.username,
      actor: actorFrom(auth),
      context: requestContext(req),
    })
    return res.status(result.status).json(result)
  } catch (err) {
    console.error('Admin checkin error:', err)
    return res.status(500).json({ ok: false, error: 'Could not check in.' })
  }
})

app.post('/api/admin/resend-ticket', adminActionLimiter, async (req, res) => {
  const auth = requireAdmin(req)
  if (!auth.ok) return res.status(auth.status).json({ ok: false, error: auth.error })
  try {
    const result = await resendTicket({
      registrationId: req.body?.registrationId,
      actor: actorFrom(auth),
      context: requestContext(req),
    })
    return res.status(result.status).json(result)
  } catch (err) {
    console.error('Admin resend error:', err)
    return res.status(500).json({ ok: false, error: 'Could not resend ticket.' })
  }
})

// --- Payment verification queue -----------------------------------------------
//
// Any admin can work the queue: approving is what issues a pass, and that is the
// same authority a plain admin already has via check-in and resend.

// The admin client speaks ONE API shape (the Vercel [resource] handler's):
// GET /verifications?id=<uuid> for a single proof, and POST /verifications with
// {registrationId} to approve or {reject:true, reason} to reject. Express used
// to implement a different shape — /:id/proof, /approve, /reject — so on the
// Render deployment the screenshot silently returned the whole list instead of
// the image, and both action buttons hit a 404. The subpath routes below are
// kept because they still work and something may call them, but these two are
// what the dashboard actually uses, and they must stay shape-compatible with
// api/admin/[resource].js or one deploy target breaks while the other passes.
app.get('/api/admin/verifications', adminActionLimiter, async (req, res) => {
  const auth = requireAdmin(req)
  if (!auth.ok) return res.status(auth.status).json({ ok: false, error: auth.error })
  try {
    const result = req.query?.id
      ? await getPaymentProof(req.query.id)
      : await listPendingVerifications({ limit: req.query?.limit })
    return res.status(result.status).json(result)
  } catch (err) {
    console.error('Verification list error:', err)
    return res.status(500).json({ ok: false, error: 'Could not load submissions.' })
  }
})

// Approve, or reject when the body carries `reject`. Mirrors the POST branch of
// the verifications resource in api/admin/[resource].js.
app.post('/api/admin/verifications', adminActionLimiter, async (req, res) => {
  const auth = requireAdmin(req)
  if (!auth.ok) return res.status(auth.status).json({ ok: false, error: auth.error })
  try {
    const actor = actorFrom(auth)
    const context = requestContext(req)
    const result = req.body?.reject
      ? await rejectPayment(
          { registrationId: req.body?.registrationId, reason: req.body?.reason },
          actor,
          context,
        )
      : await approvePayment({ registrationId: req.body?.registrationId }, actor, context)
    return res.status(result.status).json(result)
  } catch (err) {
    console.error('Verification action error:', err)
    return res.status(500).json({ ok: false, error: 'Could not update this payment.' })
  }
})

// Proof is fetched one row at a time — the list query omits the base64 image so
// opening the queue does not pull megabytes per page.
app.get('/api/admin/verifications/:id/proof', adminActionLimiter, async (req, res) => {
  const auth = requireAdmin(req)
  if (!auth.ok) return res.status(auth.status).json({ ok: false, error: auth.error })
  try {
    const result = await getPaymentProof(req.params.id)
    return res.status(result.status).json(result)
  } catch (err) {
    console.error('Proof fetch error:', err)
    return res.status(500).json({ ok: false, error: 'Could not load payment proof.' })
  }
})

app.post('/api/admin/verifications/approve', adminActionLimiter, async (req, res) => {
  const auth = requireAdmin(req)
  if (!auth.ok) return res.status(auth.status).json({ ok: false, error: auth.error })
  try {
    const result = await approvePayment(
      { registrationId: req.body?.registrationId },
      actorFrom(auth),
      requestContext(req),
    )
    return res.status(result.status).json(result)
  } catch (err) {
    console.error('Approve error:', err)
    return res.status(500).json({ ok: false, error: 'Could not approve payment.' })
  }
})

app.post('/api/admin/verifications/reject', adminActionLimiter, async (req, res) => {
  const auth = requireAdmin(req)
  if (!auth.ok) return res.status(auth.status).json({ ok: false, error: auth.error })
  try {
    const result = await rejectPayment(
      { registrationId: req.body?.registrationId, reason: req.body?.reason },
      actorFrom(auth),
      requestContext(req),
    )
    return res.status(result.status).json(result)
  } catch (err) {
    console.error('Reject error:', err)
    return res.status(500).json({ ok: false, error: 'Could not reject payment.' })
  }
})

// --- Support queue ------------------------------------------------------------
//
// Any admin can work it: a support ticket is a message to answer, and answering
// it uses the same attendee-facing authority a plain admin already has.

app
  .route('/api/admin/support')
  .get(adminActionLimiter, async (req, res) => {
    const auth = requireAdmin(req)
    if (!auth.ok) return res.status(auth.status).json({ ok: false, error: auth.error })
    try {
      const result = await listSupportTickets({
        status: req.query?.status,
        limit: req.query?.limit,
      })
      return res.status(result.status).json(result)
    } catch (err) {
      console.error('Support list error:', err)
      return res.status(500).json({ ok: false, error: 'Could not load support tickets.' })
    }
  })
  .post(adminActionLimiter, async (req, res) => {
    const auth = requireAdmin(req)
    if (!auth.ok) return res.status(auth.status).json({ ok: false, error: auth.error })
    try {
      const result = await resolveSupportTicket(
        {
          ticketId: req.body?.ticketId,
          // Explicit false reopens; anything else (including omitted) resolves.
          resolved: req.body?.resolved !== false,
          note: req.body?.note,
        },
        actorFrom(auth),
        requestContext(req),
      )
      return res.status(result.status).json(result)
    } catch (err) {
      console.error('Support update error:', err)
      return res.status(500).json({ ok: false, error: 'Could not update the ticket.' })
    }
  })

// --- Superadmin ---------------------------------------------------------------
//
// The verified-payment ledger is superadmin-only: it is a complete money trail
// (every UTR, every amount, the running total) and a gate admin working the
// queue has no need for it.

app.get('/api/admin/payments', adminActionLimiter, async (req, res) => {
  const auth = await requireSuperAdmin(req)
  if (!auth.ok) return res.status(auth.status).json({ ok: false, error: auth.error })
  try {
    const result = await listVerifiedPayments({
      search: req.query?.search,
      limit: req.query?.limit,
    })
    return res.status(result.status).json(result)
  } catch (err) {
    console.error('Payments ledger error:', err)
    return res.status(500).json({ ok: false, error: 'Could not load payments.' })
  }
})

//
// Everything below is gated by requireSuperAdmin, which returns 403 (not 401)
// for an authenticated plain admin so the client shows "not allowed" instead of
// bouncing to a login screen that would mint the same insufficient token again.

app.get('/api/admin/audit-log', adminActionLimiter, async (req, res) => {
  const auth = await requireSuperAdmin(req)
  if (!auth.ok) return res.status(auth.status).json({ ok: false, error: auth.error })
  try {
    const result = await listAuditLog({
      action: req.query?.action,
      admin: req.query?.admin,
      limit: req.query?.limit,
    })
    return res.status(result.status).json(result)
  } catch (err) {
    console.error('Audit log error:', err)
    return res.status(500).json({ ok: false, error: 'Could not load the activity log.' })
  }
})

app.get('/api/admin/email-log', adminActionLimiter, async (req, res) => {
  const auth = await requireSuperAdmin(req)
  if (!auth.ok) return res.status(auth.status).json({ ok: false, error: auth.error })
  try {
    const result = await listEmailLog({ status: req.query?.status, type: req.query?.type, limit: req.query?.limit })
    return res.status(result.status).json(result)
  } catch (err) {
    console.error('Email log error:', err)
    return res.status(500).json({ ok: false, error: 'Could not load the email log.' })
  }
})

app.get('/api/admin/super-stats', adminActionLimiter, async (req, res) => {
  const auth = await requireSuperAdmin(req)
  if (!auth.ok) return res.status(auth.status).json({ ok: false, error: auth.error })
  try {
    const result = await getSuperStats()
    return res.status(result.status).json(result)
  } catch (err) {
    console.error('Super stats error:', err)
    return res.status(500).json({ ok: false, error: 'Could not load statistics.' })
  }
})

// Seat-capacity override: GET returns the effective value + context, PATCH
// sets it ({capacity: <int>}) or clears it ({capacity: null}).
app
  .route('/api/admin/settings')
  .get(adminActionLimiter, async (req, res) => {
    const auth = await requireSuperAdmin(req)
    if (!auth.ok) return res.status(auth.status).json({ ok: false, error: auth.error })
    try {
      const result = await getSettings()
      return res.status(result.status).json(result)
    } catch (err) {
      console.error('Settings error:', err)
      return res.status(500).json({ ok: false, error: 'Could not load settings.' })
    }
  })
  .patch(adminActionLimiter, async (req, res) => {
    const auth = await requireSuperAdmin(req)
    if (!auth.ok) return res.status(auth.status).json({ ok: false, error: auth.error })
    try {
      const body = req.body || {}
      const actor = actorFrom(auth)
      const context = requestContext(req)
      let result
      if (body.capacity !== undefined) {
        result = await updateSeatCapacity({ capacity: body.capacity }, actor, context)
      } else if (body.price !== undefined) {
        result = await updatePassPrice({ price: body.price }, actor, context)
      } else if (body.registrationOpenOverride !== undefined) {
        result = await updateRegistrationOpenOverride(
          { forceOpen: body.registrationOpenOverride },
          actor,
          context,
        )
      } else {
        result = {
          ok: false,
          status: 400,
          error: 'Provide capacity, price, or registrationOpenOverride.',
        }
      }
      return res.status(result.status).json(result)
    } catch (err) {
      console.error('Settings update error:', err)
      return res.status(500).json({ ok: false, error: 'Could not update settings.' })
    }
  })

// Invalidate a generated QR pass; "resend-ticket" afterwards issues a new one.
app.post('/api/admin/revoke-ticket', adminActionLimiter, async (req, res) => {
  const auth = await requireSuperAdmin(req)
  if (!auth.ok) return res.status(auth.status).json({ ok: false, error: auth.error })
  try {
    const result = await revokeTicket({
      registrationId: req.body?.registrationId,
      actor: actorFrom(auth),
      context: requestContext(req),
    })
    return res.status(result.status).json(result)
  } catch (err) {
    console.error('Revoke ticket error:', err)
    return res.status(500).json({ ok: false, error: 'Could not revoke the QR pass.' })
  }
})

// One path, method-dispatched, so the same shape works on Vercel where a
// path-parameter route (/admins/:id) would need its own function file.
app
  .route('/api/admin/admins')
  .get(adminActionLimiter, async (req, res) => {
    const auth = await requireSuperAdmin(req)
    if (!auth.ok) return res.status(auth.status).json({ ok: false, error: auth.error })
    try {
      const result = await listAdmins()
      return res.status(result.status).json(result)
    } catch (err) {
      console.error('List admins error:', err)
      return res.status(500).json({ ok: false, error: 'Could not load admins.' })
    }
  })
  .post(adminActionLimiter, async (req, res) => {
    const auth = await requireSuperAdmin(req)
    if (!auth.ok) return res.status(auth.status).json({ ok: false, error: auth.error })
    try {
      const result = await createAdmin(req.body || {}, actorFrom(auth), requestContext(req))
      return res.status(result.status).json(result)
    } catch (err) {
      console.error('Create admin error:', err)
      return res.status(500).json({ ok: false, error: 'Could not create the admin.' })
    }
  })
  .patch(adminActionLimiter, async (req, res) => {
    const auth = await requireSuperAdmin(req)
    if (!auth.ok) return res.status(auth.status).json({ ok: false, error: auth.error })
    try {
      const body = req.body || {}
      const actor = actorFrom(auth)
      const context = requestContext(req)
      // isActive is its own operation (with its own last-superadmin guard), so a
      // payload carrying it routes there instead of into the field updater.
      const result =
        body.isActive === undefined
          ? await updateAdmin(body, actor, context)
          : await setAdminActive({ id: body.id, isActive: body.isActive }, actor, context)
      return res.status(result.status).json(result)
    } catch (err) {
      console.error('Update admin error:', err)
      return res.status(500).json({ ok: false, error: 'Could not update the admin.' })
    }
  })

// Terminal error handler — catches thrown errors and malformed JSON from
// express.json() (which otherwise hits Express's default handler and can leak a
// stack trace / internal paths). Must be registered after all routes.
// eslint-disable-next-line no-unused-vars
app.use((err, req, res, _next) => {
  console.error(err)
  res.status(err.status || 500).json({ ok: false, error: 'Request could not be processed.' })
})

// Export the app so tests can drive it with supertest. Only bind a port when this
// file is the process entry point (node server/index.js), not when imported.
export { app }

const isEntry = process.argv[1] && process.argv[1].endsWith('server/index.js')
if (isEntry) {
  app.listen(port, () => {
    console.log(`TEDx API listening on http://localhost:${port}`)
    // Started only for the real server process, never on import — the test suite
    // imports `app` via supertest and must not spawn a background pinger.
    startKeepAlive()
  })
}
