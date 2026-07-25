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
  ['/events', /Our editions\. Infinite ideas\./i],
  ['/events/1', /About the edition/i],
  ['/events/1/speakers', /Understanding what makes us uniquely/i],
  ['/events/1/schedule', /Understanding what makes us uniquely/i],
  ['/events/1/gallery', /Understanding what makes us uniquely/i],
  ['/events/1/experience', /Idea Lounge/i],
  ['/theme', /The machine learned to dream\./i],
  ['/about-tedxklh', /Built by students\./i],
  ['/about-ted', /About TED\./i],
  ['/about-tedx', /About TEDx\./i],
  ['/team', /The crew\./i],
  ['/blog', /Notes from behind the red dot\./i],
  ['/partners', /The companies in the room\./i],
  ['/register', /Claim your seat\./i],
  ['/volunteer', /Build it with us\./i],
  ['/sponsor', /Put your name in the room\./i],
  ['/nominate', /Know someone who should speak\?/i],
]

describe('every route renders its own page content', () => {
  it.each(ROUTES)('renders page-specific content at %s', (path, pattern) => {
    renderAt(path)
    expect(screen.getByText(pattern)).toBeInTheDocument()
  })

  it('renders the 404 page for an unknown path', () => {
    renderAt('/this-does-not-exist')
    expect(screen.getByText(/There's no talk here\./i)).toBeInTheDocument()
  })

  it('the about tab routes render DISTINCT content (not the same page)', () => {
    renderAt('/about-ted')
    expect(screen.getByText('About TED.')).toBeInTheDocument()
    renderAt('/about-tedx')
    expect(screen.getByText('About TEDx.')).toBeInTheDocument()
    renderAt('/about-tedxklh')
    expect(screen.getByText('Built by students.')).toBeInTheDocument()
  })
})
