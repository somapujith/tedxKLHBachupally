import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { adminFetch, getToken } from './api'
import {
  Alert,
  Card,
  CheckCircleIcon,
  EmptyState,
  fmtDateTime,
  Input,
  Label,
  RefreshBar,
  SearchIcon,
} from './ui'

// Live gate roster for a plain admin — this and the scanner are the only two
// screens that role gets (see AdminShell). Polls faster than the 30s
// Dashboard/Registrations cadence: several admins can be scanning at once at
// different gates, and this is how each of them sees the others' scans land.
const POLL_MS = 8000

function matches(row, q) {
  if (!q) return true
  const hay =
    `${row.full_name ?? ''} ${row.email ?? ''} ${row.phone ?? ''} ${row.college ?? ''} ${row.checked_in_by ?? ''}`.toLowerCase()
  return hay.includes(q)
}

// "2m ago" for anything recent — the number an admin actually watches at the
// gate — falling back to a plain date once it's no longer meaningfully "just
// now". fmtDateTime alongside it keeps the exact time one glance away.
function fmtRelative(value) {
  if (!value) return '—'
  const d = new Date(value)
  if (Number.isNaN(d.getTime())) return '—'
  const seconds = Math.max(0, Math.floor((Date.now() - d.getTime()) / 1000))
  if (seconds < 45) return 'Just now'
  const minutes = Math.floor(seconds / 60)
  if (minutes < 60) return `${minutes}m ago`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours}h ${minutes % 60}m ago`
  return fmtDateTime(value)
}

export default function AdminCheckedIn() {
  const navigate = useNavigate()
  const [rows, setRows] = useState([])
  const [stats, setStats] = useState(null)
  const [search, setSearch] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)
  const [refreshedAt, setRefreshedAt] = useState(null)

  // Monotonic request id — the poll, a manual refresh and the initial load can
  // all be in flight together; without this a slow earlier response landing
  // last could paint a stale roster over a newer one.
  const seq = useRef(0)

  const load = useCallback(async () => {
    const ticket = ++seq.current
    setLoading(true)
    const [regRes, statsRes] = await Promise.all([
      adminFetch('/api/admin/registrations?status=checked_in'),
      adminFetch('/api/admin/stats'),
    ])
    if (ticket !== seq.current) return // a newer request already answered
    if (regRes.ok) setRows(regRes.data.registrations ?? [])
    if (statsRes.ok) setStats(statsRes.data.stats)
    setError(regRes.ok ? '' : regRes.data.error || 'Could not load check-ins.')
    setRefreshedAt(new Date())
    setLoading(false)
  }, [])

  useEffect(() => {
    if (!getToken()) {
      navigate('/admin/login', { replace: true })
      return
    }
    load()
  }, [navigate, load])

  useEffect(() => {
    const id = setInterval(() => {
      if (!document.hidden && getToken()) load()
    }, POLL_MS)
    return () => clearInterval(id)
  }, [load])

  const q = search.trim().toLowerCase()
  // Server orders check-ins by registration time, not scan time — re-sort so
  // the newest arrival is always first, which is the only order that matters
  // for "who just walked in" at a live gate.
  const sorted = useMemo(
    () =>
      rows
        .filter((r) => matches(r, q))
        .slice()
        .sort((a, b) => new Date(b.checked_in_at) - new Date(a.checked_in_at)),
    [rows, q],
  )

  const checkedIn = stats?.checkedIn ?? null
  const paid = stats?.paid ?? null
  const progress = checkedIn != null && paid ? Math.min(100, Math.round((checkedIn / paid) * 100)) : null

  return (
    <section className="space-y-4">
      {error && <Alert>{error}</Alert>}

      <Card pad="none" className="p-4 md:p-5">
        <div className="flex items-start justify-between gap-3">
          <Label className="pt-0.5">Checked in</Label>
          <span
            aria-hidden
            className="flex h-7 w-7 flex-none items-center justify-center rounded-lg border border-red/25 bg-red/10 text-red"
          >
            <CheckCircleIcon className="h-4 w-4" />
          </span>
        </div>
        <div className="mt-3 text-[36px] font-semibold leading-none tracking-tight tabular-nums md:text-[42px]">
          {checkedIn ?? (
            <span className="inline-block h-9 w-24 animate-pulse rounded-md bg-white/10 align-middle motion-reduce:animate-none" />
          )}
        </div>
        <div className="mt-3 h-1.5">
          {progress != null && (
            <div className="h-1.5 w-full overflow-hidden rounded-full bg-white/[0.08]">
              <div
                className="h-full rounded-full bg-gradient-to-r from-red/70 to-red transition-[width] duration-700 ease-out motion-reduce:transition-none"
                style={{ width: `${progress}%` }}
              />
            </div>
          )}
        </div>
        <div className="mt-2 flex items-baseline gap-1.5 text-xs text-paper/40">
          {progress != null && <span className="font-medium tabular-nums text-paper/60">{progress}%</span>}
          {paid != null && <span>of {paid} paid passes</span>}
        </div>
      </Card>

      <RefreshBar left={`Live · updates every ${POLL_MS / 1000}s`} refreshedAt={refreshedAt} loading={loading} onRefresh={load} />

      <div className="relative">
        <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-paper/35">
          <SearchIcon />
        </span>
        <Input
          type="search"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search name, email, phone, college or gate"
          aria-label="Search checked-in attendees"
          className="pl-9"
        />
      </div>

      {sorted.length === 0 ? (
        <Card pad="none">
          <EmptyState
            icon={<CheckCircleIcon className="h-5 w-5" />}
            hint={
              rows.length === 0
                ? 'Scanned passes will show up here the moment they check in.'
                : 'No check-in matches that search.'
            }
          >
            {rows.length === 0 ? 'No one checked in yet' : 'Nothing found'}
          </EmptyState>
        </Card>
      ) : (
        <ul className="space-y-2.5">
          {sorted.map((row) => (
            <li key={row.id}>
              <CheckedInCard row={row} />
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}

function CheckedInCard({ row }) {
  return (
    <Card pad="sm">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="truncate text-[15px] font-medium tracking-tight">{row.full_name ?? '—'}</div>
          <div className="mt-0.5 truncate text-xs capitalize text-paper/45">
            {row.designation ?? '—'}
            {row.college ? ` · ${row.college}` : ''}
          </div>
        </div>
        <span className="flex-none rounded-lg border border-emerald-400/25 bg-emerald-400/10 px-2 py-1 text-xs font-medium tabular-nums text-emerald-300">
          {fmtRelative(row.checked_in_at)}
        </span>
      </div>
      <div className="mt-2.5 flex flex-wrap items-center gap-x-3 gap-y-1 border-t border-white/10 pt-2.5 text-xs text-paper/40">
        <span>{fmtDateTime(row.checked_in_at)}</span>
        <span className="text-paper/25">·</span>
        <span>Gate: {row.checked_in_by || '—'}</span>
      </div>
    </Card>
  )
}
