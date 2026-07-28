import 'dotenv/config'
import {
  requireAdmin,
  requireSuperAdmin,
  actorFrom,
  getStats,
  listRegistrations,
  checkInTicket,
  resendTicket,
  revokeTicket,
} from '../../server/admin.js'
import { listAdmins, createAdmin, updateAdmin, setAdminActive } from '../../server/admin-users.js'
import { listAuditLog, listEmailLog, getSuperStats, requestContext } from '../../server/audit.js'
import { getSettings, updateSeatCapacity } from '../../server/settings.js'
import { withApi, LIMITS } from '../../server/http.js'

// One function for every authenticated admin endpoint.
//
// Vercel's Hobby plan caps a deployment at 12 serverless functions, and one file
// per endpoint had reached 15. These eight share an auth gate, a rate-limit class
// and a response envelope, so collapsing them costs nothing in clarity and buys
// back seven slots. /api/admin/login keeps its own file: it is unauthenticated
// and needs the tighter credential-stuffing limit, and an exact filename wins
// over this dynamic route in Vercel's matcher.
//
// The segment is [resource], NOT [action]: the activity screen already requests
// /api/admin/audit-log?action=checkin_success, and naming the segment `action`
// would collide with that query parameter inside req.query.
//
// Express (server/index.js) keeps one route per path. That is deliberate — the
// self-host path has no function budget, and explicit routes read better there.
// Both call the identical service functions, so behaviour cannot drift.

const SUPER = 'superadmin'
const ADMIN = 'admin'

// method -> handler, plus the role each resource demands. `auth` is the level
// required, never what the caller claims.
const RESOURCES = {
  stats: {
    auth: ADMIN,
    GET: async () => getStats(),
  },
  registrations: {
    auth: ADMIN,
    GET: async (req) => listRegistrations({ status: req.query?.status }),
  },
  checkin: {
    auth: ADMIN,
    POST: async (req, { auth }) =>
      checkInTicket({
        token: req.body?.token,
        adminName: auth.admin.name || auth.admin.username,
        actor: actorFrom(auth),
        context: requestContext(req),
      }),
  },
  'resend-ticket': {
    auth: ADMIN,
    POST: async (req, { auth }) =>
      resendTicket({
        registrationId: req.body?.registrationId,
        actor: actorFrom(auth),
        context: requestContext(req),
      }),
  },
  'audit-log': {
    auth: SUPER,
    GET: async (req) =>
      listAuditLog({
        action: req.query?.action,
        admin: req.query?.admin,
        limit: req.query?.limit,
      }),
  },
  'email-log': {
    auth: SUPER,
    GET: async (req) => listEmailLog({ status: req.query?.status, limit: req.query?.limit }),
  },
  'super-stats': {
    auth: SUPER,
    GET: async () => getSuperStats(),
  },
  // Seat-capacity override. PATCH {capacity: <int>} sets it; {capacity: null}
  // clears it back to the env/default.
  settings: {
    auth: SUPER,
    GET: async () => getSettings(),
    PATCH: async (req, { auth }) =>
      updateSeatCapacity(
        { capacity: req.body?.capacity },
        actorFrom(auth),
        requestContext(req),
      ),
  },
  // Invalidate a generated QR pass; "resend-ticket" afterwards issues a new one.
  'revoke-ticket': {
    auth: SUPER,
    POST: async (req, { auth }) =>
      revokeTicket({
        registrationId: req.body?.registrationId,
        actor: actorFrom(auth),
        context: requestContext(req),
      }),
  },
  admins: {
    auth: SUPER,
    GET: async () => listAdmins(),
    POST: async (req, { auth }) => createAdmin(req.body || {}, actorFrom(auth), requestContext(req)),
    // isActive is its own operation (with its own last-superadmin guard), so a
    // payload carrying it routes there rather than into the field updater.
    PATCH: async (req, { auth }) => {
      const body = req.body || {}
      const actor = actorFrom(auth)
      const context = requestContext(req)
      return body.isActive === undefined
        ? updateAdmin(body, actor, context)
        : setAdminActive({ id: body.id, isActive: body.isActive }, actor, context)
    },
  },
}

async function handler(req, res) {
  const key = String(req.query?.resource || '')
  // hasOwnProperty, not `RESOURCES[key]` directly — a request for
  // /api/admin/constructor must be a 404, not a truthy prototype member.
  const resource = Object.prototype.hasOwnProperty.call(RESOURCES, key) ? RESOURCES[key] : null
  if (!resource) {
    return res.status(404).json({ ok: false, error: 'Unknown admin endpoint.' })
  }

  // Authorize BEFORE checking the method, so an unauthenticated probe cannot
  // map which methods each endpoint accepts.
  const auth = resource.auth === SUPER ? await requireSuperAdmin(req) : requireAdmin(req)
  if (!auth.ok) return res.status(auth.status).json({ ok: false, error: auth.error })

  // withApi allows the union of methods across all resources, so each one still
  // has to reject the methods it does not implement.
  const run = resource[req.method]
  if (!run) {
    return res.status(405).json({ ok: false, error: 'Method not allowed.' })
  }

  const result = await run(req, { auth })
  return res.status(result.status).json(result)
}

export default withApi(handler, {
  methods: ['GET', 'POST', 'PATCH'],
  scope: 'admin',
  limit: LIMITS.adminAction,
})
