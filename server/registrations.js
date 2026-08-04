import { getSql, ensureSchemaOnce, withDbRetry } from './db.js'

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
  await ensureSchemaOnce(sql)

  const college = data.designation === 'guest' ? null : data.college
  const collegeOther =
    data.designation !== 'guest' && data.college === 'Others' ? data.collegeOther : null

  try {
    // An email may register as many times as it likes — one person buying
    // passes for family or colleagues shares an inbox, and a paid attendee
    // returning for a second seat is a sale, not a mistake. Each submission
    // therefore gets its own row, its own payment and its own QR pass.
    //
    // A row that never got as far as a payment attempt is still resumed rather
    // than duplicated: it is an abandoned checkout, not a second seat, and
    // reusing it keeps one person's retries from littering the table.
    //
    // Only 'pending' and 'rejected' qualify. 'submitted' must NOT be resumed:
    // that row already carries a UTR and a proof image awaiting an admin, so
    // handing it back would overwrite the details of a submission under review
    // AND strand the buyer — submitPaymentProof refuses a row that is already
    // awaiting verification, so they could never pay for the second seat. A
    // 'paid' row is excluded for the same reason it always was: so it cannot
    // capture the resume and block a legitimate repeat registration.
    const existing = await withDbRetry(() => sql`
      SELECT id FROM registrations
      WHERE LOWER(email) = ${data.email}
        AND payment_status IN ('pending', 'rejected')
      ORDER BY created_at DESC LIMIT 1
    `)

    if (existing[0]) {
      const updated = await sql`
        UPDATE registrations
        SET full_name = ${data.fullName},
            phone = ${data.phone},
            designation = ${data.designation},
            college = ${college},
            college_other = ${collegeOther}
        WHERE id = ${existing[0].id}
          AND payment_status IN ('pending', 'rejected')
        RETURNING id, email, designation, payment_status, created_at
      `
      // Zero rows means that row left the resumable set between the SELECT and
      // this UPDATE — the buyer submitted proof or an admin approved it in the
      // gap. The guard must mirror the SELECT exactly, or a row that just became
      // 'submitted' would still be captured here and its pending proof
      // overwritten. Returning `updated[0]` regardless would hand the client an
      // undefined registration and strand them with no id to pay against; fall
      // through to a fresh INSERT instead, which is a legal second seat.
      if (updated[0]) {
        return {
          ok: true,
          status: 200,
          registration: updated[0],
          next: 'payment',
          resumed: true,
          message: 'Resuming your pending registration. Continue to payment.',
        }
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
    // The former 23505 branch here mapped a unique violation to "this email is
    // already registered". That index is gone, so the only unique constraint an
    // INSERT could still hit is on razorpay_order_id — which is NULL until
    // checkout — and reporting such a failure as a duplicate email would be a
    // lie. Any error reaching this point is genuinely unexpected.
    console.error('createRegistration failed:', err)
    return { ok: false, status: 500, error: 'Could not save registration. Please try again.' }
  }
}

export { CAMPUSES, DESIGNATIONS }
