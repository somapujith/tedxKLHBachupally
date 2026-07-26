import 'dotenv/config'
import { loginAdmin, setAdminCors } from '../../server/admin.js'

export default async function handler(req, res) {
  setAdminCors(req, res)
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization')

  if (req.method === 'OPTIONS') return res.status(204).end()
  if (req.method !== 'POST') {
    return res.status(405).json({ ok: false, error: 'Method not allowed' })
  }

  try {
    const result = await loginAdmin(req.body || {})
    return res.status(result.status).json(result)
  } catch (err) {
    console.error('Admin login error:', err)
    return res.status(500).json({ ok: false, error: 'Could not log in.' })
  }
}
