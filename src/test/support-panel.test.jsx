import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import SupportPanel from '../components/SupportPanel'

const registration = {
  id: '11111111-2222-4333-8444-555555555555',
  full_name: 'Asha Rao',
  email: 'asha@example.com',
  phone: '9876500000',
}

// Minimal Response-shaped stub matching what lib/api.js reads off a fetch result.
function jsonResponse(status, body) {
  return {
    ok: status >= 200 && status < 300,
    status,
    headers: { get: () => null },
    text: async () => JSON.stringify(body),
  }
}

beforeEach(() => {
  vi.restoreAllMocks()
})

afterEach(() => {
  vi.unstubAllGlobals()
})

async function openForm() {
  render(<SupportPanel registration={registration} />)
  fireEvent.click(screen.getByRole('button', { name: /raise a ticket/i }))
  await screen.findByLabelText(/describe the issue/i)
}

describe('SupportPanel', () => {
  it('offers the support option collapsed, then opens the form on click', async () => {
    render(<SupportPanel registration={registration} />)
    // The form must not be in the way of the confirmation until asked for.
    expect(screen.queryByLabelText(/describe the issue/i)).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: /raise a ticket/i }))
    expect(await screen.findByLabelText(/describe the issue/i)).toBeTruthy()
  })

  it('prefills the phone and email from the registration', async () => {
    await openForm()
    expect(screen.getByLabelText(/phone number/i).value).toBe('9876500000')
    expect(screen.getByLabelText(/email address/i).value).toBe('asha@example.com')
  })

  it('posts the ticket and shows the wait-for-the-admin message', async () => {
    const fetchMock = vi.fn(async () =>
      jsonResponse(201, {
        ok: true,
        ticket: { id: 'abc' },
        message:
          'Your ticket has been raised. Our admin will contact you as soon as possible — please wait.',
      }),
    )
    vi.stubGlobal('fetch', fetchMock)

    await openForm()
    fireEvent.change(screen.getByLabelText(/describe the issue/i), {
      target: { value: 'I paid but my pass never arrived.' },
    })
    fireEvent.click(screen.getByRole('button', { name: /raise ticket/i }))

    expect(await screen.findByText(/contact you as soon as possible/i)).toBeTruthy()

    const [, init] = fetchMock.mock.calls[0]
    expect(init.method).toBe('POST')
    const sent = JSON.parse(init.body)
    expect(sent).toMatchObject({
      registrationId: registration.id,
      phone: '9876500000',
      email: 'asha@example.com',
      message: 'I paid but my pass never arrived.',
    })
  })

  it('keeps the edited phone and email rather than the prefilled ones', async () => {
    const fetchMock = vi.fn(async () => jsonResponse(201, { ok: true, ticket: { id: 'abc' } }))
    vi.stubGlobal('fetch', fetchMock)

    await openForm()
    // The most common reason to raise a ticket here is a mistyped address, so a
    // correction made in this form has to be what actually gets sent.
    fireEvent.change(screen.getByLabelText(/email address/i), {
      target: { value: 'fixed@example.com' },
    })
    fireEvent.change(screen.getByLabelText(/phone number/i), { target: { value: '9000000001' } })
    fireEvent.change(screen.getByLabelText(/describe the issue/i), {
      target: { value: 'My email address was wrong on the form.' },
    })
    fireEvent.click(screen.getByRole('button', { name: /raise ticket/i }))

    await screen.findByTestId('support-raised')
    const sent = JSON.parse(fetchMock.mock.calls[0][1].body)
    expect(sent.email).toBe('fixed@example.com')
    expect(sent.phone).toBe('9000000001')
  })

  it('shows the server error and stays on the form when the request fails', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => jsonResponse(400, { ok: false, error: 'Enter a valid phone number.' })),
    )

    await openForm()
    fireEvent.change(screen.getByLabelText(/describe the issue/i), {
      target: { value: 'Something went wrong with my payment.' },
    })
    fireEvent.click(screen.getByRole('button', { name: /raise ticket/i }))

    expect(await screen.findByRole('alert')).toHaveTextContent('Enter a valid phone number.')
    // Still editable — a failed raise must not look like a successful one.
    expect(screen.queryByTestId('support-raised')).toBeNull()
    expect(screen.getByLabelText(/describe the issue/i)).toBeTruthy()
  })

  it('surfaces the throttle message on a 429 instead of a generic failure', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () =>
        jsonResponse(429, { ok: false, error: 'You have already raised several tickets.' }),
      ),
    )

    await openForm()
    fireEvent.change(screen.getByLabelText(/describe the issue/i), {
      target: { value: 'Still waiting on my confirmation email.' },
    })
    fireEvent.click(screen.getByRole('button', { name: /raise ticket/i }))

    await waitFor(() =>
      expect(screen.getByRole('alert')).toHaveTextContent(/already raised several tickets/i),
    )
  })

  it('sends exactly one request when the button is double-clicked', async () => {
    let resolveFetch
    const fetchMock = vi.fn(
      () =>
        new Promise((resolve) => {
          resolveFetch = () => resolve(jsonResponse(201, { ok: true, ticket: { id: 'abc' } }))
        }),
    )
    vi.stubGlobal('fetch', fetchMock)

    await openForm()
    fireEvent.change(screen.getByLabelText(/describe the issue/i), {
      target: { value: 'Duplicate submissions should not reach the queue.' },
    })
    const button = screen.getByRole('button', { name: /raise ticket/i })
    fireEvent.click(button)
    fireEvent.click(button)

    expect(fetchMock).toHaveBeenCalledTimes(1)
    resolveFetch()
    await screen.findByTestId('support-raised')
  })
})
