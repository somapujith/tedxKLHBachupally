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

// Every page below /App renders behind a Suspense boundary (public routes are
// now React.lazy, same as admin), so its content mounts one microtask after
// the initial render — hence `findBy*` (which waits) instead of `getBy*`.
describe('App routing', () => {
  it('renders the home page', async () => {
    renderAt('/')
    expect((await screen.findAllByText(/Humanity/i)).length).toBeGreaterThan(0)
  })

  it('renders the theme page', async () => {
    renderAt('/theme')
    // The theme headline is baked into the key-art image, so it is reachable as
    // alt text rather than as a text node. Asserting the alt keeps the headline
    // covered AND fails if the artwork is swapped for one that drops it.
    expect(await screen.findByAltText(/Technology Evolves\. Humanity Leads\./i)).toBeInTheDocument()
  })

  it('renders the team page', async () => {
    renderAt('/team')
    expect(await screen.findByText(/One team\./i)).toBeInTheDocument()
  })

  it('renders the contact page', async () => {
    renderAt('/contact')
    expect(await screen.findByText(/Say hello\./i)).toBeInTheDocument()
    expect(screen.getByLabelText(/Message/i)).toBeInTheDocument()
  })

  it('serves the consolidated About page on every legacy about-* URL', async () => {
    for (const path of ['/about-ted', '/about-tedx', '/about-tedxklh']) {
      const { unmount } = renderAt(path)
      expect(await screen.findByText('About TED & TEDx')).toBeInTheDocument()
      unmount()
    }
  })
})
