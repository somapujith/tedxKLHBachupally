// Retries transactional emails (booking confirmation, ticket/QR) that failed
// to send — built for a Resend daily-quota exhaustion, but general: it just
// looks at what the log says actually happened, not why.
//
// Safe to call repeatedly, including many times before the underlying cause
// (e.g. a quota reset) has actually occurred: it only acts on registrations
// whose MOST RECENT email_log attempt for that type is 'failed'. The moment
// one attempt succeeds, the next call's "latest attempt" check sees 'sent'
// and skips it. That idempotency is what lets a dumb periodic cron stand in
// for "the exact moment Resend's quota resets", which nothing in this stack
// can know in advance.
import { getSql } from './db.js'
import { sendBookingEmail } from './email.js'
import { recordEmail } from './audit.js'
import { resendTicket } from './admin.js'

export async function retryFailedTransactionalEmails() {
  const sql = getSql()

  // DISTINCT ON + ORDER BY ... DESC picks exactly one row per
  // (registration, email type): the latest attempt. Filtering to `failed`
  // AFTER that (not in the WHERE building the CTE) is what makes this
  // idempotent — a registration with one failed then one sent attempt must
  // never resurface just because a failed row still exists in the log.
  const targets = await sql`
    WITH latest AS (
      SELECT DISTINCT ON (registration_id, email_type)
        registration_id, email_type, status
      FROM email_log
      WHERE email_type IN ('booking', 'ticket') AND registration_id IS NOT NULL
      ORDER BY registration_id, email_type, created_at DESC
    )
    SELECT registration_id, email_type FROM latest WHERE status = 'failed'
  `

  const results = []

  for (const t of targets) {
    if (t.email_type === 'ticket') {
      // Regenerates the QR, sends, and logs — all the same guards a manual
      // "Resend pass" click gets (must be paid, revoked passes need
      // superadmin, a 2-minute cooldown against double-sends).
      const res = await resendTicket({
        registrationId: t.registration_id,
        actor: { adminUsername: 'auto-retry', adminRole: 'superadmin' },
        context: {},
      })
      results.push({
        registrationId: t.registration_id,
        emailType: 'ticket',
        ok: res.ok && res.emailed !== false,
        detail: res.ok ? null : res.error,
      })
      continue
    }

    // Booking confirmation has no existing "resend" path (only tickets do),
    // so this rebuilds the same call payments.js makes on first submission.
    const rows = await sql`
      SELECT id, full_name, email, utr_id, amount FROM registrations WHERE id = ${t.registration_id} LIMIT 1
    `
    const reg = rows[0]
    if (!reg) {
      results.push({
        registrationId: t.registration_id,
        emailType: 'booking',
        ok: false,
        detail: 'Registration no longer exists.',
      })
      continue
    }

    const sent = await sendBookingEmail({
      to: reg.email,
      fullName: reg.full_name,
      registrationId: reg.id,
      utrId: reg.utr_id,
      amount: reg.amount,
    })
    await recordEmail({
      registrationId: reg.id,
      toEmail: reg.email,
      fullName: reg.full_name,
      emailType: 'booking',
      status: sent.ok ? 'sent' : sent.skipped ? 'skipped' : 'failed',
      providerMessageId: sent.id,
      error: sent.detail,
      triggeredBy: 'auto-retry',
    })
    results.push({
      registrationId: t.registration_id,
      emailType: 'booking',
      ok: sent.ok,
      detail: sent.ok ? null : sent.detail,
    })
  }

  return {
    ok: true,
    status: 200,
    attempted: results.length,
    sent: results.filter((r) => r.ok).length,
    stillFailed: results.filter((r) => !r.ok).length,
    results,
  }
}
