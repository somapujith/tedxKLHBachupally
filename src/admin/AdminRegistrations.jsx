import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { adminFetch, getToken, isSuperAdmin } from './api'
import {
  Alert,
  Button,
  Card,
  EmptyState,
  fmtDateTime,
  Input,
  RefreshBar,
  SearchIcon,
  SegmentedControl,
  StatusBadge,
} from './ui'

// Lifecycle order: pending (not yet paid) -> submitted (paid, awaiting admin
// verification) -> paid (verified, pass issued) -> checked_in (pass scanned).
// Labels follow that meaning, not the raw DB column name — 'submitted' reads
// as "Paid" here and 'paid' reads as "Verified", per the superadmin's terms.
const FILTERS = [
  { key: 'all', label: 'All' },
  { key: 'pending', label: 'Pending' },
  { key: 'submitted', label: 'Paid' },
  { key: 'paid', label: 'Verified' },
  { key: 'checked_in', label: 'Checked in' },
]

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

  // Monotonic request id. The 30s auto-refresh, a filter click and the reload
  // fired after a revoke can all be in flight at once; without this, a slow
  // earlier response landing last would restore a pre-revoke snapshot (Revoke
  // button reappearing on an already-revoked pass) or paint one filter's rows
  // under another's tab.
  const seq = useRef(0)

  const load = useCallback(async (status) => {
    const ticket = ++seq.current
    setLoading(true)
    const query = status && status !== 'all' ? `?status=${status}` : ''
    const res = await adminFetch(`/api/admin/registrations${query}`)
    if (ticket !== seq.current) return // a newer request already answered
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
          <SegmentedControl options={FILTERS} value={filter} onChange={setFilter} ariaLabel="Filter by status" />
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
        {visible.length === 0 && !loading && (
          <Card>
            <EmptyState
              hint={
                q
                  ? 'Try a different name, email, phone or college.'
                  : 'Registrations appear here as attendees sign up.'
              }
            >
              {q ? 'No match for that search' : 'No registrations yet'}
            </EmptyState>
          </Card>
        )}
        {visible.map((row) => (
          <RegistrationCard key={row.id ?? row.email} row={row} onRevoked={() => load(filter)} />
        ))}
      </div>

      {/* Desktop: dense table. */}
      <Card pad="none" className="hidden overflow-hidden md:block">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[760px] text-left text-sm">
            <thead>
              <tr className="border-b border-white/10 bg-white/[0.02] text-[11px] font-medium uppercase tracking-[0.08em] text-paper/45">
                <th className="px-4 py-3 font-medium">Attendee</th>
                <th className="px-4 py-3 font-medium">Contact</th>
                <th className="px-4 py-3 font-medium">Designation</th>
                <th className="px-4 py-3 font-medium">Registered</th>
                <th className="px-4 py-3 font-medium">Status</th>
                <th className="px-4 py-3 font-medium">Checked in</th>
                <th className="px-4 py-3 text-right font-medium">Pass</th>
              </tr>
            </thead>
            <tbody>
              {visible.length === 0 && (
                <tr>
                  <td colSpan={7} className="p-0">
                    <EmptyState
                      hint={
                        q
                          ? 'Try a different name, email, phone or college.'
                          : 'Registrations appear here as attendees sign up.'
                      }
                    >
                      {loading ? 'Loading registrations…' : q ? 'No match for that search' : 'No registrations yet'}
                    </EmptyState>
                  </td>
                </tr>
              )}
              {visible.map((row) => (
                <RegistrationRow key={row.id ?? row.email} row={row} onRevoked={() => load(filter)} />
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </section>
  )
}

// Shared pass actions + derived status for both card and row. Revoke is
// OFFERED only to a superadmin (the server enforces the role regardless):
// it invalidates every previously emailed QR for the row; a resend afterwards
// issues a fresh one.
function usePassActions(row, onRevoked) {
  const [note, setNote] = useState('')
  const [busy, setBusy] = useState(false)
  const status = row.payment_status ?? 'pending'
  const isPaid = status === 'paid' || status === 'checked_in'
  const canRevoke = isSuperAdmin() && row.ticket_issued === true

  async function resend() {
    if (!window.confirm(`Resend the QR pass email to ${row.email ?? 'this attendee'}?`)) return
    setBusy(true)
    setNote('')
    const { ok, data } = await adminFetch('/api/admin/resend-ticket', {
      method: 'POST',
      body: JSON.stringify({ registrationId: row.id }),
    })
    setNote(ok ? (data.emailed ? 'Sent' : 'Queued') : data.error || 'Failed')
    setBusy(false)
  }

  async function revoke() {
    // The already-checked-in case gets different wording on purpose: a new pass
    // will NOT let that attendee back in (check-in is single-use and the revoke
    // deliberately preserves it), so promising a working replacement would be a
    // lie the gate exposes.
    const warning = row.checked_in_at
      ? 'This attendee has already been checked in. Revoking does not undo that, and a re-issued pass will not scan again.'
      : 'Their emailed QR will stop working immediately. Only a superadmin can then issue a new one, with "Resend".'
    if (!window.confirm(`Revoke the QR pass for ${row.email ?? 'this attendee'}?\n\n${warning}`))
      return
    setBusy(true)
    setNote('')
    const { ok, data } = await adminFetch('/api/admin/revoke-ticket', {
      method: 'POST',
      body: JSON.stringify({ registrationId: row.id }),
    })
    setNote(ok ? 'QR revoked' : data.error || 'Failed')
    setBusy(false)
    if (ok) onRevoked?.()
  }

  return { status, isPaid, canRevoke, note, busy, resend, revoke }
}

function RegistrationCard({ row, onRevoked }) {
  const [open, setOpen] = useState(false)
  const { status, isPaid, canRevoke, note, busy, resend, revoke } = usePassActions(row, onRevoked)

  return (
    <Card pad="sm">
      <div className="flex items-start justify-between gap-3">
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          aria-expanded={open}
          className="group -m-1 min-w-0 flex-1 rounded-lg p-1 text-left transition-colors hover:bg-white/[0.03] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red/60"
        >
          <div className="flex items-center gap-1.5">
            <span className="truncate text-[15px] font-medium tracking-tight">{row.full_name ?? '—'}</span>
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              aria-hidden
              className={`h-3.5 w-3.5 flex-none text-paper/35 transition-transform duration-200 motion-reduce:transition-none ${open ? 'rotate-180' : ''}`}
            >
              <path d="m6 9 6 6 6-6" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </div>
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
          <Detail term="Registered" value={row.created_at ? fmtDateTime(row.created_at) : '—'} />
          {row.paid_at && <Detail term="Paid" value={fmtDateTime(row.paid_at)} />}
          <Detail
            term="Checked in"
            value={row.checked_in_at ? `${fmtDateTime(row.checked_in_at)} · by ${row.checked_in_by ?? '—'}` : '—'}
          />
        </dl>
      )}

      {isPaid && (
        <div className="mt-3 flex flex-wrap items-center gap-3">
          <Button size="sm" onClick={resend} disabled={busy}>
            {busy ? 'Working…' : 'Resend pass'}
          </Button>
          {canRevoke && (
            <Button size="sm" variant="danger" onClick={revoke} disabled={busy}>
              Revoke QR
            </Button>
          )}
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

function RegistrationRow({ row, onRevoked }) {
  const { status, isPaid, canRevoke, note, busy, resend, revoke } = usePassActions(row, onRevoked)
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
      <td className="px-4 py-3 text-xs text-paper/60">
        {row.created_at ? fmtDateTime(row.created_at) : '—'}
      </td>
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
          <div className="inline-flex items-center gap-2">
            <Button size="sm" onClick={resend} disabled={busy}>
              {busy ? 'Working…' : 'Resend'}
            </Button>
            {canRevoke && (
              <Button size="sm" variant="danger" onClick={revoke} disabled={busy}>
                Revoke
              </Button>
            )}
          </div>
        )}
        {note && <div className="mt-1 text-xs text-paper/50">{note}</div>}
      </td>
    </tr>
  )
}
