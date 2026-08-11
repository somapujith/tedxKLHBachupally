// The follow prompt interrupts every visitor, so the things that must not break
// are the ones that would trap or annoy them: it appears once, it closes by any
// of three routes, and a dismissal is remembered.
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { render, screen, act, fireEvent } from '@testing-library/react'
import InstagramModal from '../components/InstagramModal'
import { contact } from '../data/site'

const DISMISS_KEY = 'tedx_ig_prompt_dismissed_at'

beforeEach(() => {
  vi.useFakeTimers()
  window.localStorage.clear()
})

afterEach(() => {
  vi.useRealTimers()
})

// The whole point is the delay, so every test has to cross it deliberately.
function advancePastDelay() {
  act(() => {
    vi.advanceTimersByTime(5000)
  })
}

describe('InstagramModal', () => {
  it('stays hidden until 5 seconds have passed', () => {
    render(<InstagramModal />)
    act(() => {
      vi.advanceTimersByTime(4900)
    })
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()

    advancePastDelay()
    expect(screen.getByRole('dialog')).toBeInTheDocument()
  })

  it('asks for the follow and says why', () => {
    render(<InstagramModal />)
    advancePastDelay()
    expect(screen.getByRole('dialog')).toHaveAccessibleName(/speaker updates/i)
    expect(screen.getByText(/goes\s+out on Instagram first/i)).toBeInTheDocument()
  })

  it('links to the real profile in a new tab, without leaking the opener', () => {
    render(<InstagramModal />)
    advancePastDelay()
    const link = screen.getByRole('link', { name: new RegExp(contact.instagramHandle, 'i') })
    expect(link).toHaveAttribute('href', contact.instagram)
    expect(link).toHaveAttribute('target', '_blank')
    // Without noopener the opened tab can navigate this one via window.opener.
    expect(link.getAttribute('rel')).toContain('noopener')
  })

  it('closes on the X, on "Maybe later", and on Escape', () => {
    const { unmount } = render(<InstagramModal />)
    advancePastDelay()
    fireEvent.click(screen.getByRole('button', { name: /close/i }))
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    unmount()

    window.localStorage.clear()
    const second = render(<InstagramModal />)
    advancePastDelay()
    fireEvent.click(screen.getByRole('button', { name: /maybe later/i }))
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    second.unmount()

    window.localStorage.clear()
    render(<InstagramModal />)
    advancePastDelay()
    fireEvent.keyDown(document, { key: 'Escape' })
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  it('does not come back for a visitor who dismissed it recently', () => {
    window.localStorage.setItem(DISMISS_KEY, String(Date.now()))
    render(<InstagramModal />)
    advancePastDelay()
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  it('returns once the reminder window has elapsed', () => {
    const fifteenDaysAgo = Date.now() - 15 * 24 * 60 * 60 * 1000
    window.localStorage.setItem(DISMISS_KEY, String(fifteenDaysAgo))
    render(<InstagramModal />)
    advancePastDelay()
    expect(screen.getByRole('dialog')).toBeInTheDocument()
  })

  it('records the dismissal so a reload does not re-prompt', () => {
    render(<InstagramModal />)
    advancePastDelay()
    fireEvent.click(screen.getByRole('button', { name: /close/i }))
    expect(Number(window.localStorage.getItem(DISMISS_KEY))).toBeGreaterThan(0)
  })

  it('locks the page behind it from scrolling, and restores it on close', () => {
    render(<InstagramModal />)
    advancePastDelay()
    expect(document.body.style.overflow).toBe('hidden')
    fireEvent.click(screen.getByRole('button', { name: /close/i }))
    expect(document.body.style.overflow).not.toBe('hidden')
  })

  it('marks itself as a modal dialog for assistive tech', () => {
    render(<InstagramModal />)
    advancePastDelay()
    expect(screen.getByRole('dialog')).toHaveAttribute('aria-modal', 'true')
  })
})
