import { getSql, isUuid, withDbRetry, ensureSupportTicketsTable } from './db.js'
import { recordAudit, AUDIT_ACTIONS } from './audit.js'

// Attendee-raised support requests. An attendee who has just registered (or just
// paid) can open one from the confirmation screen; an admin works the queue and
// contacts them on the phone number / email they gave.
//
// Nothing here touches registrations. A support ticket is a message, not a state
// change: it must never move a payment_status, issue a pass, or consume a seat.

const MAX_NAME = 120
const MAX_EMAIL = 254
const MAX_SUBJECT = 150
const MAX_MESSAGE = 2000
const MAX_NOTE = 500

// Per-email throttle enforced in the DB so it holds across serverless instances
// (the in-memory express-rate-limit store does not, and Vercel runs many).
const MAX_PER_EMAIL_PER_HOUR = 5

// The subjects the confirmation screen offers. Free text is still accepted (a
// custom "Other" reason), the list only exists so the common cases arrive
// consistently labelled and the admin can scan the queue.
export const SUPPORT_SUBJECTS = [
  'Payment issue',
  'Did not receive my pass',
  'Wrong details on my registration',
  'Refund or cancellation',
  'Other',
]

// Only accept real strings — arrays/objects would otherwise stringify into
// garbage like "[object Object]" and pass length checks. Control characters
// (except newlines in the message body) are stripped so stored values can never
// carry header-injection or terminal-escape payloads.
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
    registrationId: cleanString(src.registrationId),
    fullName: cleanString(src.fullName),
    phone: cleanString(src.phone),
    email: cleanString(src.email).toLowerCase(),
    subject: cleanString(src.subject),
    message: cleanString(src.message, { keepNewlines: true }),
    website: cleanString(src.website), // honeypot — humans never fill this
  }
}

export function validateSupportTicket(body) {
  const data = normalize(body)
  const errors = []

  if (!/^[+\d][\d\s()-]{7,19}$/.test(data.phone)) {
    errors.push('Enter a valid phone number.')
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(data.email) || data.email.length > MAX_EMAIL) {
    errors.push('Enter a valid email address.')
  }
  if (data.fullName.length > MAX_NAME) errors.push('Name is too long.')
  if (data.subject.length > MAX_SUBJECT) errors.push('Subject is too long.')
  if (data.message.length < 10) errors.push('Describe your issue in at least 10 characters.')
  if (data.message.length > MAX_MESSAGE) {
    errors.push(`Your message must be under ${MAX_MESSAGE} characters.`)
  }

  return { data, errors }
}

/**
 * Raise a support ticket. Returns the same confirmation copy the UI shows, so a
 * caller that renders `message` verbatim cannot drift from what we promise here.
 */
export async function createSupportTicket(body) {
  const { data, errors } = validateSupportTicket(body)
  if (errors.length) {
    return { ok: false, status: 400, error: errors[0], errors }
  }

  const confirmation =
    'Your ticket has been raised. Our admin will contact you as soon as possible — please wait.'

  // Honeypot tripped — a bot filled the invisible field. Pretend success so the
  // bot learns nothing; store nothing.
  if (data.website) {
    return { ok: true, status: 201, message: confirmation }
  }

  // An id that is not a uuid is dropped rather than rejected: the ticket itself
  // is still worth having, and Postgres would throw 22P02 on the insert instead
  // of simply storing NULL. The contact details are what the admin actually
  // needs, and those were validated above.
  const registrationId = isUuid(data.registrationId) ? data.registrationId : null

  try {
    const sql = getSql()
    await ensureSupportTicketsTable(sql)

    const recent = await withDbRetry(() => sql`
      SELECT COUNT(*)::int AS count FROM support_tickets
      WHERE LOWER(email) = ${data.email}
        AND created_at > NOW() - INTERVAL '1 hour'
    `)
    if (recent[0].count >= MAX_PER_EMAIL_PER_HOUR) {
      return {
        ok: false,
        status: 429,
        error:
          'You have already raised several tickets. Our admin is on it — please wait before raising another.',
      }
    }

    const rows = await withDbRetry(() => sql`
      INSERT INTO support_tickets
        (registration_id, full_name, phone, email, subject, message)
      VALUES (
        ${registrationId},
        ${data.fullName || null},
        ${data.phone},
        ${data.email},
        ${data.subject || null},
        ${data.message}
      )
      RETURNING id, created_at
    `)

    return {
      ok: true,
      status: 201,
      ticket: { id: rows[0].id, createdAt: rows[0].created_at },
      message: confirmation,
    }
  } catch (err) {
    console.error('createSupportTicket failed:', err)
    return {
      ok: false,
      status: 500,
      error: 'Could not raise your ticket. Please try again.',
    }
  }
}

/**
 * Admin queue. Open tickets oldest-first (the person has been waiting longest),
 * resolved ones newest-first. `status` filters to one bucket; anything else
 * returns both, open first.
 */
export async function listSupportTickets({ status, limit = 100 } = {}) {
  const sql = getSql()
  await ensureSupportTicketsTable(sql)
  const capped = Math.min(Math.max(Number(limit) || 100, 1), 500)
  const filter = status === 'open' || status === 'resolved' ? status : null

  const rows = await withDbRetry(() => sql`
    SELECT t.id, t.registration_id, t.full_name, t.phone, t.email, t.subject,
           t.message, t.status, t.admin_note, t.resolved_at, t.resolved_by,
           t.created_at,
           r.payment_status, r.full_name AS registration_name
    FROM support_tickets t
    LEFT JOIN registrations r ON r.id = t.registration_id
    WHERE (${filter}::text IS NULL OR t.status = ${filter}::text)
    ORDER BY
      CASE WHEN t.status = 'open' THEN 0 ELSE 1 END,
      CASE WHEN t.status = 'open' THEN t.created_at END ASC,
      CASE WHEN t.status <> 'open' THEN t.created_at END DESC
    LIMIT ${capped}
  `)

  const openCount = await withDbRetry(() => sql`
    SELECT COUNT(*)::int AS count FROM support_tickets WHERE status = 'open'
  `)

  return { ok: true, status: 200, tickets: rows, openCount: openCount[0].count }
}

/**
 * Mark a ticket resolved (or reopen it). The conditional UPDATE is what makes
 * this safe under two admins working the queue at once: only the transition
 * from the *other* status writes a row, so the loser is told the ticket already
 * moved instead of silently overwriting the winner's stamp and note.
 */
export async function resolveSupportTicket(
  { ticketId, resolved = true, note },
  actor = {},
  context = {},
) {
  if (!isUuid(ticketId)) {
    return { ok: false, status: 400, error: 'Invalid ticket id.' }
  }

  const sql = getSql()
  await ensureSupportTicketsTable(sql)

  const adminName = actor.username || 'unknown'
  const trimmedNote =
    typeof note === 'string' && note.trim()
      ? note.trim().replace(/\p{Cc}/gu, ' ').slice(0, MAX_NOTE)
      : null

  const updated = resolved
    ? await withDbRetry(() => sql`
        UPDATE support_tickets
        SET status = 'resolved',
            resolved_at = NOW(),
            resolved_by = ${adminName},
            admin_note = COALESCE(${trimmedNote}, admin_note)
        WHERE id = ${ticketId} AND status = 'open'
        RETURNING id, full_name, email, status, resolved_at, resolved_by, admin_note
      `)
    : await withDbRetry(() => sql`
        UPDATE support_tickets
        SET status = 'open',
            resolved_at = NULL,
            resolved_by = NULL,
            admin_note = COALESCE(${trimmedNote}, admin_note)
        WHERE id = ${ticketId} AND status = 'resolved'
        RETURNING id, full_name, email, status, resolved_at, resolved_by, admin_note
      `)

  if (!updated.length) {
    // Either the id does not exist or the ticket is already in the target state.
    // Distinguish them so the admin knows whether to refresh or to look again.
    const exists = await withDbRetry(() => sql`
      SELECT status FROM support_tickets WHERE id = ${ticketId} LIMIT 1
    `)
    if (!exists.length) {
      return { ok: false, status: 404, error: 'Ticket not found.' }
    }
    return {
      ok: false,
      status: 409,
      error: `This ticket is already ${exists[0].status}.`,
    }
  }

  const ticket = updated[0]
  await recordAudit({
    action: resolved ? AUDIT_ACTIONS.SUPPORT_RESOLVED : AUDIT_ACTIONS.SUPPORT_REOPENED,
    adminId: actor.id,
    adminUsername: adminName,
    adminRole: actor.role,
    targetType: 'support_ticket',
    targetId: ticket.id,
    targetName: ticket.full_name || ticket.email,
    detail: trimmedNote || undefined,
    ip: context.ip,
    userAgent: context.userAgent,
  })

  return { ok: true, status: 200, ticket }
}
