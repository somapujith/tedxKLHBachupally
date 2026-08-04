import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { adminFetch, getToken } from './api'
import {
  Alert,
  Button,
  Card,
  CheckCircleIcon,
  EmptyState,
  Input,
  RefreshBar,
  SearchIcon,
  SegmentedControl,
} from './ui'

// Support tickets raised by attendees from the registration confirmation screen.
// The queue is worked by phone/email outside the app — this screen exists to
// show who is waiting, what they said, and to mark a ticket done so two admins
// do not call the same person twice.

const FILTERS = [
  { key: 'open', label: 'Open' },
  { key: 'resolved', label: 'Resolved' },
  { key: 'all', label: 'All' },
]

function fmtDateTime(value) {
  if (!value) return '—'
  const d = new Date(value)
  return Number.isNaN(d.getTime())
    ? String(value)
    : d.toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'Asia/Kolkata' })
}

function matches(row, q) {
  if (!q) return true
  const hay = `${row.full_name ?? ''} ${row.email ?? ''} ${row.phone ?? ''} ${row.subject ?? ''} ${row.message ?? ''}`.toLowerCase()
  return hay.includes(q)
}

export default function AdminSupport() {
  const navigate = useNavigate()
  const [rows, setRows] = useState([])
  const [openCount, setOpenCount] = useState(0)
  const [filter, setFilter] = useState('open')
  const [search, setSearch] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)
  const [refreshedAt, setRefreshedAt] = useState(null)

  // Monotonic request id — same reason as AdminRegistrations: the 30s
  // auto-refresh, a filter click and the reload after a resolve can all be in
  // flight together, and a slow earlier response landing last would repaint a
  // stale snapshot (a just-resolved ticket reappearing as open).
  const seq = useRef(0)

  const load = useCallback(async (status) => {
    const ticket = ++seq.current
    setLoading(true)
    const query = status && status !== 'all' ? `?status=${status}` : ''
    const res = await adminFetch(`/api/admin/support${query}`)
    if (ticket !== seq.current) return
    if (res.ok) {
      setRows(res.data.tickets ?? [])
      setOpenCount(res.data.openCount ?? 0)
    }
    setError(res.ok ? '' : res.data.error || 'Could not load support tickets.')
    setRefreshedAt(new Date())
    setLoading(false)
  }, [])

  useEffect(() => {
    if (!getToken()) {
      navigate('/admin/login', { replace: true })
      return
    }
    load(filter)
  }, [navigate, load, filter])

  useEffect(() => {
    const id = setInterval(() => {
      if (!document.hidden && getToken()) load(filter)
    }, 30000)
    return () => clearInterval(id)
  }, [load, filter])

  const q = search.trim().toLowerCase()
  const visible = useMemo(() => rows.filter((r) => matches(r, q)), [rows, q])

  return (
    <section className="space-y-4">
      {error && <Alert>{error}</Alert>}

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-paper/35">
            <SearchIcon />
          </span>
          <Input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search name, email, phone or message"
            aria-label="Search support tickets"
            className="pl-9"
          />
        </div>

        <div className="-mx-4 overflow-x-auto px-4 sm:mx-0 sm:overflow-visible sm:px-0">
          <SegmentedControl
            // The open-count badge rides on the "Open" tab only.
            options={FILTERS.map((f) => (f.key === 'open' ? { ...f, count: openCount } : f))}
            value={filter}
            onChange={setFilter}
            ariaLabel="Filter tickets by status"
          />
        </div>
      </div>

      <RefreshBar
        left={loading ? 'Loading…' : `${visible.length} ${visible.length === 1 ? 'ticket' : 'tickets'}`}
        refreshedAt={refreshedAt}
        loading={loading}
        onRefresh={() => load(filter)}
      />

      <div className="space-y-3">
        {visible.length === 0 && !loading && (
          <Card>
            <EmptyState
              tone={filter === 'open' ? 'good' : 'neutral'}
              icon={filter === 'open' ? <CheckCircleIcon /> : undefined}
              hint={
                filter === 'open'
                  ? 'Tickets raised from the confirmation screen land here.'
                  : 'Try a different search or filter.'
              }
            >
              {filter === 'open' ? 'Inbox zero — nobody is waiting' : 'No tickets found'}
            </EmptyState>
          </Card>
        )}
        {visible.map((row) => (
          <TicketCard key={row.id} row={row} onChanged={() => load(filter)} />
        ))}
      </div>
    </section>
  )
}

function TicketCard({ row, onChanged }) {
  const [busy, setBusy] = useState(false)
  const [note, setNote] = useState('')
  const [feedback, setFeedback] = useState('')
  const isOpen = row.status === 'open'

  async function setResolved(resolved) {
    setBusy(true)
    setFeedback('')
    const { ok, data } = await adminFetch('/api/admin/support', {
      method: 'POST',
      body: JSON.stringify({ ticketId: row.id, resolved, note: note.trim() || undefined }),
    })
    setBusy(false)
    if (!ok) {
      setFeedback(data.error || 'Could not update the ticket.')
      return
    }
    setNote('')
    onChanged()
  }

  return (
    // Open tickets carry a red left edge: the one place red earns its keep here,
    // because "someone is still waiting" is the only urgent state on this screen.
    <Card pad="sm" className={isOpen ? 'border-l-2 border-l-red/70' : undefined}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-medium text-paper">
              {row.full_name || row.registration_name || 'Attendee'}
            </span>
            <span
              className={[
                'inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-medium',
                isOpen
                  ? 'border-red/40 bg-red/10 text-red'
                  : 'border-emerald-400/30 bg-emerald-400/10 text-emerald-300',
              ].join(' ')}
            >
              <span
                aria-hidden
                className={`h-1.5 w-1.5 rounded-full ${isOpen ? 'bg-red' : 'bg-emerald-400'}`}
              />
              {isOpen ? 'open' : 'resolved'}
            </span>
            {row.subject && (
              <span className="rounded-md bg-white/[0.06] px-2 py-0.5 text-xs text-paper/55">{row.subject}</span>
            )}
          </div>

          {/* Contact details are the point of the screen — plain tel:/mailto:
              links so an admin on a phone can act in one tap. */}
          <div className="mt-1.5 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-paper/60">
            <a href={`tel:${row.phone}`} className="tabular-nums hover:text-paper">
              {row.phone}
            </a>
            <a href={`mailto:${row.email}`} className="hover:text-paper">
              {row.email}
            </a>
          </div>
        </div>

        <span className="whitespace-nowrap text-xs tabular-nums text-paper/35">
          {fmtDateTime(row.created_at)}
        </span>
      </div>

      <p className="mt-3 whitespace-pre-wrap break-words rounded-lg border border-white/[0.07] bg-black/20 p-3 text-sm leading-relaxed text-paper/75">
        {row.message}
      </p>

      {/* Registration context, when the ticket was raised from a real one. A
          missing payment_status means the row is gone or the ticket came from
          an unlinked session; either way the contact details above still work. */}
      <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs text-paper/40">
        {row.payment_status && <span>Registration: {row.payment_status.replace('_', ' ')}</span>}
        {!row.registration_id && <span>No linked registration</span>}
        {row.resolved_at && (
          <span>
            Resolved {fmtDateTime(row.resolved_at)}
            {row.resolved_by ? ` by ${row.resolved_by}` : ''}
          </span>
        )}
      </div>

      {row.admin_note && (
        <p className="mt-2 border-l-2 border-white/15 pl-3 text-xs text-paper/50">
          Note: {row.admin_note}
        </p>
      )}

      {feedback && (
        <p role="alert" className="mt-3 text-xs text-red">
          {feedback}
        </p>
      )}

      <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:items-center">
        <Input
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder={isOpen ? 'What did you do? (optional)' : 'Add a note (optional)'}
          aria-label="Admin note"
          disabled={busy}
          className="flex-1"
        />
        <Button
          size="sm"
          variant={isOpen ? 'primary' : 'subtle'}
          onClick={() => setResolved(isOpen)}
          disabled={busy}
        >
          {busy ? 'Saving…' : isOpen ? 'Mark resolved' : 'Reopen'}
        </Button>
      </div>
    </Card>
  )
}
