import 'dotenv/config'
import express from 'express'
import cors from 'cors'
import { createRegistration } from './registrations.js'
import { ensureRegistrationsTable } from './db.js'
import { createOrder, verifyPayment, handleWebhook } from './payments.js'

const app = express()
const port = Number(process.env.PORT) || 3001

app.use(cors())

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

// Export the app so tests can drive it with supertest. Only bind a port when this
// file is the process entry point (node server/index.js), not when imported.
export { app }

const isEntry = process.argv[1] && process.argv[1].endsWith('server/index.js')
if (isEntry) {
  app.listen(port, () => {
    console.log(`TEDx API listening on http://localhost:${port}`)
  })
}
