import { useCallback, useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { adminFetch, getToken } from './api'
import { Alert, Button, Card, EmptyState, Input, RefreshBar, SearchIcon, StatusBadge } from './ui'

const FILTERS = [
  { key: 'all', label: 'All' },
  { key: 'paid', label: 'Paid' },
  { key: 'pending', label: 'Pending' },
  { key: 'checked_in', label: 'Checked in' },
]

function fmtDateTime(value) {
  if (!value) return '—'
  const d = new Date(value)
  return Number.isNaN(d.getTime())
    ? String(value)
    : d.toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'Asia/Kolkata' })
}

// Case-insensitive match across the fields an organiser would search by.
function matches(row, q) {
  if (!q) return true
  const hay = `${row.full_name ?? ''} ${row.email ?? ''} ${row.phone ?? ''} ${row.college ?? ''}`.toLowerCase()
  return hay.includes(q)
}

export default function AdminRegistrations() {
  const navigate = useNavigate()
  const [rows, setRows] = useState([])
  const [filter, setFilter] = useState('all')
  const [search, setSearch] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)
  const [refreshedAt, setRefreshedAt] = useState(null)

  const load = useCallback(async (status) => {
    setLoading(true)
    const query = status && status !== 'all' ? `?status=${status}` : ''
    const res = await adminFetch(`/api/admin/registrations${query}`)
    // Server returns newest-first (ORDER BY created_at DESC); trust that order.
    if (res.ok) setRows(res.data.registrations ?? [])
    setError(res.ok ? '' : res.data.error || 'Could not load registrations.')
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

  // Auto-refresh every 30s while the tab is visible.
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
            placeholder="Search name, email, phone or college"
            aria-label="Search registrations"
            className="pl-9"
          />
        </div>

        {/* Segmented status filter — scrolls horizontally on narrow phones. */}
        <div className="-mx-4 overflow-x-auto px-4 sm:mx-0 sm:overflow-visible sm:px-0">
          <div className="inline-flex items-center gap-1 rounded-lg border border-white/10 bg-white/[0.03] p-1">
            {FILTERS.map((f) => (
              <button
                key={f.key}
                type="button"
                onClick={() => setFilter(f.key)}
                aria-pressed={filter === f.key}
                className={[
                  'whitespace-nowrap rounded-md px-3 py-1.5 text-sm font-medium transition-colors',
                  filter === f.key ? 'bg-white/10 text-paper' : 'text-paper/55 hover:text-paper',
                ].join(' ')}
              >
                {f.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      <RefreshBar
        left={loading ? 'Loading…' : `${visible.length} ${visible.length === 1 ? 'registration' : 'registrations'}`}
        refreshedAt={refreshedAt}
        loading={loading}
        onRefresh={() => load(filter)}
      />

      {/* Mobile: attendee cards. */}
      <div className="space-y-3 md:hidden">
        {visible.length === 0 && !loading && <EmptyState>No registrations found.</EmptyState>}
        {visible.map((row) => (
          <RegistrationCard key={row.id ?? row.email} row={row} />
        ))}
      </div>

      {/* Desktop: dense table. */}
      <Card className="hidden overflow-hidden md:block">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[760px] text-left text-sm">
            <thead>
              <tr className="border-b border-white/10 text-[11px] font-medium uppercase tracking-[0.08em] text-paper/45">
                <th className="px-4 py-3 font-medium">Attendee</th>
                <th className="px-4 py-3 font-medium">Contact</th>
                <th className="px-4 py-3 font-medium">Designation</th>
                <th className="px-4 py-3 font-medium">Status</th>
                <th className="px-4 py-3 font-medium">Checked in</th>
                <th className="px-4 py-3 text-right font-medium">Pass</th>
              </tr>
            </thead>
            <tbody>
              {visible.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-4 py-12 text-center text-paper/40">
                    {loading ? 'Loading…' : 'No registrations found.'}
                  </td>
                </tr>
              )}
              {visible.map((row) => (
                <RegistrationRow key={row.id ?? row.email} row={row} />
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </section>
  )
}

// Shared resend action + derived status for both card and row.
function useResend(row) {
  const [note, setNote] = useState('')
  const [sending, setSending] = useState(false)
  const status = row.payment_status ?? 'pending'
  const isPaid = status === 'paid' || status === 'checked_in'

  async function resend() {
    if (!window.confirm(`Resend the QR pass email to ${row.email ?? 'this attendee'}?`)) return
    setSending(true)
    setNote('')
    const { ok, data } = await adminFetch('/api/admin/resend-ticket', {
      method: 'POST',
      body: JSON.stringify({ registrationId: row.id }),
    })
    setNote(ok ? (data.emailed ? 'Sent' : 'Queued') : data.error || 'Failed')
    setSending(false)
  }

  return { status, isPaid, note, sending, resend }
}

function RegistrationCard({ row }) {
  const [open, setOpen] = useState(false)
  const { status, isPaid, note, sending, resend } = useResend(row)

  return (
    <Card className="p-4">
      <div className="flex items-start justify-between gap-3">
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          aria-expanded={open}
          className="min-w-0 flex-1 rounded-lg text-left"
        >
          <div className="truncate text-[15px] font-medium tracking-tight">{row.full_name ?? '—'}</div>
          <div className="mt-0.5 truncate text-xs text-paper/45">{row.college ?? '—'}</div>
        </button>
        <StatusBadge status={status} />
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm">
        {row.phone && (
          <a href={`tel:${row.phone}`} className="text-red underline-offset-4 hover:underline">
            {row.phone}
          </a>
        )}
        <span className="truncate text-paper/55">{row.email ?? '—'}</span>
      </div>

      {open && (
        <dl className="mt-3 space-y-1.5 border-t border-white/10 pt-3 text-xs text-paper/60">
          <Detail term="Designation" value={row.designation ?? '—'} capitalize />
          {row.paid_at && <Detail term="Paid" value={fmtDateTime(row.paid_at)} />}
          <Detail
            term="Checked in"
            value={row.checked_in_at ? `${fmtDateTime(row.checked_in_at)} · by ${row.checked_in_by ?? '—'}` : '—'}
          />
        </dl>
      )}

      {isPaid && (
        <div className="mt-3 flex items-center gap-3">
          <Button size="sm" onClick={resend} disabled={sending}>
            {sending ? 'Sending…' : 'Resend pass'}
          </Button>
          {note && <span className="text-xs text-paper/50">{note}</span>}
        </div>
      )}
    </Card>
  )
}

function Detail({ term, value, capitalize = false }) {
  return (
    <div className="flex gap-2">
      <dt className="flex-none text-paper/40">{term}</dt>
      <dd className={capitalize ? 'capitalize' : undefined}>{value}</dd>
    </div>
  )
}

function RegistrationRow({ row }) {
  const { status, isPaid, note, sending, resend } = useResend(row)
  return (
    <tr className="border-b border-white/[0.06] align-top transition-colors last:border-0 hover:bg-white/[0.02]">
      <td className="px-4 py-3">
        <div className="font-medium text-paper/90">{row.full_name ?? '—'}</div>
        <div className="mt-0.5 text-xs text-paper/45">{row.college ?? '—'}</div>
      </td>
      <td className="px-4 py-3">
        <div className="text-paper/75">{row.email ?? '—'}</div>
        <div className="mt-0.5 text-xs text-paper/45">{row.phone ?? '—'}</div>
      </td>
      <td className="px-4 py-3 capitalize text-paper/75">{row.designation ?? '—'}</td>
      <td className="px-4 py-3">
        <StatusBadge status={status} />
        {row.paid_at && <div className="mt-1.5 text-xs text-paper/40">{fmtDateTime(row.paid_at)}</div>}
      </td>
      <td className="px-4 py-3 text-xs text-paper/60">
        {row.checked_in_at ? (
          <>
            <div>{fmtDateTime(row.checked_in_at)}</div>
            <div className="mt-0.5 text-paper/40">by {row.checked_in_by ?? '—'}</div>
          </>
        ) : (
          '—'
        )}
      </td>
      <td className="px-4 py-3 text-right">
        {isPaid && (
          <Button size="sm" onClick={resend} disabled={sending}>
            {sending ? 'Sending…' : 'Resend'}
          </Button>
        )}
        {note && <div className="mt-1 text-xs text-paper/50">{note}</div>}
      </td>
    </tr>
  )
}
