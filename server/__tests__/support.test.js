// @vitest-environment node
// Unit tests for support ticket validation — no DB required.
import { describe, it, expect } from 'vitest'
import { validateSupportTicket } from '../support.js'

const valid = {
  registrationId: '11111111-2222-4333-8444-555555555555',
  fullName: 'Asha Rao',
  phone: '+91 98765 43210',
  email: 'asha@example.com',
  subject: 'Payment issue',
  message: 'I paid but my pass has not arrived yet.',
}

describe('validateSupportTicket', () => {
  it('accepts a fully valid ticket', () => {
    const { errors } = validateSupportTicket(valid)
    expect(errors).toEqual([])
  })

  it('accepts an empty subject and name — only contact details and message are required', () => {
    const { errors } = validateSupportTicket({ ...valid, subject: '', fullName: '' })
    expect(errors).toEqual([])
  })

  it('normalizes email to lowercase and trims whitespace', () => {
    const { data } = validateSupportTicket({
      ...valid,
      email: '  ASHA@Example.COM ',
      phone: '  9876543210  ',
    })
    expect(data.email).toBe('asha@example.com')
    expect(data.phone).toBe('9876543210')
  })

  it('rejects a missing phone number', () => {
    const { errors } = validateSupportTicket({ ...valid, phone: '' })
    expect(errors).toContain('Enter a valid phone number.')
  })

  it('rejects a malformed phone number', () => {
    const { errors } = validateSupportTicket({ ...valid, phone: 'call me' })
    expect(errors).toContain('Enter a valid phone number.')
  })

  it('rejects an invalid email', () => {
    const { errors } = validateSupportTicket({ ...valid, email: 'not-an-email' })
    expect(errors).toContain('Enter a valid email address.')
  })

  it('rejects a message shorter than 10 characters', () => {
    const { errors } = validateSupportTicket({ ...valid, message: 'help' })
    expect(errors).toContain('Describe your issue in at least 10 characters.')
  })

  it('rejects a message over 2000 characters', () => {
    const { errors } = validateSupportTicket({ ...valid, message: 'x'.repeat(2001) })
    expect(errors.some((e) => e.includes('under 2000'))).toBe(true)
  })

  it('strips control characters but keeps newlines in the message', () => {
    const { data } = validateSupportTicket({
      ...valid,
      message: 'line one\nline two with a bell',
    })
    expect(data.message).toBe('line one\nline two with a bell')
  })

  it('rejects non-string field values instead of coercing them', () => {
    const { errors } = validateSupportTicket({ ...valid, email: { toString: () => 'a@b.co' } })
    expect(errors).toContain('Enter a valid email address.')
  })

  it('handles a completely empty body without throwing', () => {
    const { errors } = validateSupportTicket({})
    expect(errors.length).toBeGreaterThan(0)
  })
})
