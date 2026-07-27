import 'dotenv/config'
import { createContactMessage } from '../server/contact.js'
import { withApi, LIMITS } from '../server/http.js'

async function handler(req, res) {
  const result = await createContactMessage(req.body || {})
  if (!result.ok) {
    return res.status(result.status).json({
      ok: false,
      error: result.error,
      errors: result.errors,
    })
  }
  return res.status(result.status).json({ ok: true, message: result.message })
}

export default withApi(handler, { methods: ['POST'], limit: LIMITS.contact })
