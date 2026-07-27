import 'dotenv/config'
import { loginAdmin } from '../../server/admin.js'
import { withApi, LIMITS } from '../../server/http.js'

async function handler(req, res) {
  const result = await loginAdmin(req.body || {})
  return res.status(result.status).json(result)
}

// Admin CORS scope + a tight per-IP login cap to blunt credential-stuffing.
export default withApi(handler, { methods: ['POST'], scope: 'admin', limit: LIMITS.login })
