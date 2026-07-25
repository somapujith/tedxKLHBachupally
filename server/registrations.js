import { getSql, ensureRegistrationsTable } from './db.js'

const CAMPUSES = [
  'KLH Bachupally Campus',
  'KL GBS Campus',
  'KL Aziz Nagar Campus',
  'Others',
]

const DESIGNATIONS = ['student', 'staff', 'guest']

function normalize(body) {
  return {
    fullName: String(body.fullName || '').trim(),
    phone: String(body.phone || '').trim(),
    email: String(body.email || '').trim().toLowerCase(),
    designation: String(body.designation || '').trim().toLowerCase(),
    college: String(body.college || '').trim(),
    collegeOther: String(body.collegeOther || '').trim(),
  }
}

export function validateRegistration(body) {
  const data = normalize(body)
  const errors = []

  if (data.fullName.length < 2) errors.push('Full name is required.')
  if (!/^[+\d][\d\s()-]{7,19}$/.test(data.phone)) errors.push('Enter a valid phone number.')
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(data.email)) errors.push('Enter a valid email address.')
  if (!DESIGNATIONS.includes(data.designation)) errors.push('Select a designation.')

  if (data.designation === 'student' || data.designation === 'staff') {
    if (!CAMPUSES.includes(data.college)) errors.push('Select a college / campus.')
    if (data.college === 'Others' && data.collegeOther.length < 2) {
      errors.push('Enter your college name.')
    }
  }

  return { data, errors }
}

export async function createRegistration(body) {
  const { data, errors } = validateRegistration(body)
  if (errors.length) {
    return { ok: false, status: 400, error: errors[0], errors }
  }

  const sql = getSql()
  await ensureRegistrationsTable(sql)

  const college = data.designation === 'guest' ? null : data.college
  const collegeOther =
    data.designation !== 'guest' && data.college === 'Others' ? data.collegeOther : null

  try {
    // A paid registration blocks re-registration. A pending one is resumable:
    // update the details and hand the same row back so the user can complete payment.
    const existing = await sql`
      SELECT id, payment_status FROM registrations
      WHERE LOWER(email) = ${data.email} LIMIT 1
    `
    if (existing[0]?.payment_status === 'paid') {
      return {
        ok: false,
        status: 409,
        error: 'This email is already registered and paid for the event.',
      }
    }

    if (existing[0]) {
      const updated = await sql`
        UPDATE registrations
        SET full_name = ${data.fullName},
            phone = ${data.phone},
            designation = ${data.designation},
            college = ${college},
            college_other = ${collegeOther}
        WHERE id = ${existing[0].id}
          AND payment_status <> 'paid'
        RETURNING id, email, designation, payment_status, created_at
      `
      return {
        ok: true,
        status: 200,
        registration: updated[0],
        next: 'payment',
        resumed: true,
        message: 'Resuming your pending registration. Continue to payment.',
      }
    }

    const rows = await sql`
      INSERT INTO registrations (
        full_name, phone, email, designation, college, college_other, payment_status
      ) VALUES (
        ${data.fullName},
        ${data.phone},
        ${data.email},
        ${data.designation},
        ${college},
        ${collegeOther},
        'pending'
      )
      RETURNING id, email, designation, payment_status, created_at
    `

    return {
      ok: true,
      status: 201,
      registration: rows[0],
      next: 'payment',
      message: 'Registration saved. Payment will be available next.',
    }
  } catch (err) {
    // Race: two concurrent inserts of the same email. Treat as already-registered.
    if (err?.code === '23505' || /unique|duplicate/i.test(String(err?.message))) {
      return {
        ok: false,
        status: 409,
        error: 'This email is already registered. Please try again in a moment.',
      }
    }
    console.error('createRegistration failed:', err)
    return { ok: false, status: 500, error: 'Could not save registration. Please try again.' }
  }
}

export { CAMPUSES, DESIGNATIONS }
