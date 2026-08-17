import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import App from '../App'

function renderAt(path) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <App />
    </MemoryRouter>,
  )
}

// Each route must render its OWN page content — a unique string that lives only on
// that page, NOT the shared Layout nav. If a page component rendered nothing, these
// assertions fail (unlike a generic "nav links exist" smoke check).
const ROUTES = [
  ['/', /Humanity Leads\./i],
  ['/theme', /The machine learned to dream\./i],
  // The three about-* URLs are aliases of ONE consolidated About page (the nav
  // links only to /about-tedxklh; the other two exist so old links keep working),
  // so they assert the same page content on purpose — see the alias test below.
  ['/about-tedxklh', /About TED & TEDx/i],
  ['/about-ted', /About TED & TEDx/i],
  ['/about-tedx', /About TED & TEDx/i],
  ['/team', /One stage\./i],
  ['/blog', /Notes from behind the red circle\./i],
  ['/partners', /The companies in the room\./i],
  ['/register', /Claim your seat\./i],
  ['/speakers', /The line-up ·/i],
  ['/volunteer', /Build it with us\./i],
  ['/schedule', /Twelve/i],
  ['/sponsor', /Put your name in the room\./i],
  ['/nominate', /Know someone who should speak\?/i],
]

// Every public route is now React.lazy (same pattern as admin routes), so its
// content mounts behind a Suspense boundary one microtask after the initial
// render — hence `findBy*` (which waits) instead of `getBy*`.
describe('every route renders its own page content', () => {
  it.each(ROUTES)('renders page-specific content at %s', async (path, pattern) => {
    renderAt(path)
    expect(await screen.findByText(pattern)).toBeInTheDocument()
  })

  it('renders the 404 page for an unknown path', async () => {
    renderAt('/this-does-not-exist')
    expect(await screen.findByText(/There's no talk here\./i)).toBeInTheDocument()
  })

  // A speaker slug is user/CMS-editable data, not a route the router itself can
  // validate — an unknown slug must fall through to the same 404 content instead
  // of rendering a blank page or throwing.
  it('renders the 404 page for an unknown speaker slug', async () => {
    renderAt('/speakers/this-speaker-does-not-exist')
    expect(await screen.findByText(/There's no talk here\./i)).toBeInTheDocument()
  })

  // The About page was consolidated from three tab pages into one. The two legacy
  // URLs must keep resolving to that page rather than falling through to the 404
  // route — this fails the moment someone deletes an alias from App.jsx.
  it('the legacy about-* URLs are aliases of the one About page, not 404s', async () => {
    for (const path of ['/about-ted', '/about-tedx', '/about-tedxklh']) {
      const { unmount } = renderAt(path)
      expect(await screen.findByRole('heading', { name: /is a student-run ideas community/i }))
        .toBeInTheDocument()
      expect(screen.queryByText(/There's no talk here\./i)).not.toBeInTheDocument()
      unmount()
    }
  })
})

// Speakers unlock on a schedule (src/data/event.js `revealDate`), so unlike
// every other route above, what these pages render depends on "now" — these
// tests pin the clock instead of depending on whatever day the suite runs.
describe('speaker reveal gating', () => {
  afterEach(() => {
    vi.useRealTimers()
  })

  it('shows the pre-reveal countdown and no speaker cards before the first reveal', async () => {
    vi.useFakeTimers({ toFake: ['Date'] })
    vi.setSystemTime(new Date('2026-08-07T12:00:00+05:30'))
    renderAt('/speakers')
    // One speaker unlocks on Aug 8, not two — the roster is six now that
    // Gopalan Uppiliappan has come off it.
    expect(await screen.findByText(/1 speakers reveal/i)).toBeInTheDocument()
    expect(screen.queryByText(/Applied Scientist 2, Microsoft/i)).not.toBeInTheDocument()
  })

  it('renders a revealed speaker and lists only revealed speakers on the roster', async () => {
    vi.useFakeTimers({ toFake: ['Date'] })
    vi.setSystemTime(new Date('2026-08-09T12:00:00+05:30'))
    const detail = renderAt('/speakers/tezan-sahu')
    expect(await screen.findByText(/Applied Scientist 2, Microsoft/i)).toBeInTheDocument()
    detail.unmount()

    renderAt('/speakers')
    expect(await screen.findByText(/3 of 10 talks revealed/i)).toBeInTheDocument()
    expect(screen.queryByText(/Vinuthna Jagarlapudi/i)).not.toBeInTheDocument()
  })

  it('404s a not-yet-revealed speaker even though its slug is real', async () => {
    vi.useFakeTimers({ toFake: ['Date'] })
    vi.setSystemTime(new Date('2026-08-07T12:00:00+05:30'))
    renderAt('/speakers/tezan-sahu')
    expect(await screen.findByText(/There's no talk here\./i)).toBeInTheDocument()
  })

  // On Aug 8 only one speaker has unlocked, so there is no sibling to link to
  // at all — prev/next must both stay away rather than pointing back at the
  // speaker already on screen.
  //
  // This used to assert the two-revealed case (one shared "Also revealed"
  // card instead of a duplicated prev AND next). That state is no longer
  // reachable from the real roster: the count goes 1 on Aug 8 straight to 3 on
  // Aug 9, so the case below and the three-revealed one either side of it are
  // what the data can actually produce.
  it('shows no prev/next when only one speaker is revealed', async () => {
    vi.useFakeTimers({ toFake: ['Date'] })
    vi.setSystemTime(new Date('2026-08-08T12:00:00+05:30'))
    renderAt('/speakers/alekhya-singapore')
    expect(await screen.findByText('Dr. Alekhya Singapore')).toBeInTheDocument()
    expect(screen.queryByText(/^Previous$/i)).not.toBeInTheDocument()
    expect(screen.queryByText(/^Next$/i)).not.toBeInTheDocument()
  })

  it('links to siblings once more than two speakers are revealed', async () => {
    vi.useFakeTimers({ toFake: ['Date'] })
    vi.setSystemTime(new Date('2026-08-09T12:00:00+05:30'))
    renderAt('/speakers/tejaswini-adada')
    expect(await screen.findByText('Dr. Tejaswini Adada')).toBeInTheDocument()
    // Three are live by now, so the page must offer a way on to another one.
    expect(screen.getByText('Tezan Sahu')).toBeInTheDocument()
  })
})
