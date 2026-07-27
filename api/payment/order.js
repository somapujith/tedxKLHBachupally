import 'dotenv/config'
import { createOrder } from '../../server/payments.js'
import { withApi, LIMITS } from '../../server/http.js'

async function handler(req, res) {
  const result = await createOrder({ registrationId: req.body?.registrationId })
  // Allow-list the response shape — never echo the internal service object
  // verbatim, so a future added field cannot leak to the client by accident.
  if (!result.ok) {
    return res.status(result.status).json({
      ok: false,
      error: result.error,
      soldOut: result.soldOut,
    })
  }
  return res.status(result.status).json({
    ok: true,
    order: result.order,
    keyId: result.keyId,
    registration: result.registration,
  })
}

export default withApi(handler, { methods: ['POST'], limit: LIMITS.payment })
