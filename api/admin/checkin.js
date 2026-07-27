import 'dotenv/config'
import { requireAdmin, checkInTicket, actorFrom } from '../../server/admin.js'
import { requestContext } from '../../server/audit.js'
import { withApi, LIMITS } from '../../server/http.js'

async function handler(req, res) {
  const auth = requireAdmin(req)
  if (!auth.ok) return res.status(auth.status).json({ ok: false, error: auth.error })

  const result = await checkInTicket({
    token: req.body?.token,
    adminName: auth.admin.name || auth.admin.username,
    actor: actorFrom(auth),
    context: requestContext(req),
  })
  return res.status(result.status).json(result)
}

export default withApi(handler, { methods: ['POST'], scope: 'admin', limit: LIMITS.adminAction })
