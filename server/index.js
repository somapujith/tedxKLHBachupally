import 'dotenv/config'
import express from 'express'
import cors from 'cors'
import rateLimit from 'express-rate-limit'
import { createRegistration } from './registrations.js'
import { ensureRegistrationsTable } from './db.js'
import { createOrder, verifyPayment, handleWebhook } from './payments.js'
import { createContactMessage } from './contact.js'
import {
  loginAdmin,
  requireAdmin,
  getStats,
  listRegistrations,
  checkInTicket,
  resendTicket,
} from './admin.js'

const app = express()
const port = Number(process.env.PORT) || 3001

// Admin CORS allow-list from env (comma-separated). Only the request Origin is
// echoed back, and only when it matches; unset/unknown origins fall back to the
// first configured origin so browsers get a concrete value, never '*'.
const adminOrigins = String(process.env.ADMIN_ALLOWED_ORIGIN || '')
  .split(',')
  .map((o) => o.trim())
  .filter(Boolean)

function corsOrigin(origin, callback) {
  if (adminOrigins.length === 0) return callback(null, true) // dev: no list set
  if (origin && adminOrigins.includes(origin)) return callback(null, origin)
  return callback(null, adminOrigins[0])
}

app.use(cors({ origin: corsOrigin, credentials: true }))

// Rate limiters (Express/self-host only). NOTE: express-rate-limit's default store
// is in-memory and per-instance — on Vercel's serverless deployment it does NOT
// share counts across function instances. A KV-backed store (Upstash / Vercel KV)
// is required for real limiting there; the api/* wrappers do not include this.
// Disabled under test so the supertest suite is not throttled.
const isTest = process.env.NODE_ENV === 'test'
const makeLimiter = (max) =>
  rateLimit({
    windowMs: 15 * 60 * 1000,
    max: isTest ? 100000 : max,
    standardHeaders: true,
    legacyHeaders: false,
    message: { ok: false, error: 'Too many requests. Please try again later.' },
  })

const loginLimiter = makeLimiter(10) // 10 login attempts / 15 min / IP
const adminActionLimiter = makeLimiter(60) // lighter cap for checkin / resend
const contactLimiter = makeLimiter(5) // 5 contact messages / 15 min / IP

// Webhook must read the RAW body for HMAC verification — register before express.json().
app.post(
  '/api/payment/webhook',
  express.raw({ type: '*/*' }),
  async (req, res) => {
    const signature = req.get('x-razorpay-signature')
    try {
      const result = await handleWebhook(req.body, signature)
      return res.status(result.status).json(result)
    } catch (err) {
      console.error('Webhook error:', err)
      return res.status(500).json({ ok: false, error: 'Webhook processing failed.' })
    }
  },
)

app.use(express.json())

app.get('/api/health', async (_req, res) => {
  try {
    await ensureRegistrationsTable()
    res.json({ ok: true, db: 'connected' })
  } catch (err) {
    console.error(err)
    res.status(500).json({ ok: false, db: 'error' })
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

app.post('/api/payment/order', async (req, res) => {
  try {
    const result = await createOrder({ registrationId: req.body?.registrationId })
    return res.status(result.status).json(result)
  } catch (err) {
    console.error('Order error:', err)
    return res.status(500).json({ ok: false, error: 'Could not start payment.' })
  }
})

app.post('/api/payment/verify', async (req, res) => {
  try {
    const result = await verifyPayment(req.body || {})
    return res.status(result.status).json(result)
  } catch (err) {
    console.error('Verify error:', err)
    return res.status(500).json({ ok: false, error: 'Could not verify payment.' })
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

app.post('/api/admin/login', loginLimiter, async (req, res) => {
  try {
    const result = await loginAdmin(req.body || {})
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
    const result = await resendTicket({ registrationId: req.body?.registrationId })
    return res.status(result.status).json(result)
  } catch (err) {
    console.error('Admin resend error:', err)
    return res.status(500).json({ ok: false, error: 'Could not resend ticket.' })
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
  })
}
