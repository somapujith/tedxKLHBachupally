import 'dotenv/config'
import express from 'express'
import cors from 'cors'
import { createRegistration } from './registrations.js'
import { ensureRegistrationsTable } from './db.js'

const app = express()
const port = Number(process.env.PORT) || 3001

app.use(cors())
app.use(express.json())

app.get('/api/health', async (_req, res) => {
  try {
    await ensureRegistrationsTable()
    res.json({ ok: true, db: 'connected' })
  } catch (err) {
    console.error(err)
    res.status(500).json({ ok: false, db: 'error' })
  }
})

app.post('/api/register', async (req, res) => {
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
})

app.listen(port, () => {
  console.log(`TEDx API listening on http://localhost:${port}`)
})
