// Self keep-alive pinger.
//
// Render's free plan spins an instance down after ~15 minutes with no inbound
// traffic, and the next visitor pays a 30-60s cold start. The browser-side
// warm-up (src/hooks/useBackendWarmup.js) only helps while somebody actually has
// the site open; overnight, or during any quiet stretch, there is no traffic at
// all and the instance sleeps. This makes the service generate its own.
//
// It works by requesting its OWN PUBLIC URL, not by calling a local function.
// That matters: Render counts inbound HTTP requests through its router, so an
// in-process function call would keep nothing alive. Render injects
// RENDER_EXTERNAL_URL automatically; KEEP_ALIVE_URL overrides it for other hosts.
//
// LIMIT WORTH KNOWING: a self-ping cannot WAKE an instance that has already spun
// down — a sleeping process runs no timers. It keeps a live instance live. The
// cron workflow in .github/workflows/keep-alive.yml is the external counterpart
// that can also wake one, and the two are meant to run together.

const DEFAULT_INTERVAL_MS = 10 * 60 * 1000 // 10 minutes — well inside Render's ~15min idle window
const REQUEST_TIMEOUT_MS = 30_000 // a cold instance answering slowly is still a success

function resolveBaseUrl() {
  const raw = process.env.KEEP_ALIVE_URL || process.env.RENDER_EXTERNAL_URL || ''
  return raw.trim().replace(/\/+$/, '')
}

/**
 * Start pinging this service's own /api/health on an interval.
 *
 * No-ops (and says why) when no public URL is configured, so local dev and the
 * test suite never spawn a background timer or make outbound requests.
 *
 * @param {object} [options]
 * @param {number} [options.intervalMs] Override the ping cadence.
 * @param {string} [options.baseUrl]    Override the target origin.
 * @returns {{ stop: () => void } | null} Handle to cancel, or null if disabled.
 */
export function startKeepAlive({ intervalMs = DEFAULT_INTERVAL_MS, baseUrl } = {}) {
  const base = (baseUrl || resolveBaseUrl()).replace(/\/+$/, '')

  if (!base) {
    console.log(
      'Keep-alive disabled: set KEEP_ALIVE_URL (or deploy on Render, which sets RENDER_EXTERNAL_URL).',
    )
    return null
  }

  const target = `${base}/api/health`
  const cadence =
    intervalMs >= 60_000 ? `${Math.round(intervalMs / 60_000)} min` : `${Math.round(intervalMs / 1000)}s`
  console.log(`Keep-alive enabled: pinging ${target} every ${cadence}`)

  async function ping() {
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS)
    try {
      const res = await fetch(target, {
        signal: controller.signal,
        headers: { 'User-Agent': 'tedx-keepalive' },
      })
      if (!res.ok) console.warn(`Keep-alive ping got HTTP ${res.status}`)
    } catch (err) {
      // Never throw out of a background timer — an unhandled rejection here
      // would take the whole API process down over a missed ping.
      console.warn('Keep-alive ping failed:', err?.message || err)
    } finally {
      clearTimeout(timer)
    }
  }

  const id = setInterval(ping, intervalMs)
  // unref so this timer alone never keeps the Node process alive during shutdown.
  id.unref?.()

  return {
    stop() {
      clearInterval(id)
    },
  }
}
