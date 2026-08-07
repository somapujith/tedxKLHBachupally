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
  ['/schedule', /Coming soon\./i],
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
    expect(await screen.findByText(/2 speakers reveal/i)).toBeInTheDocument()
    expect(screen.queryByText(/Applied Scientist 2, Microsoft/i)).not.toBeInTheDocument()
  })

  it('renders a revealed speaker and lists only revealed speakers on the roster', async () => {
    vi.useFakeTimers({ toFake: ['Date'] })
    vi.setSystemTime(new Date('2026-08-09T12:00:00+05:30'))
    const detail = renderAt('/speakers/tezan-sahu')
    expect(await screen.findByText(/Applied Scientist 2, Microsoft/i)).toBeInTheDocument()
    detail.unmount()

    renderAt('/speakers')
    expect(await screen.findByText(/4 speakers/i)).toBeInTheDocument()
    expect(screen.queryByText(/Vinuthna Jagarlapudi/i)).not.toBeInTheDocument()
  })

  it('404s a not-yet-revealed speaker even though its slug is real', async () => {
    vi.useFakeTimers({ toFake: ['Date'] })
    vi.setSystemTime(new Date('2026-08-07T12:00:00+05:30'))
    renderAt('/speakers/tezan-sahu')
    expect(await screen.findByText(/There's no talk here\./i)).toBeInTheDocument()
  })

  // Regression test: with exactly 2 speakers revealed, naive prev/next modulo
  // arithmetic makes both links resolve to the same other speaker. That must
  // collapse to ONE "Also revealed" card, not two links to the same person.
  it('shows a single "also revealed" card, not duplicate prev/next, when only 2 speakers are revealed', async () => {
    vi.useFakeTimers({ toFake: ['Date'] })
    vi.setSystemTime(new Date('2026-08-08T12:00:00+05:30'))
    renderAt('/speakers/alekhya-singapore')
    expect(await screen.findByText(/Also revealed/i)).toBeInTheDocument()
    expect(screen.queryByText(/^Previous$/i)).not.toBeInTheDocument()
    expect(screen.queryByText(/^Next$/i)).not.toBeInTheDocument()
    expect(screen.getAllByText('Gopalan Uppiliappan')).toHaveLength(1)
  })
})
