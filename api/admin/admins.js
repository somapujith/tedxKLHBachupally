import 'dotenv/config'
import { requireSuperAdmin, actorFrom } from '../../server/admin.js'
import { listAdmins, createAdmin, updateAdmin, setAdminActive } from '../../server/admin-users.js'
import { requestContext } from '../../server/audit.js'
import { withApi, LIMITS } from '../../server/http.js'

// One function, method-dispatched. A path-parameter route (/admins/:id) would
// need a second file on Vercel for no gain — the id travels in the body instead.
async function handler(req, res) {
  const auth = await requireSuperAdmin(req)
  if (!auth.ok) return res.status(auth.status).json({ ok: false, error: auth.error })

  const actor = actorFrom(auth)
  const context = requestContext(req)
  const body = req.body || {}

  if (req.method === 'GET') {
    const result = await listAdmins()
    return res.status(result.status).json(result)
  }

  if (req.method === 'POST') {
    const result = await createAdmin(body, actor, context)
    return res.status(result.status).json(result)
  }

  // PATCH. isActive is its own operation (with its own last-superadmin guard),
  // so a payload carrying it routes there rather than into the field updater.
  const result =
    body.isActive === undefined
      ? await updateAdmin(body, actor, context)
      : await setAdminActive({ id: body.id, isActive: body.isActive }, actor, context)
  return res.status(result.status).json(result)
}

export default withApi(handler, {
  methods: ['GET', 'POST', 'PATCH'],
  scope: 'admin',
  limit: LIMITS.adminAction,
})
