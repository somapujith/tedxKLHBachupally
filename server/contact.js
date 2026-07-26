import { getSql, ensureContactMessagesTable } from './db.js'

const MAX_NAME = 120
const MAX_EMAIL = 254
const MAX_SUBJECT = 150
const MAX_MESSAGE = 2000

// Only accept real strings — arrays/objects would otherwise stringify into
// garbage like "[object Object]" and pass length checks. Control characters
// (except newlines in the message body) are stripped so stored values can
// never carry header-injection or terminal-escape payloads.
function cleanString(value, { keepNewlines = false } = {}) {
  if (typeof value !== 'string') return ''
  const stripped = keepNewlines
    ? value.replace(/(?!\n)\p{Cc}/gu, '')
    : value.replace(/\p{Cc}/gu, ' ')
  return stripped.trim()
}

function normalize(body) {
  const src = body && typeof body === 'object' && !Array.isArray(body) ? body : {}
  return {
    name: cleanString(src.name),
    email: cleanString(src.email).toLowerCase(),
    phone: cleanString(src.phone),
    subject: cleanString(src.subject),
    message: cleanString(src.message, { keepNewlines: true }),
    website: cleanString(src.website), // honeypot — humans never fill this
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

// Per-email throttle enforced in the DB so it holds across serverless
// instances (the in-memory express-rate-limit store does not).
const MAX_PER_EMAIL_PER_HOUR = 3

export async function createContactMessage(body) {
  const { data, errors } = validateContactMessage(body)
  if (errors.length) {
    return { ok: false, status: 400, error: errors[0], errors }
  }

  // Honeypot tripped — a bot filled the invisible field. Pretend success so
  // the bot learns nothing; store nothing.
  if (data.website) {
    return { ok: true, status: 201, message: "Message received. We'll get back to you soon." }
  }

  const sql = getSql()
  await ensureContactMessagesTable(sql)

  try {
    const recent = await sql`
      SELECT COUNT(*)::int AS count FROM contact_messages
      WHERE email = ${data.email}
        AND created_at > NOW() - INTERVAL '1 hour'
    `
    if (recent[0].count >= MAX_PER_EMAIL_PER_HOUR) {
      return {
        ok: false,
        status: 429,
        error: 'Too many messages from this email. Please try again later.',
      }
    }

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
