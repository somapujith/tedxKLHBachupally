import 'dotenv/config'
import { handleWebhook } from '../../server/payments.js'
import { withApi, LIMITS } from '../../server/http.js'

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

async function handler(req, res) {
  const rawBody = await readRawBody(req)
  const signature = req.headers['x-razorpay-signature']
  const result = await handleWebhook(rawBody, signature)
  return res.status(result.status).json(result)
}

// High per-IP cap so legitimate Razorpay retry storms are never throttled, while
// a rogue flood from one source is still bounded. Body-size guard is OFF — the
// body parser is disabled and the raw stream is read inside the handler, so the
// wrapper's parsed-body check does not apply. No CORS scope needed (server-to-server).
export default withApi(handler, { methods: ['POST'], limit: LIMITS.webhook, guardBody: false })
