// Backend warm-up service.
//
// The API runs on a Render instance that SPINS DOWN when idle. The first request
// after a spin-down takes 30-60s while the container boots — long enough that a
// user clicking "Continue to secure payment" would just watch a dead button and
// leave. That is the worst possible moment to be slow: it is the moment we take
// money.
//
// So the site pokes the backend continuously while people browse (every route
// change + a keep-alive tick), and the register page refuses to submit until this
// module confirms the backend actually answered. The boot then happens during the
// minutes someone spends reading the speaker list, not during checkout.
//
// State lives at MODULE scope, not in React, on purpose: it is one fact about one
// backend shared by every component, and it must survive route changes and
// unmounts.
//
// Consumers:
//   - src/hooks/useBackendWarmup.js  — fires warmBackend() on route change / focus
//   - src/hooks/useBackendQueue.js   — preflight + polls pingBackend() while queueing
//   - src/pages/Register.jsx         — gates submit on the queue hook

import { apiFetch } from './api.js'

export const HEALTH_PATH = '/api/health'

// How long a successful probe is trusted before we consider the answer stale.
//
// This MUST stay larger than useBackendWarmup's KEEP_ALIVE_MS. If freshness
// expired sooner than the keep-alive tick that refreshes it, every cycle would
// contain a dead zone where a perfectly healthy backend reads as not-warm — and
// anyone who submitted inside that zone would be shown a queue screen for a
// backend that was up the whole time.
const FRESH_MS = 60_000

// Floor between background probes, so a burst of route changes (a user clicking
// through four pages in ten seconds) does not become four requests.
const THROTTLE_MS = 15_000

// A background probe should never hold anything up — it is fire-and-forget, and a
// slow answer is itself the signal that the backend is cold.
const BACKGROUND_TIMEOUT_MS = 6_000

// The probe taken the instant someone hits submit, before any queue screen is
// shown. Short: this is latency the user feels on the happy path.
export const PREFLIGHT_TIMEOUT_MS = 4_000

// A probe made from inside the queue gate is allowed to wait much longer: the
// user is already looking at a countdown, and a slow SUCCESS is far more valuable
// there than a fast false negative.
const QUEUE_TIMEOUT_MS = 12_000

const state = {
  lastOkAt: 0,
  lastCheckAt: 0,
}

// A single shared probe. Concurrent callers (route change + keep-alive tick +
// queue poll landing together) all await the SAME request instead of stacking
// requests onto an instance that is already struggling to boot.
let inFlight = null

/** True when the backend answered recently enough to submit against it. */
export function isBackendWarm() {
  if (state.lastOkAt === 0) return false
  const age = Date.now() - state.lastOkAt
  // A NEGATIVE age means the wall clock moved backwards under us (an NTP
  // correction, a user fixing their clock, a VM resync). Treating that as "warm"
  // would pin this module warm for the whole skew and stop it ever probing
  // again, so an impossible age is treated as stale.
  if (age < 0) return false
  return age < FRESH_MS
}

/**
 * Record that the backend is definitely up. Called on a successful probe, and by
 * Register.jsx when a real API call succeeds — a 200 from /api/register is
 * stronger evidence of liveness than any health check.
 */
export function markBackendWarm() {
  const now = Date.now()
  state.lastOkAt = now
  state.lastCheckAt = now
}

/**
 * Record that the backend is definitely DOWN.
 *
 * This is the counterpart that must not be forgotten: without it, a probe that
 * explicitly proved the backend dead would leave the previous success standing,
 * and isBackendWarm() would keep waving submissions through for the rest of the
 * freshness window — precisely the case this whole module exists to catch.
 */
export function markBackendCold() {
  state.lastOkAt = 0
  state.lastCheckAt = Date.now()
}

/**
 * Probe the backend once. Resolves true when it answered, false otherwise —
 * it never rejects, because "is it up?" always has an answer.
 *
 * Note on cold starts: even a probe that TIMES OUT is useful. The request has
 * already reached Render's router and triggered the container boot; aborting on
 * our side does not cancel it. So a failed first ping is what makes the second
 * ping succeed, which is exactly the behaviour the queue gate relies on.
 */
export function pingBackend({ timeoutMs = QUEUE_TIMEOUT_MS } = {}) {
  if (inFlight) return inFlight

  state.lastCheckAt = Date.now()
  const probe = (async () => {
    try {
      const { ok } = await apiFetch(HEALTH_PATH, { timeoutMs, retries: 0 })
      if (ok) {
        markBackendWarm()
        return true
      }
    } catch {
      // Network failure or timeout. Indistinguishable from "cold" here, and
      // treated as such — no need to inspect the error.
    }
    markBackendCold()
    return false
  })().finally(() => {
    // Only clear the slot if it is still OURS. resetBackendHealth() (or a
    // future cancellation) can null it out while this probe is still pending;
    // clearing unconditionally would then wipe a NEWER probe's registration and
    // let two real requests run concurrently — the exact thing the dedupe exists
    // to prevent.
    if (inFlight === probe) inFlight = null
  })

  inFlight = probe
  return probe
}

/**
 * Background warm-up. Cheap, throttled, and safe to call on every route change.
 * Resolves to the resulting warm state.
 *
 * @param {object}  [options]
 * @param {boolean} [options.force] Skip the freshness/throttle short-circuits.
 *                                  The keep-alive tick uses this: its whole job
 *                                  is to generate traffic, so a short-circuit
 *                                  would defeat it.
 */
export function warmBackend({ force = false } = {}) {
  // A hidden tab is not about to buy a ticket, and browsers throttle its timers
  // anyway. Don't keep an instance alive (or burn requests) for a background tab.
  if (!force && typeof document !== 'undefined' && document.visibilityState === 'hidden') {
    return Promise.resolve(isBackendWarm())
  }

  if (!force) {
    if (isBackendWarm()) return Promise.resolve(true)
    if (Date.now() - state.lastCheckAt < THROTTLE_MS) {
      // Report what we actually know rather than a blanket false — a throttled
      // call is "no new information", not "the backend is down".
      return inFlight || Promise.resolve(isBackendWarm())
    }
  }

  return pingBackend({ timeoutMs: force ? QUEUE_TIMEOUT_MS : BACKGROUND_TIMEOUT_MS })
}

/**
 * Drop all cached liveness state. Exists for tests, which need each case to start
 * from a known backend state rather than inherit the previous test's.
 */
export function resetBackendHealth() {
  state.lastOkAt = 0
  state.lastCheckAt = 0
  inFlight = null
}
