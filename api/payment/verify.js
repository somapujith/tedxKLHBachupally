import 'dotenv/config'
import { verifyPayment } from '../../server/payments.js'

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')

  if (req.method === 'OPTIONS') return res.status(204).end()
  if (req.method !== 'POST') {
    return res.status(405).json({ ok: false, error: 'Method not allowed' })
  }

  try {
    const result = await verifyPayment(req.body || {})
    return res.status(result.status).json(result)
  } catch (err) {
    console.error('Verify error:', err)
    return res.status(500).json({ ok: false, error: 'Could not verify payment.' })
  }
}
