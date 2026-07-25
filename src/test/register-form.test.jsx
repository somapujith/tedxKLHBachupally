import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import Register from '../pages/Register'

function renderForm() {
  return render(
    <MemoryRouter>
      <Register />
    </MemoryRouter>,
  )
}

beforeEach(() => {
  vi.restoreAllMocks()
})

afterEach(() => {
  vi.unstubAllGlobals()
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
    const fetchMock = vi.fn(async (url) => {
      if (url === '/api/register') {
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
      expect(fetchMock).toHaveBeenCalledWith('/api/register', expect.any(Object))
      expect(fetchMock).toHaveBeenCalledWith('/api/payment/order', expect.any(Object))
    })
    // The order call carries the registration id from step 1.
    const orderCall = fetchMock.mock.calls.find((c) => c[0] === '/api/payment/order')
    expect(JSON.parse(orderCall[1].body)).toEqual({ registrationId: 'reg-1' })
  })

  it('surfaces a server error message when registration fails', async () => {
    const fetchMock = vi.fn(async () => ({
      ok: false,
      text: async () => JSON.stringify({ ok: false, error: 'This email is already registered and paid for the event.' }),
    }))
    vi.stubGlobal('fetch', fetchMock)

    renderForm()
    fireEvent.change(screen.getByLabelText(/full name/i), { target: { value: 'Dup User' } })
    fireEvent.change(screen.getByLabelText(/phone number/i), { target: { value: '9876500000' } })
    fireEvent.change(screen.getByLabelText(/email address/i), { target: { value: 'dup@example.com' } })
    fireEvent.click(screen.getByRole('button', { name: /guest/i }))
    fireEvent.click(screen.getByRole('button', { name: /continue to secure payment/i }))

    expect(await screen.findByRole('alert')).toHaveTextContent(/already registered/i)
  })
})
