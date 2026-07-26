import mailchimpFactory from '@mailchimp/mailchimp_transactional'

const FROM_NAME = 'TEDxKLH Bachupally'

function ticketHtml({ fullName, registrationId }) {
  return `
    <div style="font-family: Arial, Helvetica, sans-serif; max-width: 520px; margin: 0 auto; padding: 24px; color: #111;">
      <h1 style="color: #e62b1e; font-size: 22px; margin-bottom: 4px;">TEDxKLH Bachupally</h1>
      <h2 style="font-size: 18px; margin-top: 0;">Your pass is confirmed</h2>
      <p>Hi ${fullName},</p>
      <p>Your payment is confirmed and your seat is reserved.</p>
      <p><strong>Show this QR code at the gate to claim your pass:</strong></p>
      <p style="text-align: center;">
        <img src="cid:qrpass" alt="Your entry QR code" width="240" height="240" style="max-width: 100%;" />
      </p>
      <p>If the QR does not display above, use the attached image (tedx-pass.png) instead.</p>
      <p>See you at the event!</p>
      <p style="font-size: 11px; color: #888; margin-top: 24px;">Registration ID: ${registrationId}</p>
    </div>
  `
}

// Sends the ticket email with the QR both inline (cid) and attached, so clients
// that block inline images still get it. Never throws.
export async function sendTicketEmail({ to, fullName, qrPngBuffer, registrationId }) {
  const apiKey = process.env.MAILCHIMP_TRANSACTIONAL_API_KEY
  if (!apiKey) {
    console.warn('MAILCHIMP_TRANSACTIONAL_API_KEY not set — skipping ticket email for', to)
    return { ok: false, skipped: true }
  }

  const qrBase64 = qrPngBuffer.toString('base64')
  const message = {
    from_email: process.env.EMAIL_FROM || 'tickets@tedxklhbachupally.com',
    from_name: FROM_NAME,
    to: [{ email: to, name: fullName, type: 'to' }],
    subject: 'Your TEDxKLH Bachupally Pass — Seat Confirmed',
    html: ticketHtml({ fullName, registrationId }),
    images: [{ type: 'image/png', name: 'qrpass', content: qrBase64 }],
    attachments: [{ type: 'image/png', name: 'tedx-pass.png', content: qrBase64 }],
  }

  try {
    const response = await mailchimpFactory(apiKey).messages.send({ message })
    const result = Array.isArray(response) ? response[0] : response
    if (result?.status === 'sent' || result?.status === 'queued') {
      return { ok: true }
    }
    console.error('Ticket email not accepted:', result?.status, result?.reject_reason)
    return { ok: false, error: `Email ${result?.status || 'failed'}.` }
  } catch (err) {
    console.error('Ticket email send failed:', err?.response?.data || err)
    return { ok: false, error: 'Email send failed.' }
  }
}
