import 'dotenv/config'
import { loginAdmin } from '../../server/admin.js'
import { requestContext } from '../../server/audit.js'
import { withApi, LIMITS } from '../../server/http.js'

async function handler(req, res) {
  // Context is passed so both outcomes land in the audit trail with an IP — a
  // run of login_failed rows from one address is the signal a superadmin needs
  // to spot credential stuffing that the rate limiter merely slowed down.
  const result = await loginAdmin(req.body || {}, requestContext(req))
  return res.status(result.status).json(result)
}

// Admin CORS scope + a tight per-IP login cap to blunt credential-stuffing.
export default withApi(handler, { methods: ['POST'], scope: 'admin', limit: LIMITS.login })
