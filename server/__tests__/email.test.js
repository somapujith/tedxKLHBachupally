// @vitest-environment node
// Contract tests for the Resend ticket email. The only mock is the `resend`
// module itself (the system boundary we must not cross in CI); the template,
// the cid wiring and the attachment set are all exercised for real.
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'

const send = vi.fn()
vi.mock('resend', () => ({
  Resend: class {
    constructor(apiKey) {
      this.apiKey = apiKey
      this.emails = { send }
    }
  },
}))

const { sendTicketEmail, ticketHtml, ticketText } = await import('../email.js')

const SAMPLE = { fullName: 'Aarav Sharma', registrationId: 'reg-0001' }
const QR_BUFFER = Buffer.from([0x89, 0x50, 0x4e, 0x47])
const ORIGINAL_KEY = process.env.RESEND_API_KEY
const ORIGINAL_FROM = process.env.EMAIL_FROM

function restore(name, value) {
  if (value === undefined) delete process.env[name]
  else process.env[name] = value
}

beforeEach(() => {
  send.mockReset()
  send.mockResolvedValue({ data: { id: 'msg_123' }, error: null })
  process.env.RESEND_API_KEY = 're_test_key'
  process.env.EMAIL_FROM = 'tickets@tedxklhbachupally.in'
})

afterEach(() => {
  restore('RESEND_API_KEY', ORIGINAL_KEY)
  restore('EMAIL_FROM', ORIGINAL_FROM)
})

describe('ticketHtml', () => {
  const html = ticketHtml(SAMPLE)

  it('renders the confirmation headline and the attendee name', () => {
    expect(html).toContain('Your seat has been confirmed!!')
    expect(html).toContain('Aarav Sharma')
  })

  it('renders the venue and timing block', () => {
    expect(html).toContain('Saturday, August 22, 2026')
    expect(html).toContain('9:30 AM – 3:00 PM')
    expect(html).toContain('KLH Bachupally Campus')
  })

  it('references the logo and the QR by cid, never by remote URL', () => {
    expect(html).toContain('src="cid:tedx-logo"')
    expect(html).toContain('src="cid:tedx-qr"')
    expect(html).not.toMatch(/<img[^>]+src="https?:/)
  })

  it('carries the physical-pass disclaimer verbatim', () => {
    expect(html).toContain(
      'This QR is to obtain the physical pass at the venue and does not represent the original pass.',
    )
  })

  it('shows the registration id so the gate can cross-check a failed scan', () => {
    expect(html).toContain('reg-0001')
  })
})

describe('ticketText', () => {
  it('states the disclaimer and points at the attachment', () => {
    const text = ticketText(SAMPLE)
    expect(text).toContain('This QR is to obtain the physical pass at the venue and does')
    expect(text).toContain('tedx-pass.png')
    expect(text).toContain('reg-0001')
  })
})

describe('sendTicketEmail', () => {
  it('skips without calling Resend when no API key is configured', async () => {
    delete process.env.RESEND_API_KEY
    const result = await sendTicketEmail({ to: 'a@b.com', qrPngBuffer: QR_BUFFER, ...SAMPLE })
    expect(result).toEqual({ ok: false, skipped: true })
    expect(send).not.toHaveBeenCalled()
  })

  it('sends to the registered attendee', async () => {
    const result = await sendTicketEmail({
      to: 'attendee@example.com',
      qrPngBuffer: QR_BUFFER,
      ...SAMPLE,
    })
    expect(result.ok).toBe(true)
    expect(result.id).toBe('msg_123')

    const payload = send.mock.calls[0][0]
    expect(payload.to).toEqual(['attendee@example.com'])
    expect(payload.from).toBe('TEDxKLH Bachupally <tickets@tedxklhbachupally.in>')
    expect(payload.subject).toMatch(/Seat Confirmed/)
  })

  it('attaches exactly one QR, and marks it inline via contentId', async () => {
    await sendTicketEmail({ to: 'a@b.com', qrPngBuffer: QR_BUFFER, ...SAMPLE })
    const { attachments } = send.mock.calls[0][0]
    const qrBase64 = QR_BUFFER.toString('base64')

    // Regression guard: the QR used to ship twice (once inline, once as a
    // download), which surfaced as two duplicate QR thumbnails in Gmail.
    expect(attachments.filter((a) => a.content === qrBase64)).toHaveLength(1)
    expect(attachments).toHaveLength(2)

    const qr = attachments.find((a) => a.filename === 'tedx-pass.png')
    const logo = attachments.find((a) => a.filename === 'tedx-logo.png')
    expect(qr.content).toBe(qrBase64)
    expect(logo.content.length).toBeGreaterThan(1000)

    // Regression guard: the Resend SDK field is `contentId`, NOT `cid`. Using
    // `cid` is silently ignored, the part ships as a plain attachment, and every
    // cid: reference in the HTML renders as a broken image.
    expect(qr.contentId).toBe('tedx-qr')
    expect(logo.contentId).toBe('tedx-logo')
    expect(attachments.some((a) => 'cid' in a)).toBe(false)
  })

  it('names the attendee on the pass so the gate can match person to QR', async () => {
    const html = ticketHtml(SAMPLE)
    expect(html).toContain('Issued to')
    expect(html).toContain('Aarav Sharma')
    expect(ticketText(SAMPLE)).toMatch(/Issued to:\s+Aarav Sharma/)
  })

  it('reports failure (so the caller can roll back the send claim) when Resend returns an error', async () => {
    send.mockResolvedValue({ data: null, error: { name: 'validation_error', message: 'bad domain' } })
    const result = await sendTicketEmail({ to: 'a@b.com', qrPngBuffer: QR_BUFFER, ...SAMPLE })
    expect(result.ok).toBe(false)
    expect(result.skipped).toBeUndefined()
  })

  it('reports failure instead of throwing when the SDK throws', async () => {
    send.mockRejectedValue(new Error('network down'))
    const result = await sendTicketEmail({ to: 'a@b.com', qrPngBuffer: QR_BUFFER, ...SAMPLE })
    expect(result.ok).toBe(false)
  })

  it('does not leak the upstream error text to the caller', async () => {
    send.mockRejectedValue(new Error('Invalid API key re_secret_value'))
    const result = await sendTicketEmail({ to: 'a@b.com', qrPngBuffer: QR_BUFFER, ...SAMPLE })
    expect(result.error).toBe('Email send failed.')
  })
})
