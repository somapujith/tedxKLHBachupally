import 'dotenv/config'
import { verifyPayment } from '../../server/payments.js'
import { withApi, LIMITS } from '../../server/http.js'

async function handler(req, res) {
  const result = await verifyPayment(req.body || {})
  if (!result.ok) {
    return res.status(result.status).json({ ok: false, error: result.error, soldOut: result.soldOut })
  }
  // Only the fields the UI needs — not the raw registration row.
  return res.status(result.status).json({
    ok: true,
    registration: {
      email: result.registration?.email,
      payment_status: result.registration?.payment_status,
      razorpay_payment_id: result.registration?.razorpay_payment_id,
    },
  })
}

export default withApi(handler, { methods: ['POST'], limit: LIMITS.payment })
