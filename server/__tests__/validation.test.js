// @vitest-environment node
import { describe, it, expect } from 'vitest'
import { validateRegistration, CAMPUSES, DESIGNATIONS } from '../registrations.js'

const base = {
  fullName: 'Asha Rao',
  phone: '+919876543210',
  email: 'asha@example.com',
  designation: 'guest',
  college: '',
  collegeOther: '',
}

describe('validateRegistration — contact fields', () => {
  it('accepts a valid guest with no college', () => {
    const { errors } = validateRegistration(base)
    expect(errors).toEqual([])
  })

  it('rejects a missing / too-short full name', () => {
    const { errors } = validateRegistration({ ...base, fullName: 'A' })
    expect(errors).toContain('Full name is required.')
  })

  it('rejects an invalid phone number', () => {
    const { errors } = validateRegistration({ ...base, phone: 'not-a-phone' })
    expect(errors).toContain('Enter a valid phone number.')
  })

  it('rejects an invalid email', () => {
    const { errors } = validateRegistration({ ...base, email: 'nope' })
    expect(errors).toContain('Enter a valid email address.')
  })

  it('lowercases and trims the email', () => {
    const { data } = validateRegistration({ ...base, email: '  Asha@Example.COM ' })
    expect(data.email).toBe('asha@example.com')
  })

  it('rejects an unknown designation', () => {
    const { errors } = validateRegistration({ ...base, designation: 'alien' })
    expect(errors).toContain('Select a designation.')
  })
})

describe('validateRegistration — student / staff college rules', () => {
  it('requires a campus for a student', () => {
    const { errors } = validateRegistration({ ...base, designation: 'student', college: '' })
    expect(errors).toContain('Select a college / campus.')
  })

  it('requires a campus for staff', () => {
    const { errors } = validateRegistration({ ...base, designation: 'staff', college: '' })
    expect(errors).toContain('Select a college / campus.')
  })

  it('accepts a known campus for a student', () => {
    const { errors } = validateRegistration({
      ...base,
      designation: 'student',
      college: 'KLH Bachupally Campus',
    })
    expect(errors).toEqual([])
  })

  it('requires the free-text college name when campus is Others', () => {
    const { errors } = validateRegistration({
      ...base,
      designation: 'student',
      college: 'Others',
      collegeOther: '',
    })
    expect(errors).toContain('Enter your college name.')
  })

  it('accepts Others with a college name filled in', () => {
    const { errors } = validateRegistration({
      ...base,
      designation: 'student',
      college: 'Others',
      collegeOther: 'Some Institute of Tech',
    })
    expect(errors).toEqual([])
  })

  it('does not require a college for a guest', () => {
    const { errors } = validateRegistration({ ...base, designation: 'guest', college: '' })
    expect(errors).toEqual([])
  })
})

describe('exported constants', () => {
  it('exposes the four campuses in order', () => {
    expect(CAMPUSES).toEqual([
      'KLH Bachupally Campus',
      'KL GBS Campus',
      'KL Aziz Nagar Campus',
      'Others',
    ])
  })

  it('exposes the three designations', () => {
    expect(DESIGNATIONS).toEqual(['student', 'staff', 'guest'])
  })
})
