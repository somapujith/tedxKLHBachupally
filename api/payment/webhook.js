import 'dotenv/config'
import { handleWebhook } from '../../server/payments.js'

// Razorpay signs the raw request bytes — disable Vercel's body parser.
export const config = { api: { bodyParser: false } }

function readRawBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = []
    req.on('data', (c) => chunks.push(c))
    req.on('end', () => resolve(Buffer.concat(chunks)))
    req.on('error', reject)
  })
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ ok: false, error: 'Method not allowed' })
  }

  try {
    const rawBody = await readRawBody(req)
    const signature = req.headers['x-razorpay-signature']
    const result = await handleWebhook(rawBody, signature)
    return res.status(result.status).json(result)
  } catch (err) {
    console.error('Webhook error:', err)
    return res.status(500).json({ ok: false, error: 'Webhook processing failed.' })
  }
}
