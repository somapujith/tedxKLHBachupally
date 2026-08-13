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
import { listCoupons, createCoupon, updateCoupon, deleteCoupon } from '../../server/coupons.js'
import { listAuditLog, listEmailLog, getSuperStats, requestContext } from '../../server/audit.js'
import { getSettings, updateSeatCapacity, updatePassPrice } from '../../server/settings.js'
import {
  listPendingVerifications,
  listVerifiedPayments,
  getPaymentProof,
  approvePayment,
  approvePaymentsBulk,
  rejectPayment,
} from '../../server/payments.js'
import { listSupportTickets, resolveSupportTicket } from '../../server/support.js'
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
  // Bank-transfer submissions awaiting a human. GET lists them; GET with
  // ?id=<uuid> returns that row's proof image on its own (the list omits the
  // base64 so opening the queue stays cheap).
  verifications: {
    auth: ADMIN,
    GET: async (req) =>
      req.query?.id
        ? getPaymentProof(req.query.id)
        : listPendingVerifications({ limit: req.query?.limit }),
    // Approving is what issues the pass and sends the confirmation mail.
    POST: async (req, { auth }) => {
      const actor = actorFrom(auth)
      const context = requestContext(req)
      return req.body?.reject
        ? rejectPayment(
            { registrationId: req.body?.registrationId, reason: req.body?.reason },
            actor,
            context,
          )
        : approvePayment({ registrationId: req.body?.registrationId }, actor, context)
    },
  },
  // Attendee-raised support tickets. Any admin can work the queue: answering one
  // uses the same attendee-facing authority check-in and resend already grant.
  support: {
    auth: ADMIN,
    GET: async (req) =>
      listSupportTickets({ status: req.query?.status, limit: req.query?.limit }),
    // Explicit `resolved: false` reopens; anything else (including omitted)
    // resolves, so the common case is a bare {ticketId}.
    POST: async (req, { auth }) =>
      resolveSupportTicket(
        {
          ticketId: req.body?.ticketId,
          resolved: req.body?.resolved !== false,
          note: req.body?.note,
        },
        actorFrom(auth),
        requestContext(req),
      ),
  },
  // Approve many submissions in one action. Superadmin-only, unlike the
  // single-row approval every admin can do: one click here commits a batch of
  // seats and sends a batch of passes, and that is a scale of mistake worth
  // restricting to the account that can also revoke.
  'bulk-verify': {
    auth: SUPER,
    POST: async (req, { auth }) =>
      approvePaymentsBulk(
        { registrationIds: req.body?.registrationIds },
        actorFrom(auth),
        requestContext(req),
      ),
  },
  // The verified-payment ledger: every UTR, amount and approver. Superadmin
  // only — it is a complete money trail, which a gate admin has no need for.
  payments: {
    auth: SUPER,
    GET: async (req) =>
      listVerifiedPayments({ search: req.query?.search, limit: req.query?.limit }),
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
    GET: async (req) => listEmailLog({ status: req.query?.status, type: req.query?.type, limit: req.query?.limit }),
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
    // A payload carrying `price` routes to the pass-price setter; anything else
    // is a capacity change. They are separate settings with separate validation.
    PATCH: async (req, { auth }) =>
      req.body?.price === undefined
        ? updateSeatCapacity({ capacity: req.body?.capacity }, actorFrom(auth), requestContext(req))
        : updatePassPrice({ price: req.body?.price }, actorFrom(auth), requestContext(req)),
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
  // Discount coupons. Superadmin on every method — the listing carries
  // redemption counts (revenue data) and the codes themselves.
  //
  // Deletion rides on PATCH with an explicit `delete: true` rather than a DELETE
  // verb: withApi's method allowlist is shared by every resource in this file,
  // and widening it to DELETE would hand a delete verb to all of them for the
  // sake of one. The Express route keeps a real .delete() — both call the same
  // deleteCoupon(), so behaviour cannot drift.
  coupons: {
    auth: SUPER,
    GET: async () => listCoupons(),
    POST: async (req, { auth }) =>
      createCoupon({
        code: req.body?.code,
        discountAmount: req.body?.discountAmount,
        actor: actorFrom(auth),
      }),
    PATCH: async (req, { auth }) =>
      req.body?.delete === true
        ? deleteCoupon({ id: req.body?.id, actor: actorFrom(auth) })
        : updateCoupon({
            id: req.body?.id,
            discountAmount: req.body?.discountAmount,
            isActive: req.body?.isActive,
            actor: actorFrom(auth),
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

// Vercel's dynamic-route matcher merges the path segment into req.query
// alongside the real query string, and a key that appears more than once
// arrives as an ARRAY, not a string. Every downstream validator here is
// string-only — isUuid() rejects a non-string outright — so an array-shaped
// `id` turned a valid proof request into a bare 400 with nothing logged.
// Collapsing to the first value at the boundary means each resource can keep
// treating req.query.* as a plain string, on both deploy targets.
function firstQueryValue(value) {
  if (Array.isArray(value)) return value.length ? String(value[0]) : ''
  return value === undefined || value === null ? '' : String(value)
}

function normalizeQuery(query) {
  const out = {}
  for (const [key, value] of Object.entries(query || {})) {
    out[key] = firstQueryValue(value)
  }
  return out
}

async function handler(req, res) {
  // Reassigned once, up front, so every resource below reads normalized values.
  req.query = normalizeQuery(req.query)
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
