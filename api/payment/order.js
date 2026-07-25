import 'dotenv/config'
import { createOrder } from '../../server/payments.js'

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')

  if (req.method === 'OPTIONS') return res.status(204).end()
  if (req.method !== 'POST') {
    return res.status(405).json({ ok: false, error: 'Method not allowed' })
  }

  try {
    const result = await createOrder({ registrationId: req.body?.registrationId })
    return res.status(result.status).json(result)
  } catch (err) {
    console.error('Order error:', err)
    return res.status(500).json({ ok: false, error: 'Could not start payment.' })
  }
}
