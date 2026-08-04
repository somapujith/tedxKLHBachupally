// @vitest-environment node
// Integration tests against the real Neon database. Support ticket queue.
// Requires DATABASE_URL in .env. Cleans up its own rows.
import 'dotenv/config'
import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { getSql, ensureRegistrationsTable, ensureSupportTicketsTable } from '../db.js'
import { createRegistration } from '../registrations.js'
import { createSupportTicket, listSupportTickets, resolveSupportTicket } from '../support.js'

const sql = getSql()
const TAG = 'support_test_'
const email = (n) => `${TAG}${n}@example.com`

const ticketBody = (n, extra = {}) => ({
  fullName: 'Support Tester',
  phone: '9876500000',
  email: email(n),
  subject: 'Payment issue',
  message: 'I paid but my pass has not arrived yet.',
  ...extra,
})

const actor = { id: null, username: 'test_admin', role: 'admin' }

beforeAll(async () => {
  await ensureRegistrationsTable(sql)
  await ensureSupportTicketsTable(sql)
  await sql`DELETE FROM support_tickets WHERE email LIKE ${TAG + '%'}`
  await sql`DELETE FROM registrations WHERE email LIKE ${TAG + '%'}`
})

afterAll(async () => {
  await sql`DELETE FROM support_tickets WHERE email LIKE ${TAG + '%'}`
  await sql`DELETE FROM registrations WHERE email LIKE ${TAG + '%'}`
})

describe('createSupportTicket (real DB)', () => {
  it('stores a ticket and returns the wait-for-us confirmation', async () => {
    const res = await createSupportTicket(ticketBody('create'))
    expect(res.ok).toBe(true)
    expect(res.status).toBe(201)
    expect(res.ticket.id).toBeTruthy()
    expect(res.message).toMatch(/contact you as soon as possible/i)

    const rows = await sql`
      SELECT status, phone, subject FROM support_tickets WHERE id = ${res.ticket.id}
    `
    expect(rows[0].status).toBe('open')
    expect(rows[0].phone).toBe('9876500000')
  })

  it('links the ticket to the registration it was raised from', async () => {
    const reg = await createRegistration({
      fullName: 'Support Tester',
      phone: '9876500000',
      email: email('linked'),
      designation: 'guest',
    })
    expect(reg.ok).toBe(true)

    const res = await createSupportTicket(
      ticketBody('linked', { registrationId: reg.registration.id }),
    )
    expect(res.ok).toBe(true)

    const { tickets } = await listSupportTickets({ status: 'open' })
    const row = tickets.find((t) => t.id === res.ticket.id)
    expect(row.registration_id).toBe(reg.registration.id)
    // The join is what puts the attendee's payment state next to the complaint.
    expect(row.payment_status).toBe('pending')
    // A registration insert plus a ticket insert plus the list query is more
    // sequential Neon round-trips than the 5s default allows from a laptop.
  }, 20000)

  it('stores a ticket with a non-uuid registration id rather than throwing', async () => {
    const res = await createSupportTicket(ticketBody('badid', { registrationId: 'not-a-uuid' }))
    expect(res.ok).toBe(true)
    const rows = await sql`
      SELECT registration_id FROM support_tickets WHERE id = ${res.ticket.id}
    `
    expect(rows[0].registration_id).toBeNull()
  })

  it('rejects invalid input with 400 and inserts nothing', async () => {
    const res = await createSupportTicket(ticketBody('invalid', { phone: 'call me' }))
    expect(res.ok).toBe(false)
    expect(res.status).toBe(400)
    const rows = await sql`SELECT 1 FROM support_tickets WHERE email = ${email('invalid')}`
    expect(rows.length).toBe(0)
  })

  it('silently drops a honeypot submission without storing it', async () => {
    const res = await createSupportTicket(ticketBody('bot', { website: 'http://spam.example' }))
    expect(res.ok).toBe(true)
    const rows = await sql`SELECT 1 FROM support_tickets WHERE email = ${email('bot')}`
    expect(rows.length).toBe(0)
  })

  it('throttles a flood from one email with 429', async () => {
    const body = ticketBody('flood')
    for (let i = 0; i < 5; i++) {
      const res = await createSupportTicket(body)
      expect(res.ok).toBe(true)
    }
    const sixth = await createSupportTicket(body)
    expect(sixth.ok).toBe(false)
    expect(sixth.status).toBe(429)
    // Six sequential submissions, each a count query plus an insert.
  }, 30000)
})

describe('resolveSupportTicket (real DB)', () => {
  it('marks a ticket resolved and stamps who did it', async () => {
    const created = await createSupportTicket(ticketBody('resolve'))
    const res = await resolveSupportTicket({ ticketId: created.ticket.id, note: 'Called them' }, actor)
    expect(res.ok).toBe(true)
    expect(res.ticket.status).toBe('resolved')
    expect(res.ticket.resolved_by).toBe('test_admin')
    expect(res.ticket.admin_note).toBe('Called them')
    expect(res.ticket.resolved_at).toBeTruthy()
  })

  it('refuses to resolve an already-resolved ticket with 409', async () => {
    const created = await createSupportTicket(ticketBody('twice'))
    const first = await resolveSupportTicket({ ticketId: created.ticket.id }, actor)
    expect(first.ok).toBe(true)
    // This is the two-admins-at-once case: the loser must be told, not silently
    // overwrite the winner's stamp.
    const second = await resolveSupportTicket({ ticketId: created.ticket.id }, actor)
    expect(second.ok).toBe(false)
    expect(second.status).toBe(409)
    expect(second.error).toMatch(/already resolved/i)
  })

  it('reopens a resolved ticket and clears the resolution stamp', async () => {
    const created = await createSupportTicket(ticketBody('reopen'))
    await resolveSupportTicket({ ticketId: created.ticket.id }, actor)
    const res = await resolveSupportTicket({ ticketId: created.ticket.id, resolved: false }, actor)
    expect(res.ok).toBe(true)
    expect(res.ticket.status).toBe('open')
    expect(res.ticket.resolved_at).toBeNull()
    expect(res.ticket.resolved_by).toBeNull()
  })

  it('returns 404 for an unknown ticket and 400 for a non-uuid id', async () => {
    const missing = await resolveSupportTicket(
      { ticketId: '11111111-2222-4333-8444-555555555555' },
      actor,
    )
    expect(missing.status).toBe(404)
    const malformed = await resolveSupportTicket({ ticketId: 'nope' }, actor)
    expect(malformed.status).toBe(400)
  })
})

describe('listSupportTickets (real DB)', () => {
  it('filters by status and reports the open count', async () => {
    const open = await createSupportTicket(ticketBody('list_open'))
    const done = await createSupportTicket(ticketBody('list_done'))
    await resolveSupportTicket({ ticketId: done.ticket.id }, actor)

    const openList = await listSupportTickets({ status: 'open' })
    expect(openList.tickets.some((t) => t.id === open.ticket.id)).toBe(true)
    expect(openList.tickets.some((t) => t.id === done.ticket.id)).toBe(false)
    expect(openList.openCount).toBeGreaterThan(0)

    const resolvedList = await listSupportTickets({ status: 'resolved' })
    expect(resolvedList.tickets.some((t) => t.id === done.ticket.id)).toBe(true)

    const all = await listSupportTickets({})
    const ids = all.tickets.map((t) => t.id)
    expect(ids).toContain(open.ticket.id)
    expect(ids).toContain(done.ticket.id)
    // Open tickets sort ahead of resolved ones regardless of when they arrived.
    expect(ids.indexOf(open.ticket.id)).toBeLessThan(ids.indexOf(done.ticket.id))
    // Two inserts, a resolve and three list queries — well past the 5s default
    // when the suite runs its files in parallel against a remote Neon branch.
  }, 30000)
})
