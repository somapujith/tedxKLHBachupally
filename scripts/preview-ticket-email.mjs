// Renders the ticket email to a standalone HTML file you can open in a browser,
// so the template can be iterated on without burning real sends.
//
//   npm run email:preview                                        -> writes .preview/ticket-email.html
//   npm run email:preview -- --send you@example.com              -> also sends it for real
//   npm run email:preview -- --send you@example.com --name "Jo"  -> with a given attendee name
//
// The browser cannot resolve cid: URLs, so the cid references are rewritten to
// data: URIs here. The real email keeps cid — that is what makes the QR show up
// inline in Gmail/Outlook without a hotlinked image.
import fs from 'node:fs'
import path from 'node:path'
import crypto from 'node:crypto'
import 'dotenv/config'
import QRCode from 'qrcode'
import { ticketHtml, ticketText, sendTicketEmail } from '../server/email.js'
import { TEDX_LOGO_PNG_BASE64 } from '../server/email-assets.js'

const OUT_DIR = '.preview'
const OUT_FILE = path.join(OUT_DIR, 'ticket-email.html')

function flag(name, fallback = null) {
  const i = process.argv.indexOf(`--${name}`)
  return i !== -1 && process.argv[i + 1] ? process.argv[i + 1] : fallback
}

const sendTo = flag('send')

const sample = {
  fullName: flag('name', 'Aarav Sharma'),
  registrationId: crypto.randomUUID(),
}

// A realistic payload: same shape as a live pass (a signed ticket JWT), so the
// QR's module density in the preview matches production.
const fakeToken = [
  Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url'),
  Buffer.from(
    JSON.stringify({ rid: sample.registrationId, jti: crypto.randomUUID(), iss: 'tedxklh' }),
  ).toString('base64url'),
  crypto.randomBytes(32).toString('base64url'),
].join('.')

const qrPngBuffer = await QRCode.toBuffer(fakeToken, { width: 480, margin: 2 })

const html = ticketHtml(sample)
  .replace('cid:tedx-logo', `data:image/png;base64,${TEDX_LOGO_PNG_BASE64}`)
  .replace('cid:tedx-qr', `data:image/png;base64,${qrPngBuffer.toString('base64')}`)

fs.mkdirSync(OUT_DIR, { recursive: true })
fs.writeFileSync(OUT_FILE, html)
console.log(`HTML preview -> ${OUT_FILE}`)
console.log(`   open ${OUT_FILE}`)
console.log('\n--- plain-text alternative ---\n')
console.log(ticketText(sample))

if (sendTo) {
  if (!process.env.RESEND_API_KEY) {
    console.error('\nRESEND_API_KEY is not set — cannot send. Add it to .env first.')
    process.exit(1)
  }
  console.log(`\nSending a real test email to ${sendTo} ...`)
  const result = await sendTicketEmail({ to: sendTo, qrPngBuffer, ...sample })
  console.log(result.ok ? `Sent. Resend message id: ${result.id}` : `Failed: ${result.error}`)
  process.exit(result.ok ? 0 : 1)
}
