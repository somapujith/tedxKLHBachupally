import 'dotenv/config'
import { requireAdmin, listRegistrations, setAdminCors } from '../../server/admin.js'

export default async function handler(req, res) {
  setAdminCors(req, res)
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization')

  if (req.method === 'OPTIONS') return res.status(204).end()
  if (req.method !== 'GET') {
    return res.status(405).json({ ok: false, error: 'Method not allowed' })
  }

  const auth = requireAdmin(req)
  if (!auth.ok) return res.status(auth.status).json({ ok: false, error: auth.error })

  try {
    const result = await listRegistrations({ status: req.query?.status })
    return res.status(result.status).json(result)
  } catch (err) {
    console.error('Admin registrations error:', err)
    return res.status(500).json({ ok: false, error: 'Could not load registrations.' })
  }
}
