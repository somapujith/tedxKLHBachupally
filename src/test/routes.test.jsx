import { describe, it, expect } from 'vitest'
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
