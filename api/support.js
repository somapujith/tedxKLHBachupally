import 'dotenv/config'
import { createSupportTicket } from '../server/support.js'
import { withApi, LIMITS } from '../server/http.js'

// An attendee raises a support ticket from the confirmation screen. Message
// only — this never changes a registration's payment state.
async function handler(req, res) {
  const result = await createSupportTicket(req.body || {})
  if (!result.ok) {
    return res.status(result.status).json({
      ok: false,
      error: result.error,
      errors: result.errors,
    })
  }
  return res.status(result.status).json({
    ok: true,
    ticket: result.ticket,
    message: result.message,
  })
}

export default withApi(handler, { methods: ['POST'], limit: LIMITS.support })
