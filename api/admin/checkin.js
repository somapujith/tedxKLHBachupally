import 'dotenv/config'
import { requireAdmin, checkInTicket, setAdminCors } from '../../server/admin.js'

export default async function handler(req, res) {
  setAdminCors(req, res)
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization')

  if (req.method === 'OPTIONS') return res.status(204).end()
  if (req.method !== 'POST') {
    return res.status(405).json({ ok: false, error: 'Method not allowed' })
  }

  const auth = requireAdmin(req)
  if (!auth.ok) return res.status(auth.status).json({ ok: false, error: auth.error })

  try {
    const result = await checkInTicket({
      token: req.body?.token,
      adminName: auth.admin.name || auth.admin.username,
    })
    return res.status(result.status).json(result)
  } catch (err) {
    console.error('Admin checkin error:', err)
    return res.status(500).json({ ok: false, error: 'Could not check in.' })
  }
}
