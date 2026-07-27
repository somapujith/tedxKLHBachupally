import 'dotenv/config'
import { requireSuperAdmin } from '../../server/admin.js'
import { listAuditLog } from '../../server/audit.js'
import { withApi, LIMITS } from '../../server/http.js'

async function handler(req, res) {
  const auth = await requireSuperAdmin(req)
  if (!auth.ok) return res.status(auth.status).json({ ok: false, error: auth.error })

  const result = await listAuditLog({
    action: req.query?.action,
    admin: req.query?.admin,
    limit: req.query?.limit,
  })
  return res.status(result.status).json(result)
}

export default withApi(handler, { methods: ['GET'], scope: 'admin', limit: LIMITS.adminAction })
