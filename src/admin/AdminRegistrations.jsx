import { useCallback, useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { adminFetch, getToken } from './api'

const FILTERS = [
  { key: 'all', label: 'All' },
  { key: 'paid', label: 'Paid' },
  { key: 'pending', label: 'Pending' },
  { key: 'checked_in', label: 'Checked-in' },
]

const STATUS_STYLES = {
  paid: 'text-emerald-400 border-emerald-400/40',
  pending: 'text-amber-400 border-amber-400/40',
  checked_in: 'text-sky-400 border-sky-400/40',
}

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
    <section className="space-y-5">
      {error && (
        <p role="alert" className="border-l-2 border-red bg-red/5 px-4 py-3 text-sm text-red">
          {error}
        </p>
      )}

      <input
        type="search"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        placeholder="Search name, email, phone, college"
        aria-label="Search registrations"
        className="w-full rounded-none border border-paper/25 bg-transparent px-4 py-3 text-sm text-paper placeholder:text-paper/35 focus:border-red focus:outline-none"
      />

      {/* Filter chips — horizontal scroller on narrow phones. */}
      <div className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1">
        {FILTERS.map((f) => (
          <button
            key={f.key}
            type="button"
            onClick={() => setFilter(f.key)}
            aria-pressed={filter === f.key}
            className={[
              'flex-none border px-4 py-2 font-mono text-[11px] uppercase tracking-[0.18em] transition-colors',
              filter === f.key
                ? 'border-red bg-red text-paper'
                : 'border-paper/20 text-paper/60 hover:border-paper/50 hover:text-paper',
            ].join(' ')}
          >
            {f.label}
          </button>
        ))}
      </div>

      <div className="flex items-center justify-between">
        <span className="font-mono text-[10px] uppercase tracking-[0.15em] text-paper/40">
          {loading ? 'Loading…' : `${visible.length} shown`}
        </span>
        <div className="flex items-center gap-3">
          {refreshedAt && (
            <span className="font-mono text-[10px] uppercase tracking-[0.15em] text-paper/30">
              {refreshedAt.toLocaleTimeString('en-IN')}
            </span>
          )}
          <button
            type="button"
            onClick={() => load(filter)}
            className="border border-paper/25 px-3 py-1.5 font-mono text-[10px] uppercase tracking-[0.18em] text-paper/70 transition-colors hover:border-red hover:text-red"
          >
            Refresh
          </button>
        </div>
      </div>

      {/* Mobile: attendee cards. */}
      <div className="space-y-3 md:hidden">
        {visible.length === 0 && !loading && (
          <p className="py-10 text-center text-sm text-paper/40">No registrations found.</p>
        )}
        {visible.map((row) => (
          <RegistrationCard key={row.id ?? row.email} row={row} />
        ))}
      </div>

      {/* Desktop: dense table. */}
      <div className="hidden overflow-x-auto border border-paper/15 md:block">
        <table className="w-full min-w-[720px] text-left text-sm">
          <thead>
            <tr className="border-b border-paper/15 font-mono text-[10px] uppercase tracking-[0.18em] text-paper/45">
              <th className="px-4 py-3 font-medium">Name</th>
              <th className="px-4 py-3 font-medium">Contact</th>
              <th className="px-4 py-3 font-medium">Designation</th>
              <th className="px-4 py-3 font-medium">Status</th>
              <th className="px-4 py-3 font-medium">Checked in</th>
              <th className="px-4 py-3 font-medium" />
            </tr>
          </thead>
          <tbody>
            {visible.length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-10 text-center text-paper/40">
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
    setNote(ok ? (data.emailed ? 'Sent ✓' : 'Queued') : data.error || 'Failed')
    setSending(false)
  }

  return { status, isPaid, note, sending, resend }
}

function StatusBadge({ status }) {
  const badge = STATUS_STYLES[status] ?? 'text-paper/60 border-paper/25'
  return (
    <span className={`inline-block border px-2 py-1 font-mono text-[10px] uppercase tracking-[0.15em] ${badge}`}>
      {status.replace('_', ' ')}
    </span>
  )
}

function RegistrationCard({ row }) {
  const [open, setOpen] = useState(false)
  const { status, isPaid, note, sending, resend } = useResend(row)

  return (
    <article className="border border-paper/15 bg-paper/[0.02] p-4">
      <div className="flex items-start justify-between gap-3">
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          aria-expanded={open}
          className="min-w-0 flex-1 text-left"
        >
          <div className="truncate font-display text-lg tracking-tight text-paper/95">{row.full_name ?? '—'}</div>
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
        <span className="truncate text-paper/60">{row.email ?? '—'}</span>
      </div>

      {open && (
        <div className="mt-3 space-y-1.5 border-t border-paper/10 pt-3 text-xs text-paper/60">
          <div>
            <span className="text-paper/40">Designation: </span>
            <span className="capitalize">{row.designation ?? '—'}</span>
          </div>
          {row.paid_at && (
            <div>
              <span className="text-paper/40">Paid: </span>
              {fmtDateTime(row.paid_at)}
            </div>
          )}
          <div>
            <span className="text-paper/40">Checked in: </span>
            {row.checked_in_at ? `${fmtDateTime(row.checked_in_at)} · by ${row.checked_in_by ?? '—'}` : '—'}
          </div>
        </div>
      )}

      {isPaid && (
        <div className="mt-3 flex items-center gap-3">
          <button
            type="button"
            onClick={resend}
            disabled={sending}
            className="border border-paper/25 px-3 py-2 font-mono text-[10px] uppercase tracking-[0.15em] text-paper/70 transition-colors hover:border-red hover:text-red disabled:opacity-40"
          >
            {sending ? 'Sending…' : 'Resend pass'}
          </button>
          {note && <span className="text-xs text-paper/55">{note}</span>}
        </div>
      )}
    </article>
  )
}

function RegistrationRow({ row }) {
  const { status, isPaid, note, sending, resend } = useResend(row)
  return (
    <tr className="border-b border-paper/10 align-top last:border-0">
      <td className="px-4 py-3">
        <div className="text-paper/90">{row.full_name ?? '—'}</div>
        <div className="mt-0.5 text-xs text-paper/45">{row.college ?? '—'}</div>
      </td>
      <td className="px-4 py-3">
        <div className="text-paper/75">{row.email ?? '—'}</div>
        <div className="mt-0.5 text-xs text-paper/45">{row.phone ?? '—'}</div>
      </td>
      <td className="px-4 py-3 capitalize text-paper/75">{row.designation ?? '—'}</td>
      <td className="px-4 py-3">
        <StatusBadge status={status} />
        <div className="mt-1 text-xs text-paper/40">{row.paid_at ? fmtDateTime(row.paid_at) : ''}</div>
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
          <button
            type="button"
            onClick={resend}
            disabled={sending}
            className="border border-paper/25 px-3 py-1.5 font-mono text-[10px] uppercase tracking-[0.15em] text-paper/70 transition-colors hover:border-red hover:text-red disabled:opacity-40"
          >
            {sending ? 'Sending…' : 'Resend pass'}
          </button>
        )}
        {note && <div className="mt-1 text-xs text-paper/55">{note}</div>}
      </td>
    </tr>
  )
}
