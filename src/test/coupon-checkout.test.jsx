// Checkout coupon entry: the buyer-facing half of the discount flow.
//
// The assertion that matters most is the negative one — that no amount is ever
// sent to the server. The discounted price on this screen is a preview; letting
// it become a request field would make the price a client input.
//
// Stubs global fetch rather than apiFetch, matching register-form.test.jsx, so
// these exercise the real request-building path.
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import Register from '../pages/Register'
import { markBackendWarm, resetBackendHealth } from '../lib/backendHealth'

const PASS_PRICE = 599

// One stub covering the availability GET, the registration POST and the coupon
// check. Individual cases override `couponReply` to change what a code returns.
function stubFetch(couponReply) {
  const fetchMock = vi.fn(async (url, init) => {
    if (url === '/api/register' && init?.method !== 'POST') {
      return {
        ok: true,
        status: 200,
        headers: { get: () => null },
        text: async () =>
          JSON.stringify({
            ok: true,
            db: 'connected',
            capacity: 250,
            remaining: 250,
            soldOut: false,
            passPrice: PASS_PRICE,
            registrationOpen: true,
          }),
      }
    }
    if (url === '/api/register') {
      return {
        ok: true,
        status: 201,
        headers: { get: () => null },
        text: async () =>
          JSON.stringify({
            ok: true,
            registration: { id: 'reg-1', email: 'guest@example.com', fullName: 'Guest One' },
          }),
      }
    }
    if (url === '/api/payment/coupon') {
      const body = JSON.parse(init.body)
      return couponReply(body)
    }
    throw new Error(`unexpected fetch: ${url}`)
  })
  vi.stubGlobal('fetch', fetchMock)
  return fetchMock
}

const validCoupon = () => ({
  ok: true,
  status: 200,
  headers: { get: () => null },
  text: async () =>
    JSON.stringify({
      ok: true,
      coupon: { code: 'SAVE100', discount: 100, passPrice: PASS_PRICE, amount: 499 },
    }),
})

const invalidCoupon = () => ({
  ok: false,
  status: 404,
  headers: { get: () => null },
  text: async () => JSON.stringify({ ok: false, error: 'That coupon code is not valid.' }),
})

// Fill the details form and cross to the bank-QR step, where the coupon field
// lives.
async function reachPaymentStep() {
  render(
    <MemoryRouter>
      <Register />
    </MemoryRouter>,
  )
  fireEvent.change(screen.getByLabelText(/full name/i), { target: { value: 'Guest One' } })
  fireEvent.change(screen.getByLabelText(/phone number/i), { target: { value: '9876500000' } })
  fireEvent.change(screen.getByLabelText(/email address/i), { target: { value: 'guest@example.com' } })
  fireEvent.click(screen.getByRole('button', { name: /guest/i }))
  fireEvent.click(screen.getByRole('button', { name: /continue to secure payment/i }))
  await screen.findByText(/scan and pay/i)
}

beforeEach(() => {
  vi.restoreAllMocks()
  resetBackendHealth()
  markBackendWarm()
})

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('coupon entry at checkout', () => {
  it('shows the undiscounted price before any coupon is applied', async () => {
    stubFetch(validCoupon)
    await reachPaymentStep()
    expect(screen.getByRole('img', { name: /pay ₹599 by UPI/i })).toBeInTheDocument()
    expect(screen.getByText(/transfer exactly ₹599/i)).toBeInTheDocument()
  })

  it('moves every price on screen together when a coupon applies', async () => {
    stubFetch(validCoupon)
    await reachPaymentStep()

    fireEvent.change(screen.getByLabelText(/have a coupon/i), { target: { value: 'SAVE100' } })
    fireEvent.click(screen.getByRole('button', { name: /^apply$/i }))

    await waitFor(() => expect(screen.getByText(/you save ₹100/i)).toBeInTheDocument())

    // The QR alt text is the easiest to leave stale and is what tells a
    // screen-reader user what to pay — a ₹599 alt beside a ₹499 instruction is
    // exactly the mistake that costs a buyer money.
    expect(screen.getByRole('img', { name: /pay ₹499 by UPI/i })).toBeInTheDocument()
    expect(screen.getByText(/transfer exactly ₹499/i)).toBeInTheDocument()
    expect(screen.queryByRole('img', { name: /pay ₹599 by UPI/i })).not.toBeInTheDocument()
  })

  it('reports an invalid code and leaves the price untouched', async () => {
    stubFetch(invalidCoupon)
    await reachPaymentStep()

    fireEvent.change(screen.getByLabelText(/have a coupon/i), { target: { value: 'BOGUS' } })
    fireEvent.click(screen.getByRole('button', { name: /^apply$/i }))

    await waitFor(() => expect(screen.getByText(/not valid/i)).toBeInTheDocument())
    expect(screen.getByRole('img', { name: /pay ₹599 by UPI/i })).toBeInTheDocument()
  })

  it('restores the full price when the coupon is removed', async () => {
    stubFetch(validCoupon)
    await reachPaymentStep()

    fireEvent.change(screen.getByLabelText(/have a coupon/i), { target: { value: 'SAVE100' } })
    fireEvent.click(screen.getByRole('button', { name: /^apply$/i }))
    await waitFor(() => expect(screen.getByText(/you save ₹100/i)).toBeInTheDocument())

    fireEvent.click(screen.getByRole('button', { name: /remove/i }))
    await waitFor(() =>
      expect(screen.getByRole('img', { name: /pay ₹599 by UPI/i })).toBeInTheDocument(),
    )
  })

  it('sends only the code to the server — never an amount', async () => {
    const fetchMock = stubFetch(validCoupon)
    await reachPaymentStep()

    fireEvent.change(screen.getByLabelText(/have a coupon/i), { target: { value: 'SAVE100' } })
    fireEvent.click(screen.getByRole('button', { name: /^apply$/i }))
    await waitFor(() => expect(screen.getByText(/you save ₹100/i)).toBeInTheDocument())

    const call = fetchMock.mock.calls.find(([u]) => u === '/api/payment/coupon')
    expect(call).toBeTruthy()
    const body = JSON.parse(call[1].body)
    // The price must never be a client input: only the code goes up.
    expect(body).toEqual({ code: 'SAVE100' })
  })
})
