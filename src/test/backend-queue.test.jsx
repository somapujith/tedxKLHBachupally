// Cold-start behaviour, driven through the real components with only fetch faked.
//
// The thing under test is a TIMING contract — "hold the user for at least 30s,
// keep probing, then submit" — so these run on fake timers and advance them
// explicitly. A test that passed without advancing time would be proving nothing.
//
// Note: only synchronous queries are used below. @testing-library's waitFor /
// findBy* schedule their retries on the global setTimeout, which these tests
// fake — so they would wait on a clock nobody advances and hang forever. Every
// assertion here follows an explicit advance(), which is deterministic anyway.
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, act } from '@testing-library/react'
import { MemoryRouter, Routes, Route, Link } from 'react-router-dom'
import Register from '../pages/Register'
import { useBackendWarmup } from '../hooks/useBackendWarmup'
import { isBackendWarm, resetBackendHealth, warmBackend } from '../lib/backendHealth'

// The timing constants the implementation is built around, mirrored here so the
// assertions read as intent rather than as bare numbers. The ordering below is
// itself part of the contract: the keep-alive tick must refresh the cached
// answer BEFORE it expires, or a healthy backend would periodically read as
// not-warm and put someone in front of a queue for nothing.
const THROTTLE_MS = 15_000
const KEEP_ALIVE_MS = 40_000
const FRESH_MS = 60_000

// How the fake backend answers a health probe. Three distinct shapes, because
// they exercise three different branches: a thrown TypeError is a refused
// connection, a 503 is a booting-but-listening instance, and 200 is up.
let healthMode = 'refused' // 'refused' | 'unhealthy' | 'ok'
let fetchMock

function jsonResponse(body, ok = true, status = ok ? 200 : 503) {
  return { ok, status, headers: { get: () => null }, text: async () => JSON.stringify(body) }
}

beforeEach(() => {
  // Fake only the clock APIs the gate's logic uses. requestAnimationFrame is
  // deliberately left real: framer-motion drives its animations off rAF, and
  // faking it means advancing three virtual minutes steps thousands of animation
  // frames — turning a millisecond assertion into a multi-second one.
  vi.useFakeTimers({
    toFake: ['setTimeout', 'clearTimeout', 'setInterval', 'clearInterval', 'Date'],
  })
  resetBackendHealth()
  healthMode = 'refused'

  fetchMock = vi.fn(async (url, init) => {
    if (url === '/api/health') {
      if (healthMode === 'refused') throw new TypeError('Failed to fetch')
      if (healthMode === 'unhealthy') return jsonResponse({ ok: false, db: 'error' }, false, 503)
      return jsonResponse({ ok: true, db: 'connected' })
    }
    if (url === '/api/register') {
      // GET is the availability probe the register page fires on mount. It rides
      // the same path as the submit POST (Vercel function budget), so it must
      // follow healthMode exactly like /api/health — a refused backend cannot
      // answer it, and letting it answer would fake a warm-mark mid-queue.
      if (init?.method !== 'POST') {
        if (healthMode === 'refused') throw new TypeError('Failed to fetch')
        if (healthMode === 'unhealthy') return jsonResponse({ ok: false, db: 'error' }, false, 503)
        return jsonResponse({
          ok: true, db: 'connected', capacity: 250, remaining: 250, soldOut: false,
        })
      }
      return jsonResponse({
        ok: true,
        registration: { id: 'reg-cold-1', email: 'cold@example.com', fullName: 'Cold Start' },
      })
    }
    if (url === '/api/payment/order') {
      // Stop the flow here so the Razorpay SDK is never needed.
      return jsonResponse({ ok: false, error: 'stop-here-for-test' }, false)
    }
    throw new Error(`unexpected fetch: ${url}`)
  })
  vi.stubGlobal('fetch', fetchMock)
})

afterEach(() => {
  vi.useRealTimers()
  vi.unstubAllGlobals()
})

const advance = (ms) =>
  act(async () => {
    await vi.advanceTimersByTimeAsync(ms)
    // advanceTimersByTimeAsync yields the event loop once. The probe chain is
    // several promise hops deep (apiFetch -> fetch -> res.text -> JSON.parse ->
    // markBackendWarm), so one break does not reliably settle it — draining the
    // microtask queue here is what keeps these assertions deterministic under
    // load instead of intermittently observing a half-finished probe.
    for (let i = 0; i < 10; i++) await Promise.resolve()
  })

const healthCallCount = () => fetchMock.mock.calls.filter((c) => c[0] === '/api/health').length

// Whether the form was actually SUBMITTED. Method-scoped because the mount-time
// availability probe GETs the same '/api/register' path — a bare
// toHaveBeenCalledWith('/api/register', …) would match that probe and either
// trip a "nothing posted yet" assertion or trivially satisfy a positive one.
const registerPosted = () =>
  fetchMock.mock.calls.some(([url, init]) => url === '/api/register' && init?.method === 'POST')

function fillForm() {
  fireEvent.change(screen.getByLabelText(/full name/i), { target: { value: 'Cold Start' } })
  fireEvent.change(screen.getByLabelText(/phone number/i), { target: { value: '9876500000' } })
  fireEvent.change(screen.getByLabelText(/email address/i), {
    target: { value: 'cold@example.com' },
  })
  fireEvent.click(screen.getByRole('button', { name: /guest/i }))
}

function submit() {
  fireEvent.click(screen.getByRole('button', { name: /continue to secure payment/i }))
}

// The overlay's countdown, read back as a number of seconds. Lets a test assert
// the SIZE of a wait block, not merely that some countdown is on screen.
function clockSeconds() {
  const [minutes, seconds] = screen
    .getByText(/^\d{2}:\d{2}$/)
    .textContent.split(':')
    .map(Number)
  return minutes * 60 + seconds
}

function renderRegister() {
  return render(
    <MemoryRouter>
      <Register />
    </MemoryRouter>,
  )
}

describe('backend warm-up on navigation', () => {
  // A bare harness instead of the real Layout: Layout drags in Lenis and a
  // three.js canvas, neither of which jsdom can render and neither of which has
  // anything to do with warming the API.
  function Warmer() {
    useBackendWarmup()
    return <Link to="/theme">go</Link>
  }

  function renderWarmer() {
    return render(
      <MemoryRouter initialEntries={['/']}>
        <Warmer />
        <Routes>
          <Route path="/" element={<div>home</div>} />
          <Route path="/theme" element={<div>theme</div>} />
        </Routes>
      </MemoryRouter>,
    )
  }

  it('probes /api/health on mount', async () => {
    healthMode = 'ok'
    renderWarmer()
    await advance(0)

    expect(fetchMock).toHaveBeenCalledWith('/api/health', expect.any(Object))
    expect(isBackendWarm()).toBe(true)
  })

  it('probes again on a route change once the cached answer is stale', async () => {
    healthMode = 'ok'
    renderWarmer()
    await advance(0)

    // Expire the cached answer WITHOUT advancing the clock. Advancing time far
    // enough for the cached answer to go stale would also let the keep-alive
    // interval fire, and then this test would pass even with route-change
    // warming deleted outright — which is exactly the trap an earlier version of
    // this test fell into. With zero elapsed time the click is provably the only
    // thing that can produce a request.
    resetBackendHealth()
    fetchMock.mockClear()

    fireEvent.click(screen.getByRole('link', { name: 'go' }))
    await advance(0)
    expect(healthCallCount()).toBe(1)
  })

  it('keeps the instance alive on an interval with no navigation at all', async () => {
    healthMode = 'ok'
    renderWarmer()
    await advance(0)
    fetchMock.mockClear()

    await advance(KEEP_ALIVE_MS + 1_000)
    expect(healthCallCount()).toBeGreaterThan(0)
  })

  it('collapses a burst of warm-up calls inside the throttle window into one request', async () => {
    // Stays cold, so the freshness short-circuit can never be what suppresses a
    // probe — only the throttle can.
    healthMode = 'refused'
    await act(async () => {
      await warmBackend()
    })
    expect(healthCallCount()).toBe(1)

    // Well inside the throttle window: suppressed.
    await advance(THROTTLE_MS / 3)
    await act(async () => {
      await warmBackend()
    })
    expect(healthCallCount()).toBe(1)

    // Past it: probes again.
    await advance(THROTTLE_MS + 1_000)
    await act(async () => {
      await warmBackend()
    })
    expect(healthCallCount()).toBe(2)
  })

  it('refreshes the cached answer before it can expire', () => {
    // Ordering invariant, asserted directly because violating it is silent: the
    // symptom is not an error, it is a subset of healthy users being shown a
    // 30-second queue at the moment of payment.
    expect(KEEP_ALIVE_MS).toBeLessThan(FRESH_MS)
    expect(THROTTLE_MS).toBeLessThan(KEEP_ALIVE_MS)
  })

  it('stops reporting warm the moment a probe proves the backend died', async () => {
    healthMode = 'ok'
    renderWarmer()
    await advance(0)
    expect(isBackendWarm()).toBe(true)

    // The backend dies well inside the freshness window — a Render restart or
    // deploy is instantaneous, so this is the normal case, not an edge one.
    healthMode = 'refused'
    await advance(KEEP_ALIVE_MS + 1_000)

    // A probe that explicitly failed must invalidate the earlier success. If it
    // only recorded "cold" somewhere else and left the old timestamp standing,
    // submissions would keep sailing through for the rest of the window — the
    // exact situation this whole module exists to prevent.
    expect(isBackendWarm()).toBe(false)
  })

  it('reports the backend as cold when the connection is refused', async () => {
    healthMode = 'refused'
    renderWarmer()
    await advance(0)
    expect(isBackendWarm()).toBe(false)
  })

  it('reports the backend as cold when it answers 503 while booting', async () => {
    // Distinct from a refused connection: the instance IS listening and returns
    // a well-formed JSON body, so this exercises the ok===false branch rather
    // than the catch branch.
    healthMode = 'unhealthy'
    renderWarmer()
    await advance(0)
    expect(fetchMock).toHaveBeenCalledWith('/api/health', expect.any(Object))
    expect(isBackendWarm()).toBe(false)
  })
})

describe('Register — queue gate on a cold backend', () => {
  it('shows no queue at all when the backend answers the preflight probe', async () => {
    // Nothing cached (a fresh tab, or a cached answer that just expired) but the
    // backend is perfectly healthy. This user must go straight to payment — a
    // queue screen here would be a lie, and a 30-second one at that.
    healthMode = 'ok'
    renderRegister()
    fillForm()
    submit()

    await advance(100)
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(registerPosted()).toBe(true)
  })

  it('locks the form fields while a submit is in flight', async () => {
    renderRegister()
    fillForm()
    submit()
    await advance(1_000)

    // onSubmit already captured the form values. Leaving the inputs live would
    // let someone "fix" a typo during the wait, see the corrected value on
    // screen, and still have the ticket emailed to the old address.
    expect(screen.getByRole('dialog')).toBeInTheDocument()
    expect(screen.getByLabelText(/email address/i)).toBeDisabled()
    expect(screen.getByLabelText(/full name/i)).toBeDisabled()
    expect(screen.getByLabelText(/phone number/i)).toBeDisabled()
  })

  it('shows the queue instead of submitting, then submits once the backend is up', async () => {
    renderRegister()
    fillForm()
    submit()

    // Queue is up, and crucially NOTHING has been posted yet.
    await advance(1_000)
    expect(screen.getByRole('dialog')).toBeInTheDocument()
    expect(screen.getByText(/you’re in the queue/i)).toBeInTheDocument()
    expect(registerPosted()).toBe(false)

    // The countdown is a real minimum: still queued at 25s even though the
    // backend came back almost immediately.
    healthMode = 'ok'
    await advance(24_000)
    expect(screen.getByRole('dialog')).toBeInTheDocument()
    expect(registerPosted()).toBe(false)

    // Past 30s the gate opens and the real submit chain runs.
    await advance(8_000)
    expect(registerPosted()).toBe(true)
    expect(fetchMock).toHaveBeenCalledWith('/api/payment/order', expect.any(Object))
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  it('polls on a ~3s cadence while queued rather than giving up after one probe', async () => {
    renderRegister()
    fillForm()
    submit()

    // 12s at a 3s cadence is probes at roughly t=0,3,6,9,12. The upper bound is
    // what makes this falsifiable in both directions — a much tighter or much
    // looser interval fails.
    await advance(12_000)
    expect(healthCallCount()).toBeGreaterThanOrEqual(4)
    expect(healthCallCount()).toBeLessThanOrEqual(8) // + the preflight probe
    expect(screen.getByRole('dialog')).toBeInTheDocument()
  })

  it('extends the wait in a fresh ~15s block when the backend is still down', async () => {
    renderRegister()
    fillForm()
    submit()

    await advance(32_000)
    expect(screen.getByRole('dialog')).toBeInTheDocument()
    expect(screen.getByText(/extending your hold/i)).toBeInTheDocument()

    // The first 30s block expired at t=30s and a new block started. Two seconds
    // in, the clock must read like a fresh ~15s block — this is what pins the
    // block SIZE, rather than merely asserting that some extension happened.
    expect(clockSeconds()).toBeGreaterThanOrEqual(11)
    expect(clockSeconds()).toBeLessThanOrEqual(15)
    expect(registerPosted()).toBe(false)
  })

  it('holds until the 180s ceiling, then gives up with an actionable message', async () => {
    renderRegister()
    fillForm()
    submit()

    // Just under the ceiling the user is still being held.
    await advance(175_000)
    expect(screen.getByRole('dialog')).toBeInTheDocument()

    // Just past it, the wait is abandoned with something the user can act on.
    await advance(8_000)
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(screen.getByRole('alert')).toHaveTextContent(/rejoin the queue/i)
    expect(registerPosted()).toBe(false)
  })

  it('stops polling when the user navigates away mid-queue', async () => {
    const { unmount } = renderRegister()
    fillForm()
    submit()

    await advance(1_000)
    expect(screen.getByRole('dialog')).toBeInTheDocument()

    unmount()
    fetchMock.mockClear()
    await advance(30_000)

    // An abandoned wait must not keep hammering a booting backend forever.
    expect(healthCallCount()).toBe(0)
  })
})
