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
    expect(screen.getByText(/EVOLVES/i)).toBeInTheDocument()
  })

  it('renders the team page', () => {
    renderAt('/team')
    expect(screen.getByText(/The crew/i)).toBeInTheDocument()
  })

  it('renders a speaker detail page', () => {
    renderAt('/events/1/speakers/ananya-rao')
    expect(screen.getByText('Ananya Rao')).toBeInTheDocument()
  })

  it('renders distinct content per About tab route', () => {
    renderAt('/about-ted')
    expect(screen.getByText('About TED.')).toBeInTheDocument()

    renderAt('/about-tedx')
    expect(screen.getByText('About TEDx.')).toBeInTheDocument()

    renderAt('/about-tedxklh')
    expect(screen.getByText('Built by students.')).toBeInTheDocument()
  })
})
