import { useEffect } from 'react'
import { useLocation } from 'react-router-dom'
import { warmBackend } from '../lib/backendHealth.js'

// Keep-alive cadence. Render spins an idle instance down after ~15 minutes, so
// regular traffic keeps the API hot for as long as anyone is on the site.
//
// This MUST stay shorter than backendHealth's FRESH_MS. The tick refreshes the
// cached answer; if it ran less often than that answer expired, every cycle would
// contain a window where a healthy backend reads as not-warm and a submit inside
// it would be met with a queue screen for no reason.
const KEEP_ALIVE_MS = 40_000

/**
 * Warm the backend continuously while someone browses, so it is already up by the
 * time they reach the register page.
 *
 * Mounted once in the public Layout, which means every public route change runs
 * it. Three triggers, each covering a different way a visitor goes quiet:
 *
 *   1. route change — the main one. Reading the theme page boots the API.
 *   2. keep-alive interval — someone parked on one long page still counts.
 *   3. tab focus / network recovery — a tab left open for an hour, or a phone
 *      that dropped off wifi, re-probes the moment it matters again.
 *
 * warmBackend() throttles and de-dupes internally, so these three overlapping
 * triggers still produce at most one request per throttle window.
 */
export function useBackendWarmup() {
  const { pathname } = useLocation()

  useEffect(() => {
    warmBackend()
  }, [pathname])

  useEffect(() => {
    // force: the tick's entire purpose is to generate traffic so Render does not
    // spin the instance down. Letting it short-circuit on a cached answer would
    // mean it produces no request at all and keeps nothing alive.
    const tick = () => warmBackend({ force: true })

    const onVisibilityChange = () => {
      if (document.visibilityState === 'visible') warmBackend()
    }
    // Coming back online is the one case worth forcing: the cached "cold" answer
    // was about the dead connection, not about the backend.
    const onOnline = () => warmBackend({ force: true })

    const intervalId = setInterval(tick, KEEP_ALIVE_MS)
    document.addEventListener('visibilitychange', onVisibilityChange)
    window.addEventListener('online', onOnline)

    return () => {
      clearInterval(intervalId)
      document.removeEventListener('visibilitychange', onVisibilityChange)
      window.removeEventListener('online', onOnline)
    }
  }, [])
}
