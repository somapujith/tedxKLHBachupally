import crypto from 'node:crypto'
import jwt from 'jsonwebtoken'
import QRCode from 'qrcode'
import { getSql } from './db.js'
import { sendTicketEmail } from './email.js'

const TICKET_ISSUER = 'tedxklh'

function getTicketSecret() {
  const secret = process.env.TICKET_JWT_SECRET
  if (!secret) {
    throw new Error('TICKET_JWT_SECRET is not set')
  }
  return secret
}

export function signTicket(registration, jti) {
  return jwt.sign({ rid: registration.id, jti }, getTicketSecret(), {
    algorithm: 'HS256',
    expiresIn: '365d',
    issuer: TICKET_ISSUER,
  })
}

export function verifyTicket(token) {
  try {
    const payload = jwt.verify(token, getTicketSecret(), {
      algorithms: ['HS256'],
      issuer: TICKET_ISSUER,
    })
    return { ok: true, payload }
  } catch (err) {
    return { ok: false, error: err?.message || 'Invalid ticket token.' }
  }
}

// Claim a jti for the registration, tolerating a concurrent claimer: the
// conditional UPDATE only wins for one caller; the loser re-reads the winner's jti.
async function ensureTicketJti(sql, registration) {
  if (registration.ticket_jti) return registration
  const jti = crypto.randomUUID()
  const updated = await sql`
    UPDATE registrations
    SET ticket_jti = ${jti}, ticket_issued_at = NOW()
    WHERE id = ${registration.id} AND ticket_jti IS NULL
    RETURNING id, email, full_name, ticket_jti, ticket_email_sent_at
  `
  if (updated.length) return updated[0]
  const rows = await sql`
    SELECT id, email, full_name, ticket_jti, ticket_email_sent_at
    FROM registrations WHERE id = ${registration.id} LIMIT 1
  `
  return rows[0]
}

// Claim the email send atomically: flip ticket_email_sent_at from NULL to NOW()
// in a single conditional UPDATE. Only the caller whose UPDATE returns a row won
// the claim and may send — this closes the webhook+verify double-send race where
// both readers saw ticket_email_sent_at IS NULL. With force, re-claim regardless
// of the current stamp (used by an admin resend).
async function claimEmailSend(sql, id, { force }) {
  const rows = force
    ? await sql`
        UPDATE registrations SET ticket_email_sent_at = NOW()
        WHERE id = ${id} RETURNING id
      `
    : await sql`
        UPDATE registrations SET ticket_email_sent_at = NOW()
        WHERE id = ${id} AND ticket_email_sent_at IS NULL RETURNING id
      `
  return rows.length > 0
}

// Idempotent: safe to call from both the verify path and webhook replays.
// Issues the jti once, emails once (claim-then-send), and — only with force —
// re-sends for an admin-triggered resend.
export async function issueTicket(registrationId, { force = false } = {}) {
  try {
    const sql = getSql()
    const rows = await sql`
      SELECT id, email, full_name, payment_status, ticket_jti, ticket_email_sent_at
      FROM registrations WHERE id = ${registrationId} LIMIT 1
    `
    if (!rows[0]) {
      return { ok: false, error: 'Registration not found.' }
    }
    if (rows[0].payment_status !== 'paid') {
      return { ok: false, error: 'Registration is not paid.' }
    }

    const reg = await ensureTicketJti(sql, rows[0])
    if (!reg?.ticket_jti) {
      return { ok: false, error: 'Could not issue ticket.' }
    }

    // Claim the send before doing any work. If we did not win the claim (and this
    // is not a forced resend), someone else is sending — do not double-send.
    const claimed = await claimEmailSend(sql, reg.id, { force })
    if (!claimed) {
      return { ok: true, emailed: false }
    }

    const token = signTicket(reg, reg.ticket_jti)
    const qrPngBuffer = await QRCode.toBuffer(token, { width: 480, margin: 2 })
    const sent = await sendTicketEmail({
      to: reg.email,
      fullName: reg.full_name,
      qrPngBuffer,
      registrationId: reg.id,
    })
    if (!sent.ok) {
      // Roll the stamp back to NULL so a later attempt can re-claim and retry.
      await sql`
        UPDATE registrations SET ticket_email_sent_at = NULL WHERE id = ${reg.id}
      `
      return { ok: true, emailed: false }
    }

    return { ok: true, emailed: true }
  } catch (err) {
    console.error('issueTicket failed:', err)
    return { ok: false }
  }
}
