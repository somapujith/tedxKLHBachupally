import { Resend } from 'resend'
import { event, contact } from '../src/data/event.js'
import { TEDX_LOGO_PNG_BASE64 } from './email-assets.js'

const FROM_NAME = 'TEDxKLH Bachupally'
const LOGO_CID = 'tedx-logo'
const QR_CID = 'tedx-qr'

// Lazily constructed so a missing key never throws at import time (the API
// modules import this file at cold start, before env is necessarily complete).
let client = null
function getClient(apiKey) {
  if (!client) client = new Resend(apiKey)
  return client
}

// `from` must be on a domain verified in Resend, otherwise every send 403s.
function fromAddress() {
  const address = process.env.EMAIL_FROM || 'tickets@tedxklhbachupally.in'
  return `${FROM_NAME} <${address}>`
}

function detailRow(label, value) {
  return `
    <tr>
      <td style="padding:10px 0;border-bottom:1px solid #ebebeb;font:600 11px/1.2 Arial,Helvetica,sans-serif;letter-spacing:.09em;text-transform:uppercase;color:#8a8a8a;white-space:nowrap;vertical-align:top;width:74px;">${label}</td>
      <td style="padding:10px 0 10px 16px;border-bottom:1px solid #ebebeb;font:400 15px/1.45 Arial,Helvetica,sans-serif;color:#111111;">${value}</td>
    </tr>`
}

// Table-based, inline-styled layout — the only markup Outlook and Gmail both
// render predictably. Images are attached by cid (never hotlinked), so the pass
// survives a client that blocks remote images.
export function ticketHtml({ fullName, registrationId }) {
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width,initial-scale=1" />
<title>Your TEDxKLH Bachupally pass</title>
</head>
<body style="margin:0;padding:0;background:#f4f4f4;">
  <div style="display:none;max-height:0;overflow:hidden;opacity:0;">Your seat at TEDxKLH Bachupally is confirmed. Your entry QR is inside.</div>
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#f4f4f4;">
    <tr>
      <td align="center" style="padding:32px 16px;">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:560px;background:#ffffff;border-radius:14px;overflow:hidden;">

          <!-- Logo -->
          <tr>
            <td align="center" style="padding:34px 32px 28px;border-bottom:1px solid #ebebeb;">
              <img src="cid:${LOGO_CID}" alt="TEDxKLH Bachupally" width="230" style="display:block;width:230px;max-width:78%;height:auto;border:0;" />
            </td>
          </tr>

          <!-- Confirmation -->
          <tr>
            <td style="padding:36px 32px 6px;">
              <h1 style="margin:0;font:700 27px/1.25 Arial,Helvetica,sans-serif;color:#111111;">Your seat has been confirmed!!</h1>
              <p style="margin:16px 0 0;font:400 15px/1.6 Arial,Helvetica,sans-serif;color:#4a4a4a;">Hi ${fullName}, your payment went through and your seat at ${event.edition} is reserved. Here are the details.</p>
            </td>
          </tr>

          <!-- Venue + timing -->
          <tr>
            <td style="padding:22px 32px 4px;">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
                ${detailRow('Date', event.date)}
                ${detailRow('Time', `${event.time}<span style="color:#8a8a8a;"> · ${event.timeNote}</span>`)}
                ${detailRow('Venue', `${event.venue}<br /><span style="color:#6a6a6a;">${event.streetAddress}, ${event.locality}, ${event.region} ${event.postalCode}</span>`)}
              </table>
              <p style="margin:18px 0 0;font:400 14px/1.4 Arial,Helvetica,sans-serif;">
                <a href="${event.mapsUrl}" style="color:#e62b1e;text-decoration:none;font-weight:600;">Open venue in Google Maps &rsaquo;</a>
              </p>
            </td>
          </tr>

          <!-- QR -->
          <tr>
            <td align="center" style="padding:34px 32px 0;">
              <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="border:1px solid #ebebeb;border-radius:12px;">
                <tr>
                  <td align="center" style="padding:22px 22px 18px;">
                    <img src="cid:${QR_CID}" alt="Your entry QR code" width="220" height="220" style="display:block;width:220px;height:220px;border:0;" />
                    <div style="margin-top:16px;padding-top:14px;border-top:1px solid #ebebeb;font:600 10px/1.2 Arial,Helvetica,sans-serif;letter-spacing:.1em;text-transform:uppercase;color:#8a8a8a;">Issued to</div>
                    <div style="margin-top:5px;font:700 17px/1.3 Arial,Helvetica,sans-serif;color:#111111;">${fullName}</div>
                    <div style="margin-top:12px;font:600 10px/1.2 Arial,Helvetica,sans-serif;letter-spacing:.1em;text-transform:uppercase;color:#8a8a8a;">Registration ID</div>
                    <div style="margin-top:4px;font:400 12px/1.3 'Courier New',Courier,monospace;color:#4a4a4a;word-break:break-all;">${registrationId}</div>
                  </td>
                </tr>
              </table>
              <p style="margin:14px 0 0;font:400 13px/1.5 Arial,Helvetica,sans-serif;color:#8a8a8a;">QR not showing? Open the attached <strong style="color:#4a4a4a;">tedx-pass.png</strong> — it is the same code.</p>
            </td>
          </tr>

          <!-- Note -->
          <tr>
            <td style="padding:26px 32px 34px;">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#fdf2f1;border-left:3px solid #e62b1e;border-radius:0 8px 8px 0;">
                <tr>
                  <td style="padding:14px 16px;font:400 13px/1.6 Arial,Helvetica,sans-serif;color:#7a2b25;">
                    <strong style="color:#b3261e;">Please note:</strong> This QR is to obtain the physical pass at the venue and does not represent the original pass.
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td align="center" style="padding:24px 32px 28px;background:#111111;">
              <div style="font:600 12px/1.2 Arial,Helvetica,sans-serif;letter-spacing:.14em;text-transform:uppercase;color:#ffffff;">TEDxKLH Bachupally</div>
              <div style="margin-top:8px;font:400 12px/1.6 Arial,Helvetica,sans-serif;color:#9a9a9a;">
                <a href="mailto:${contact.email}" style="color:#9a9a9a;text-decoration:none;">${contact.email}</a>
                &nbsp;·&nbsp;
                <a href="${contact.instagram}" style="color:#9a9a9a;text-decoration:none;">${contact.instagramHandle}</a>
              </div>
              <div style="margin-top:12px;font:400 10px/1.5 Arial,Helvetica,sans-serif;color:#6a6a6a;">This independent TEDx event is operated under license from TED.</div>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>`
}

// Plain-text alternative for clients that refuse HTML. The QR cannot be rendered
// here, so point at the attachment.
export function ticketText({ fullName, registrationId }) {
  return [
    'TEDxKLH BACHUPALLY',
    '',
    'YOUR SEAT HAS BEEN CONFIRMED!!',
    '',
    `Hi ${fullName}, your payment went through and your seat at ${event.edition} is reserved.`,
    '',
    `Date:  ${event.date}`,
    `Time:  ${event.time} (${event.timeNote})`,
    `Venue: ${event.venue}, ${event.streetAddress}, ${event.locality}, ${event.region} ${event.postalCode}`,
    `Map:   ${event.mapsUrl}`,
    '',
    `Issued to:       ${fullName}`,
    `Registration ID: ${registrationId}`,
    'Your entry QR is attached as tedx-pass.png — show it at the gate.',
    '',
    'Please note: This QR is to obtain the physical pass at the venue and does',
    'not represent the original pass.',
    '',
    `${contact.email} · ${contact.instagramHandle}`,
  ].join('\n')
}

// Sends the ticket email with the QR both inline (cid) and attached, so clients
// that block inline images still get it. Never throws — the caller rolls the
// send claim back on a falsy ok.
export async function sendTicketEmail({ to, fullName, qrPngBuffer, registrationId }) {
  const apiKey = process.env.RESEND_API_KEY
  if (!apiKey) {
    console.warn('RESEND_API_KEY not set — skipping ticket email for', to)
    return { ok: false, skipped: true }
  }

  const qrBase64 = qrPngBuffer.toString('base64')

  try {
    const { data, error } = await getClient(apiKey).emails.send({
      from: fromAddress(),
      to: [to],
      subject: 'Your TEDxKLH Bachupally Pass — Seat Confirmed',
      html: ticketHtml({ fullName, registrationId }),
      text: ticketText({ fullName, registrationId }),
      // Exactly two parts, and exactly ONE QR. The SDK field is `contentId`
      // (mapped to content_id on the wire) — naming it `cid` silently drops it
      // and the image ships as a plain attachment that Gmail renders as a broken
      // <img>. Only contentId makes Resend set Content-Disposition: inline,
      // which is what lets the `cid:` references in the HTML above resolve.
      // An inline part still appears in the client's attachment strip, so this
      // single QR is both the embedded image and the downloadable copy.
      attachments: [
        { filename: 'tedx-logo.png', content: TEDX_LOGO_PNG_BASE64, contentType: 'image/png', contentId: LOGO_CID },
        { filename: 'tedx-pass.png', content: qrBase64, contentType: 'image/png', contentId: QR_CID },
      ],
    })

    if (error) {
      console.error('Ticket email rejected by Resend:', error.name, error.message)
      return { ok: false, error: 'Email send failed.' }
    }
    if (!data?.id) {
      console.error('Ticket email returned no message id.')
      return { ok: false, error: 'Email send failed.' }
    }
    return { ok: true, id: data.id }
  } catch (err) {
    console.error('Ticket email send failed:', err?.message || err)
    return { ok: false, error: 'Email send failed.' }
  }
}
