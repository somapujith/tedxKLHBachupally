// Shared request-management primitives for the Vercel serverless handlers
// (api/*). These are the pieces the Express server (server/index.js) gives us
// out of the box but that serverless functions do NOT have: a rate limiter whose
// counts survive across function instances, an origin-locked CORS layer, JSON
// body-size guarding, and a uniform error envelope.
//
// Everything degrades gracefully: if the KV env vars are unset (local dev, or a
// deploy that has not provisioned Upstash yet) rate limiting is SKIPPED rather
// than crashing the request. That keeps `npm run dev:all` and the test suite
// working with zero extra setup while production gets real, cross-instance limits.

import { Ratelimit } from '@upstash/ratelimit'
import { Redis } from '@upstash/redis'

// --- Rate limiting ------------------------------------------------------------

// One Redis client + a small in-process cache, created once per cold start and
// shared by every limiter. The ephemeral cache lets an already-blocked IP be
// rejected without a Redis round-trip, which matters when 500 users (or a bot)
// hammer the same endpoint during a launch spike.
const ephemeralCache = new Map()

let redis = null
function getRedis() {
  if (redis) return redis
  const url = process.env.UPSTASH_REDIS_REST_URL
  const token = process.env.UPSTASH_REDIS_REST_TOKEN
  if (!url || !token) return null // KV not provisioned — limiting disabled.
  redis = new Redis({ url, token })
  return redis
}

// Limiters are keyed by name so each endpoint class gets its own window and its
// own Redis key namespace. Built lazily and memoized per cold start.
const limiters = new Map()

function getLimiter(name, max, windowSeconds) {
  const client = getRedis()
  if (!client) return null
  const key = `${name}:${max}:${windowSeconds}`
  let limiter = limiters.get(key)
  if (!limiter) {
    limiter = new Ratelimit({
      redis: client,
      limiter: Ratelimit.slidingWindow(max, `${windowSeconds} s`),
      ephemeralCache,
      prefix: `tedx:rl:${name}`,
      analytics: false,
    })
    limiters.set(key, limiter)
  }
  return limiter
}

function firstHeaderValue(v) {
  if (typeof v === 'string' && v.length) return v.split(',')[0].trim()
  if (Array.isArray(v) && v.length) return String(v[0]).split(',')[0].trim()
  return ''
}

// Trusted client IP for rate limiting. A raw, client-supplied `x-forwarded-for`
// is SPOOFABLE — Vercel appends but does not strip it, so its left-most entry is
// attacker-controlled and using it lets one host rotate the header to get a fresh
// rate-limit bucket per request (bypass) or pin a victim's IP (targeted lockout).
// Vercel injects `x-vercel-forwarded-for` (and `x-real-ip`) from the edge, which
// the client cannot forge; prefer those. Raw x-forwarded-for is used only as a
// last resort (self-host / local dev behind a trusted proxy).
export function clientIp(req) {
  const h = req.headers || {}
  return (
    firstHeaderValue(h['x-vercel-forwarded-for']) ||
    firstHeaderValue(h['x-real-ip']) ||
    firstHeaderValue(h['x-forwarded-for']) ||
    req.socket?.remoteAddress ||
    'unknown'
  )
}

// Returns { ok } when allowed, or { ok:false, status:429, retryAfter } when the
// per-IP window is exhausted. No-ops (allows) when KV is not configured.
async function enforceRateLimit(req, res, { name, max, windowSeconds }) {
  const limiter = getLimiter(name, max, windowSeconds)
  if (!limiter) return { ok: true }

  const id = `${name}:${clientIp(req)}`
  let result
  try {
    result = await limiter.limit(id)
  } catch (err) {
    // A KV outage must never take the site down — fail open, but log it so the
    // gap is visible. The atomic DB gates still protect correctness (oversell,
    // double-charge); this layer is abuse mitigation, not a correctness barrier.
    console.error('Rate limiter unavailable, allowing request:', err?.message || err)
    return { ok: true }
  }

  res.setHeader('X-RateLimit-Limit', String(result.limit))
  res.setHeader('X-RateLimit-Remaining', String(Math.max(0, result.remaining)))
  if (result.success) return { ok: true }

  const retryAfter = Math.max(1, Math.ceil((result.reset - nowMs()) / 1000))
  res.setHeader('Retry-After', String(retryAfter))
  return { ok: false, status: 429, retryAfter }
}

// Isolated so the (rare) call to Date.now can be reasoned about / mocked in tests.
function nowMs() {
  return Date.now()
}

// --- CORS ---------------------------------------------------------------------

// Public endpoints (register, payment) are called from the main site origin.
// Admin endpoints are called from the admin origin. Both are locked to an
// allow-list from env; a request from an unlisted origin gets the first allowed
// origin echoed back (a concrete value, never '*') so the browser blocks it.
// With no list configured (local dev) we echo the caller's origin for convenience.
function resolveOrigin(req, allowList) {
  const origin = req.headers?.origin
  // With a configured list, only a listed origin is echoed; anything else gets
  // the first listed origin (a concrete value the browser will reject for a
  // mismatched caller) — never '*'.
  if (allowList.length) return origin && allowList.includes(origin) ? origin : allowList[0]
  // No list configured (local dev). Reflect the caller's origin so dev works, but
  // NEVER emit a blanket '*': that would let any site read public endpoint
  // responses (keyId, emails, payment ids). A request with no Origin (curl /
  // server-to-server) needs no ACAO header at all.
  return origin || null
}

function parseOrigins(envValue) {
  return String(envValue || '')
    .split(',')
    .map((o) => o.trim())
    .filter(Boolean)
}

const publicOrigins = () =>
  parseOrigins(process.env.PUBLIC_ALLOWED_ORIGIN || process.env.ADMIN_ALLOWED_ORIGIN)
const adminOrigins = () => parseOrigins(process.env.ADMIN_ALLOWED_ORIGIN)

function applyCors(req, res, { scope, methods }) {
  const allowList = scope === 'admin' ? adminOrigins() : publicOrigins()
  res.setHeader('Vary', 'Origin')
  res.setHeader('Access-Control-Allow-Methods', methods)
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization')

  // Admin is credentialed. Emitting Allow-Credentials:true alongside an echoed
  // arbitrary origin (which happens when ADMIN_ALLOWED_ORIGIN is unset) would let
  // ANY site make credentialed admin requests — a CSRF/auth-bypass footgun on a
  // misconfigured deploy. So for admin we require an explicit allow-list: no list
  // => no credentialed CORS grant at all (the browser then blocks the request).
  if (scope === 'admin') {
    if (allowList.length === 0) return // no ACAO header => cross-origin blocked
    res.setHeader('Access-Control-Allow-Origin', resolveOrigin(req, allowList))
    res.setHeader('Access-Control-Allow-Credentials', 'true')
    return
  }

  const allowOrigin = resolveOrigin(req, allowList)
  if (allowOrigin) res.setHeader('Access-Control-Allow-Origin', allowOrigin)
}

// --- Handler wrapper ----------------------------------------------------------

// Default per-IP limits (requests / window). Tunable via env for launch spikes.
// Sized for a 500+ concurrent-user event: generous enough that a real person
// clicking through registration is never blocked, tight enough to stop scripted
// abuse. windowSeconds is shared; only the max differs per class.
const DEFAULTS = {
  windowSeconds: Number(process.env.RATE_LIMIT_WINDOW_SECONDS) || 60,
  register: Number(process.env.RATE_LIMIT_REGISTER) || 10,
  // Read-only availability probe. Its own bucket, NOT register's: the GET fires
  // on every page mount, and 10 page views from one campus NAT must not eat the
  // write budget and 429 an actual submit.
  availability: Number(process.env.RATE_LIMIT_AVAILABILITY) || 30,
  payment: Number(process.env.RATE_LIMIT_PAYMENT) || 20,
  contact: Number(process.env.RATE_LIMIT_CONTACT) || 5,
  // Looser than contact: the caller has already registered and is often anxious
  // (paid, no pass yet). The binding abuse guard is the per-email hourly cap
  // enforced in the DB by server/support.js, which holds across instances.
  support: Number(process.env.RATE_LIMIT_SUPPORT) || 15,
  login: Number(process.env.RATE_LIMIT_LOGIN) || 10,
  adminAction: Number(process.env.RATE_LIMIT_ADMIN) || 120,
  webhook: Number(process.env.RATE_LIMIT_WEBHOOK) || 300,
}

// Named presets so each handler declares its class instead of raw numbers.
export const LIMITS = {
  register: { name: 'register', max: DEFAULTS.register, windowSeconds: DEFAULTS.windowSeconds },
  availability: { name: 'availability', max: DEFAULTS.availability, windowSeconds: DEFAULTS.windowSeconds },
  payment: { name: 'payment', max: DEFAULTS.payment, windowSeconds: DEFAULTS.windowSeconds },
  contact: { name: 'contact', max: DEFAULTS.contact, windowSeconds: DEFAULTS.windowSeconds },
  support: { name: 'support', max: DEFAULTS.support, windowSeconds: DEFAULTS.windowSeconds },
  login: { name: 'login', max: DEFAULTS.login, windowSeconds: DEFAULTS.windowSeconds },
  adminAction: { name: 'admin', max: DEFAULTS.adminAction, windowSeconds: DEFAULTS.windowSeconds },
  webhook: { name: 'webhook', max: DEFAULTS.webhook, windowSeconds: DEFAULTS.windowSeconds },
}

const MAX_BODY_BYTES = Number(process.env.MAX_BODY_BYTES) || 16 * 1024 // 16 KB

// Every method that can carry a body. PATCH is included: the admin-management
// handler dispatches on it, so leaving it out let an authenticated superadmin
// post an unbounded payload past the cap.
const BODY_METHODS = new Set(['POST', 'PUT', 'PATCH'])

// Reject oversized JSON bodies before any work. Vercel has already buffered and
// parsed req.body by the time the handler runs, so this guards against a client
// posting a large payload to waste CPU on validation/DB work. Best-effort: uses
// content-length when present, else a serialized-size check on the parsed body.
function bodyTooLarge(req) {
  const len = Number(req.headers?.['content-length'])
  if (Number.isFinite(len) && len > MAX_BODY_BYTES) return true
  if (req.body && typeof req.body === 'object') {
    try {
      if (JSON.stringify(req.body).length > MAX_BODY_BYTES) return true
    } catch {
      return true // circular / unserializable — reject.
    }
  }
  return false
}

/**
 * Wrap a serverless handler with CORS, method allow-listing, per-IP rate
 * limiting, body-size guarding, and a uniform error envelope. The wrapped
 * handler only runs for an allowed method that passed the rate limit.
 *
 * @param {(req, res) => Promise<void>} handler
 * @param {object} opts
 * @param {string[]} opts.methods            Allowed HTTP methods (OPTIONS auto-added).
 * @param {'public'|'admin'} [opts.scope]    CORS allow-list to apply. Default 'public'.
 * @param {{name,max,windowSeconds}} [opts.limit]  Rate-limit preset (LIMITS.*). Omit to skip.
 * @param {boolean} [opts.guardBody]         Reject oversized bodies. Default true.
 */
export function withApi(handler, { methods, scope = 'public', limit, guardBody = true } = {}) {
  const allowed = new Set([...(methods || []), 'OPTIONS'])
  const methodsHeader = [...allowed].join(', ')

  return async function wrapped(req, res) {
    try {
      applyCors(req, res, { scope, methods: methodsHeader })

      if (req.method === 'OPTIONS') return res.status(204).end()

      if (!allowed.has(req.method)) {
        return res.status(405).json({ ok: false, error: 'Method not allowed.' })
      }

      if (guardBody && BODY_METHODS.has(req.method) && bodyTooLarge(req)) {
        return res.status(413).json({ ok: false, error: 'Request body too large.' })
      }

      if (limit) {
        const gate = await enforceRateLimit(req, res, limit)
        if (!gate.ok) {
          return res
            .status(429)
            .json({ ok: false, error: 'Too many requests. Please try again shortly.' })
        }
      }

      return await handler(req, res)
    } catch (err) {
      // Terminal safety net: never leak a stack trace or internal path to the
      // client. Individual handlers still catch their own domain errors and
      // return specific messages; this only fires on the unexpected.
      console.error('Unhandled API error:', err)
      if (res.headersSent) return
      return res.status(500).json({ ok: false, error: 'Request could not be processed.' })
    }
  }
}
