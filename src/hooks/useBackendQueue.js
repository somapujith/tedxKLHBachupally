import { useCallback, useEffect, useRef, useState } from 'react'
import { isBackendWarm, pingBackend, PREFLIGHT_TIMEOUT_MS } from '../lib/backendHealth.js'

// The gate the user actually sees. Every constant here is a UX decision, so they
// are named and explained rather than inlined.

// Minimum time the queue screen stays up ONCE IT APPEARS. A cold Render container
// takes 30-60s to boot, so this is roughly "one boot" — and holding the screen for
// the full window even after the backend answers early is deliberate: a queue that
// flashes for 800ms reads as a glitch, not as a queue.
//
// This is not a tax on the healthy path. The preflight probe below means the
// queue only ever appears for a backend that genuinely failed to answer.
const MIN_WAIT_MS = 30_000

// Hard ceiling. Past this the backend is not merely cold, it is broken, and
// telling someone the truth beats spinning forever.
const MAX_WAIT_MS = 180_000

// When the countdown reaches zero and the backend still has not answered, add
// another block rather than failing — a boot that overran by five seconds should
// not throw away a user who already waited thirty.
const EXTEND_MS = 15_000

// Loop resolution. Fine enough for a smooth progress bar, coarse enough to be
// free. Renders are gated on the displayed value changing, not on the tick.
const TICK_MS = 250

// Gap between probes while queueing. Tight enough to catch the boot within a few
// seconds of it finishing, loose enough not to pile onto a booting container.
const POLL_INTERVAL_MS = 3_000

// A tick that arrives far later than TICK_MS means real time passed while this
// code was not running: the phone locked, the OS suspended the tab, or a
// background tab got its timers clamped. That is time the user did not
// experience, and burning their ceiling on it would fail them against a backend
// that is up. Anything past this threshold is treated as a suspension.
const SUSPEND_GAP_MS = 5_000

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms))

/**
 * Hold a checkout attempt until the backend is confirmed up, showing a queue.
 *
 * Returns:
 *   queue        null when idle, else the live countdown state driving QueueOverlay:
 *                { secondsLeft, elapsedMs, totalMs, ready, extended }
 *   waitForTurn  async () => boolean. Resolves true when it is safe to submit,
 *                false when the wait was exhausted or the component unmounted.
 *
 * Two fast paths come before any queue is shown: a cached recent success, and
 * failing that a fresh short probe. A queue screen is only ever shown to someone
 * whose backend actually failed to answer just now.
 */
export function useBackendQueue({ minWaitMs = MIN_WAIT_MS, maxWaitMs = MAX_WAIT_MS } = {}) {
  const [queue, setQueue] = useState(null)

  // Unmount is terminal for a wait: keep the loop from spinning (and from setting
  // state) after the user navigated away mid-queue.
  const cancelled = useRef(false)
  useEffect(() => {
    cancelled.current = false
    return () => {
      cancelled.current = true
    }
  }, [])

  const waitForTurn = useCallback(async () => {
    if (isBackendWarm()) return true

    // Preflight. Without this, any gap between the cached answer expiring and the
    // next keep-alive tick would put a user in front of a queue screen for a
    // backend that is up and would have answered in 200ms.
    if (await pingBackend({ timeoutMs: PREFLIGHT_TIMEOUT_MS })) return true
    if (cancelled.current) return false

    let start = Date.now()
    let deadline = start + minWaitMs
    let lastTickAt = start
    let extended = false

    // Probes run detached from the tick loop. Awaiting one here would freeze the
    // countdown for up to its 12s timeout — which is precisely when the user is
    // staring at it. `polling` keeps at most one in flight.
    let polling = false
    let lastPollAt = 0
    const poll = () => {
      polling = true
      pingBackend().finally(() => {
        polling = false
      })
    }

    // Re-render only when something the overlay displays actually changed.
    let lastSignature = ''
    const publish = (now, ready) => {
      const secondsLeft = Math.max(0, Math.ceil((deadline - now) / 1000))
      const signature = `${secondsLeft}|${ready}|${extended}`
      if (signature === lastSignature) return
      lastSignature = signature
      setQueue({
        secondsLeft,
        elapsedMs: now - start,
        totalMs: Math.max(1, deadline - start),
        ready,
        extended,
      })
    }

    publish(start, false)

    while (!cancelled.current) {
      const now = Date.now()

      // Absorb clock anomalies before any deadline math uses them.
      const gap = now - lastTickAt
      if (gap < 0 || gap > SUSPEND_GAP_MS) {
        const shift = gap < 0 ? gap : gap - TICK_MS
        start += shift
        deadline += shift
      }
      lastTickAt = now

      // Poll unconditionally, not just while we believe the backend is down. A
      // backend that answered at t=2s and died at t=10s must not have its stale
      // success open the gate at t=30s.
      if (!polling && now - lastPollAt >= POLL_INTERVAL_MS) {
        lastPollAt = now
        poll()
      }

      // isBackendWarm() rather than a local latch: the source of truth is the
      // most recent probe, and it is allowed to go back to false.
      const ready = isBackendWarm()

      if (now >= deadline) {
        if (ready) {
          setQueue(null)
          return true
        }
        if (now - start >= maxWaitMs) {
          // One last synchronous attempt before writing the user off. The loop's
          // detached polling means the ceiling can land in the gap between a
          // probe being issued and it answering.
          const up = await pingBackend({ timeoutMs: PREFLIGHT_TIMEOUT_MS })
          setQueue(null)
          return up
        }
        deadline = now + EXTEND_MS
        extended = true
      }

      publish(now, ready)
      await sleep(TICK_MS)
    }

    setQueue(null)
    return false
  }, [minWaitMs, maxWaitMs])

  return { queue, waitForTurn }
}
