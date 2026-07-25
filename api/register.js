import 'dotenv/config'
import { createRegistration } from '../server/registrations.js'
import { ensureRegistrationsTable } from '../server/db.js'

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')

  if (req.method === 'OPTIONS') {
    return res.status(204).end()
  }

  if (req.method === 'GET') {
    try {
      await ensureRegistrationsTable()
      return res.status(200).json({ ok: true, db: 'connected' })
    } catch {
      return res.status(500).json({ ok: false, db: 'error' })
    }
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ ok: false, error: 'Method not allowed' })
  }

  const result = await createRegistration(req.body || {})
  if (!result.ok) {
    return res.status(result.status).json({
      ok: false,
      error: result.error,
      errors: result.errors,
    })
  }

  return res.status(result.status).json({
    ok: true,
    registration: result.registration,
    next: result.next,
    message: result.message,
  })
}
