import 'dotenv/config'
import { requireAdmin, getStats } from '../../server/admin.js'
import { withApi, LIMITS } from '../../server/http.js'

async function handler(req, res) {
  const auth = requireAdmin(req)
  if (!auth.ok) return res.status(auth.status).json({ ok: false, error: auth.error })

  const result = await getStats()
  return res.status(result.status).json(result)
}

export default withApi(handler, { methods: ['GET'], scope: 'admin', limit: LIMITS.adminAction })
