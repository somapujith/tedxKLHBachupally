import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import Register from '../pages/Register'
import { markBackendWarm, resetBackendHealth } from '../lib/backendHealth'

function renderForm() {
  return render(
    <MemoryRouter>
      <Register />
    </MemoryRouter>,
  )
}

beforeEach(() => {
  vi.restoreAllMocks()
  // These cases cover form behaviour, not the cold-start queue. Start from a
  // known-warm backend so submit takes the fast path straight to /api/register;
  // the queue gate itself is covered in backend-queue.test.jsx.
  resetBackendHealth()
  markBackendWarm()
  // Default fetch stub: the page fires an availability GET on mount, and with
  // no stub these rendering tests would depend on Node's global fetch rejecting
  // a relative URL — which stops being true the moment VITE_API_BASE_URL makes
  // apiBase produce absolute URLs. Tests that care stub their own fetch on top.
  vi.stubGlobal(
    'fetch',
    vi.fn(async () => ({ ok: false, status: 500, headers: { get: () => null }, text: async () => '' })),
  )
})

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('Register form — live pass availability', () => {
  const availabilityFetch = ({ capacity, sold }) => {
    const remaining = Math.max(0, capacity - sold)
    return vi.fn(async (url, init) => {
      if (url === '/api/register' && init?.method !== 'POST') {
        return {
          ok: true,
          status: 200,
          headers: { get: () => null },
          text: async () =>
            JSON.stringify({
              ok: true, db: 'connected', capacity, remaining, soldOut: remaining === 0,
            }),
        }
      }
      throw new Error(`unexpected fetch: ${url}`)
    })
  }

  // Seat counts are deliberately never shown to visitors — the availability
  // probe only drives the sold-out gate. Guard against the count creeping back.
  it('never renders seat counts, even when availability is low', async () => {
    vi.stubGlobal('fetch', availabilityFetch({ capacity: 250, sold: 238 }))
    renderForm()
    await waitFor(() => expect(screen.getByLabelText(/full name/i)).toBeInTheDocument())
    expect(screen.queryByText(/of 250 left/i)).not.toBeInTheDocument()
    expect(screen.queryByText(/passes left/i)).not.toBeInTheDocument()
    expect(screen.queryByText(/selling fast/i)).not.toBeInTheDocument()
  })

  it('replaces the form with the sold-out screen when nothing is left', async () => {
    vi.stubGlobal('fetch', availabilityFetch({ capacity: 250, sold: 250 }))
    renderForm()
    await waitFor(() => expect(screen.getByText(/every seat is claimed/i)).toBeInTheDocument())
    expect(screen.queryByLabelText(/full name/i)).not.toBeInTheDocument()
  })
})

describe('Register form — conditional fields', () => {
  it('shows contact fields and the three designation options', () => {
    renderForm()
    expect(screen.getByLabelText(/full name/i)).toBeInTheDocument()
    expect(screen.getByLabelText(/phone number/i)).toBeInTheDocument()
    expect(screen.getByLabelText(/email address/i)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /student/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /staff/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /guest/i })).toBeInTheDocument()
  })

  it('does not show the campus dropdown until Student or Staff is chosen', () => {
    renderForm()
    expect(screen.queryByRole('combobox')).not.toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: /student/i }))
    expect(screen.getByRole('combobox')).toBeInTheDocument()
  })

  it('reveals the free-text college field only when campus is Others', () => {
    renderForm()
    fireEvent.click(screen.getByRole('button', { name: /student/i }))
    const select = screen.getByRole('combobox')

    fireEvent.change(select, { target: { value: 'KL GBS Campus' } })
    expect(screen.queryByLabelText(/college name/i)).not.toBeInTheDocument()

    fireEvent.change(select, { target: { value: 'Others' } })
    expect(screen.getByLabelText(/college name/i)).toBeInTheDocument()
  })

  it('hides the campus dropdown again when switching back to Guest', () => {
    renderForm()
    fireEvent.click(screen.getByRole('button', { name: /staff/i }))
    expect(screen.getByRole('combobox')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: /guest/i }))
    expect(screen.queryByRole('combobox')).not.toBeInTheDocument()
  })
})

describe('Register form — submit wiring', () => {
  it('POSTs to /api/register then /api/payment/order on submit', async () => {
    const fetchMock = vi.fn(async (url, init) => {
      if (url === '/api/register') {
        // Mount-time availability GET rides the same path — answer it with the
        // real endpoint's GET shape, never the POST's registration shape.
        if (init?.method !== 'POST') {
          return {
            ok: true,
            text: async () =>
              JSON.stringify({ ok: true, db: 'connected', capacity: 250, remaining: 250, soldOut: false }),
          }
        }
        return {
          ok: true,
          text: async () =>
            JSON.stringify({
              ok: true,
              registration: { id: 'reg-1', email: 'guest@example.com', fullName: 'Guest One' },
            }),
        }
      }
      if (url === '/api/payment/order') {
        // Return not-ok so the flow stops before the Razorpay SDK is needed.
        return {
          ok: false,
          text: async () => JSON.stringify({ ok: false, error: 'stop-here-for-test' }),
        }
      }
      throw new Error(`unexpected fetch: ${url}`)
    })
    vi.stubGlobal('fetch', fetchMock)

    renderForm()
    fireEvent.change(screen.getByLabelText(/full name/i), { target: { value: 'Guest One' } })
    fireEvent.change(screen.getByLabelText(/phone number/i), { target: { value: '9876500000' } })
    fireEvent.change(screen.getByLabelText(/email address/i), { target: { value: 'guest@example.com' } })
    fireEvent.click(screen.getByRole('button', { name: /guest/i }))
    fireEvent.click(screen.getByRole('button', { name: /continue to secure payment/i }))

    await waitFor(() => {
      // POST-scoped: the availability GET also hits '/api/register', so a bare
      // toHaveBeenCalledWith would pass with the submit deleted outright.
      expect(
        fetchMock.mock.calls.some(([u, i]) => u === '/api/register' && i?.method === 'POST'),
      ).toBe(true)
      expect(fetchMock).toHaveBeenCalledWith('/api/payment/order', expect.any(Object))
    })
    // The order call carries the registration id from step 1.
    const orderCall = fetchMock.mock.calls.find((c) => c[0] === '/api/payment/order')
    expect(JSON.parse(orderCall[1].body)).toEqual({ registrationId: 'reg-1' })
  })

  it('surfaces a server error message when registration fails', async () => {
    const fetchMock = vi.fn(async () => ({
      ok: false,
      text: async () => JSON.stringify({ ok: false, error: 'Could not save registration. Please try again.' }),
    }))
    vi.stubGlobal('fetch', fetchMock)

    renderForm()
    fireEvent.change(screen.getByLabelText(/full name/i), { target: { value: 'Error User' } })
    fireEvent.change(screen.getByLabelText(/phone number/i), { target: { value: '9876500000' } })
    fireEvent.change(screen.getByLabelText(/email address/i), { target: { value: 'err@example.com' } })
    fireEvent.click(screen.getByRole('button', { name: /guest/i }))
    fireEvent.click(screen.getByRole('button', { name: /continue to secure payment/i }))

    expect(await screen.findByRole('alert')).toHaveTextContent(/could not save registration/i)
  })
})
