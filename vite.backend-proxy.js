// Dev-server backend connectivity reporter.
//
// The checkout flow polls /api/health continuously while the site is open (see
// src/lib/backendHealth.js — it warms the Render instance so a cold start never
// lands on the payment button). That means when the API is NOT running, Vite's
// default proxy handler prints a six-line ECONNREFUSED stack trace every few
// seconds, forever, burying every other line of dev output.
//
// A stack trace is also the wrong information. "AggregateError [ECONNREFUSED]
// at internalConnectMultiple" does not say the backend is down or how to start
// it — and printing it 23 times does not make it clearer.
//
// This reports the same fact as ONE message per state CHANGE:
//   - backend answered  -> "Backend online" (with how long it was down)
//   - backend stopped   -> "Backend offline", the reason, and the fix
//   - steady state      -> silence
//
// Wiring (both halves are required — see vite.config.js):
//   1. `configure` is passed to the /api proxy; that is what detects the state.
//   2. `plugin` probes once at dev-server startup so the status is known before
//      the first request, and PROXY_ERROR_PATTERN feeds the customLogger filter
//      that silences Vite's own trace.

/** Matches Vite's own proxy-error log lines, which this module replaces. */
export const PROXY_ERROR_PATTERN = /^\s*(?:\x1b\[[0-9;]*m)*(?:http|ws) proxy (?:socket )?error/

const GREEN = '\x1b[32m'
const RED = '\x1b[31m'
const DIM = '\x1b[2m'
const BOLD = '\x1b[1m'
const RESET = '\x1b[0m'

// Plain-language cause per socket error code. The code alone ("ECONNREFUSED")
// is accurate but tells a reader nothing actionable.
const REASONS = {
  ECONNREFUSED: 'nothing is listening on that port',
  ENOTFOUND: 'host not found — check the target URL',
  ETIMEDOUT: 'no response before the timeout',
  ECONNRESET: 'the connection was dropped mid-request',
  EHOSTUNREACH: 'host unreachable — check your network',
  EPIPE: 'the connection closed while sending',
  ECONNABORTED: 'the connection was aborted',
  CERT_HAS_EXPIRED: 'the TLS certificate has expired',
}

// Digging out the real code takes two unwraps, and skipping either one is how
// this ends up printing something useless:
//   - Node's happy-eyeballs dialer reports a failed connect as an AggregateError
//     with NO top-level `code` — the codes sit on the nested `errors`. That is
//     why the raw output says "AggregateError" and nothing more.
//   - `fetch` (used by the startup probe) buries all of that another layer down,
//     under `TypeError: fetch failed` with the socket error as `.cause`.
const MAX_CAUSE_DEPTH = 5

function errorCode(err, depth = 0) {
  if (!err || depth > MAX_CAUSE_DEPTH) return 'UNKNOWN'
  if (err.code) return err.code

  for (const nested of err.errors || []) {
    const code = errorCode(nested, depth + 1)
    if (code !== 'UNKNOWN') return code
  }

  return err.cause ? errorCode(err.cause, depth + 1) : 'UNKNOWN'
}

function formatDuration(ms) {
  const totalSeconds = Math.max(0, Math.round(ms / 1000))
  if (totalSeconds < 60) return `${totalSeconds}s`
  const minutes = Math.floor(totalSeconds / 60)
  const seconds = totalSeconds % 60
  return seconds === 0 ? `${minutes}m` : `${minutes}m ${seconds}s`
}

/**
 * Build the reporter for one proxy target.
 *
 * @param {object}   options
 * @param {string}   options.target    Proxy target, echoed in every message so
 *                                     it is obvious WHICH backend is meant.
 * @param {string}   [options.hint]    Command that starts the backend locally.
 * @param {string}   [options.healthPath]
 * @param {object}   [options.logger]  Vite logger, or any console-like object.
 * @param {number}   [options.probeTimeoutMs]
 * @param {() => number} [options.now] Injected clock, so tests need no timers.
 */
export function createBackendReporter({
  target,
  hint = 'npm run dev:server',
  healthPath = '/api/health',
  logger = console,
  probeTimeoutMs = 4000,
  now = () => Date.now(),
} = {}) {
  if (!target) throw new Error('createBackendReporter: `target` is required')

  const info = (msg) => (logger.info ? logger.info(msg, { timestamp: true }) : logger.log?.(msg))
  const warn = (msg) => (logger.warn ? logger.warn(msg, { timestamp: true }) : logger.log?.(msg))

  let state = 'unknown' // 'unknown' | 'online' | 'offline'
  let downSince = 0
  // Requests that failed during the CURRENT outage. Reported on recovery so a
  // silent outage is not mistaken for an idle one.
  let failuresWhileDown = 0

  function markOnline() {
    if (state === 'online') return
    if (state === 'offline') {
      const outage = formatDuration(now() - downSince)
      const attempts = failuresWhileDown === 1 ? '1 request' : `${failuresWhileDown} requests`
      info(
        `${GREEN}${BOLD}✔ Backend back online${RESET} ${DIM}${target} — was down ${outage}, ${attempts} failed${RESET}`,
      )
    } else {
      info(`${GREEN}${BOLD}✔ Backend online${RESET} ${DIM}${target}${RESET}`)
    }
    state = 'online'
    downSince = 0
    failuresWhileDown = 0
  }

  function markOffline(err) {
    failuresWhileDown += 1
    // Already reported. Staying silent here is the entire point of this module:
    // the health probe keeps failing every few seconds until someone fixes it.
    if (state === 'offline') return

    downSince = now()
    state = 'offline'

    const code = errorCode(err)
    const reason = REASONS[code] || err?.message || 'the request failed'
    warn(
      `${RED}${BOLD}✖ Backend offline${RESET} ${DIM}${target}${RESET}\n` +
        `  ${RED}${code}${RESET} — ${reason}\n` +
        `  ${DIM}Start it with:${RESET} ${BOLD}${hint}${RESET}${DIM}  (or \`npm run dev:all\` for web + API together)${RESET}\n` +
        `  ${DIM}Further failures stay silent until it recovers.${RESET}`,
    )
  }

  /**
   * One-shot probe. Used at startup so the first thing printed is the real
   * status, rather than the status being implied later by the first failure.
   */
  async function probe() {
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), probeTimeoutMs)
    try {
      await fetch(new URL(healthPath, target), { signal: controller.signal })
      markOnline()
      return true
    } catch (err) {
      // An abort here means the backend did not answer in time, which for the
      // purpose of "can I develop against it" is the same as being down.
      markOffline(controller.signal.aborted ? { code: 'ETIMEDOUT' } : err)
      return false
    } finally {
      clearTimeout(timer)
    }
  }

  return {
    /** Current view of the backend. Exposed for tests. */
    get status() {
      return state
    },

    probe,

    /**
     * Vite proxy `configure` hook. Vite invokes this BEFORE registering its own
     * error handler, so responding here runs first and leaves Vite's handler to
     * no-op on `headersSent` — which is how the stack-trace 500 is avoided.
     */
    configure(proxy) {
      // Any response at all proves the process is alive. A 404 or a 500 from the
      // backend is still the backend answering, and must not read as "offline" —
      // that is an application bug, a different problem with a different fix.
      proxy.on('proxyRes', () => markOnline())

      proxy.on('error', (err, _req, res) => {
        markOffline(err)

        // Answer the browser ourselves. Vite's default is an empty 500
        // text/plain; a JSON 503 is both truthful (service unavailable, not a
        // proxy fault) and parseable by src/lib/api.js without it having to
        // special-case an empty body.
        if (res && typeof res.writeHead === 'function') {
          if (!res.headersSent && !res.writableEnded) {
            res.writeHead(503, { 'Content-Type': 'application/json' })
            res.end(JSON.stringify({ ok: false, error: 'Backend unavailable.' }))
          }
          return
        }
        // WebSocket upgrades hand us a raw socket, which has no writeHead.
        res?.destroy?.()
      })
    },

    /** Vite plugin half: probe once the dev server is actually listening. */
    plugin: {
      name: 'tedx:backend-status',
      apply: 'serve',
      configureServer(server) {
        // Probing before `listening` would race the startup banner and print
        // above it. Detached on purpose — a slow probe must not delay startup.
        server.httpServer?.once('listening', () => {
          probe()
        })
      },
    },
  }
}
