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

describe('App routing', () => {
  it('renders the home page', () => {
    renderAt('/')
    expect(screen.getAllByText(/Humanity/i).length).toBeGreaterThan(0)
  })

  it('renders the theme page', () => {
    renderAt('/theme')
    // The theme headline is baked into the key-art image, so it is reachable as
    // alt text rather than as a text node. Asserting the alt keeps the headline
    // covered AND fails if the artwork is swapped for one that drops it.
    expect(screen.getByAltText(/Technology Evolves\. Humanity Leads\./i)).toBeInTheDocument()
  })

  it('renders the team page', () => {
    renderAt('/team')
    expect(screen.getByText(/One team\./i)).toBeInTheDocument()
  })

  it('renders the contact page', () => {
    renderAt('/contact')
    expect(screen.getByText(/Say hello\./i)).toBeInTheDocument()
    expect(screen.getByLabelText(/Message/i)).toBeInTheDocument()
  })

  it('renders a speaker detail page', () => {
    renderAt('/events/1/speakers/ananya-rao')
    expect(screen.getByText('Ananya Rao')).toBeInTheDocument()
  })

  it('serves the consolidated About page on every legacy about-* URL', () => {
    for (const path of ['/about-ted', '/about-tedx', '/about-tedxklh']) {
      const { unmount } = renderAt(path)
      expect(screen.getByText('About TED & TEDx')).toBeInTheDocument()
      unmount()
    }
  })
})
