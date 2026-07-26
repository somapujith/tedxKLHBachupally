import { getSql, ensureContactMessagesTable } from './db.js'

const MAX_NAME = 120
const MAX_EMAIL = 254
const MAX_SUBJECT = 150
const MAX_MESSAGE = 2000

function normalize(body) {
  return {
    name: String(body.name || '').trim(),
    email: String(body.email || '').trim().toLowerCase(),
    phone: String(body.phone || '').trim(),
    subject: String(body.subject || '').trim(),
    message: String(body.message || '').trim(),
  }
}

export function validateContactMessage(body) {
  const data = normalize(body)
  const errors = []

  if (data.name.length < 2) errors.push('Name is required.')
  if (data.name.length > MAX_NAME) errors.push('Name is too long.')
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(data.email) || data.email.length > MAX_EMAIL) {
    errors.push('Enter a valid email address.')
  }
  if (data.phone && !/^[+\d][\d\s()-]{7,19}$/.test(data.phone)) {
    errors.push('Enter a valid phone number or leave it empty.')
  }
  if (data.subject.length > MAX_SUBJECT) errors.push('Subject is too long.')
  if (data.message.length < 10) errors.push('Message must be at least 10 characters.')
  if (data.message.length > MAX_MESSAGE) {
    errors.push(`Message must be under ${MAX_MESSAGE} characters.`)
  }

  return { data, errors }
}

export async function createContactMessage(body) {
  const { data, errors } = validateContactMessage(body)
  if (errors.length) {
    return { ok: false, status: 400, error: errors[0], errors }
  }

  const sql = getSql()
  await ensureContactMessagesTable(sql)

  try {
    const rows = await sql`
      INSERT INTO contact_messages (name, email, phone, subject, message)
      VALUES (
        ${data.name},
        ${data.email},
        ${data.phone || null},
        ${data.subject || null},
        ${data.message}
      )
      RETURNING id, created_at
    `
    return {
      ok: true,
      status: 201,
      id: rows[0].id,
      message: "Message received. We'll get back to you soon.",
    }
  } catch (err) {
    console.error('createContactMessage failed:', err)
    return { ok: false, status: 500, error: 'Could not send your message. Please try again.' }
  }
}
