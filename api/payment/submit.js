import 'dotenv/config'
import { submitPaymentProof } from '../../server/payments.js'
import { withApi, LIMITS } from '../../server/http.js'

// Buyer submits their bank-transfer proof (UTR + screenshot). Nothing is issued
// here — an admin has to approve the submission before a pass exists.
async function handler(req, res) {
  const result = await submitPaymentProof({
    registrationId: req.body?.registrationId,
    utrId: req.body?.utrId,
    proof: req.body?.proof,
  })
  if (!result.ok) {
    return res.status(result.status).json({
      ok: false,
      error: result.error,
      soldOut: result.soldOut,
    })
  }
  return res.status(result.status).json({ ok: true, registration: result.registration })
}

export default withApi(handler, { methods: ['POST'], limit: LIMITS.register })
