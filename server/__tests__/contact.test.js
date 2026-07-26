// @vitest-environment node
// Unit tests for contact message validation — no DB required.
import { describe, it, expect } from 'vitest'
import { validateContactMessage } from '../contact.js'

const valid = {
  name: 'Asha Rao',
  email: 'asha@example.com',
  phone: '+91 98765 43210',
  subject: 'Partnership',
  message: 'Hello, we would like to partner with TEDxKLH Bachupally.',
}

describe('validateContactMessage', () => {
  it('accepts a fully valid message', () => {
    const { errors } = validateContactMessage(valid)
    expect(errors).toEqual([])
  })

  it('accepts empty optional phone and subject', () => {
    const { errors } = validateContactMessage({ ...valid, phone: '', subject: '' })
    expect(errors).toEqual([])
  })

  it('normalizes email to lowercase and trims fields', () => {
    const { data } = validateContactMessage({
      ...valid,
      email: '  ASHA@Example.COM ',
      name: '  Asha Rao  ',
    })
    expect(data.email).toBe('asha@example.com')
    expect(data.name).toBe('Asha Rao')
  })

  it('rejects a missing name', () => {
    const { errors } = validateContactMessage({ ...valid, name: '' })
    expect(errors).toContain('Name is required.')
  })

  it('rejects an invalid email', () => {
    const { errors } = validateContactMessage({ ...valid, email: 'not-an-email' })
    expect(errors).toContain('Enter a valid email address.')
  })

  it('rejects an invalid phone when provided', () => {
    const { errors } = validateContactMessage({ ...valid, phone: 'abc' })
    expect(errors).toContain('Enter a valid phone number or leave it empty.')
  })

  it('rejects a message shorter than 10 characters', () => {
    const { errors } = validateContactMessage({ ...valid, message: 'hi' })
    expect(errors).toContain('Message must be at least 10 characters.')
  })

  it('rejects a message over 2000 characters', () => {
    const { errors } = validateContactMessage({ ...valid, message: 'x'.repeat(2001) })
    expect(errors.some((e) => e.includes('under 2000'))).toBe(true)
  })

  it('rejects an overlong subject', () => {
    const { errors } = validateContactMessage({ ...valid, subject: 's'.repeat(151) })
    expect(errors).toContain('Subject is too long.')
  })

  it('handles a completely empty body without throwing', () => {
    const { errors } = validateContactMessage({})
    expect(errors.length).toBeGreaterThan(0)
  })
})
