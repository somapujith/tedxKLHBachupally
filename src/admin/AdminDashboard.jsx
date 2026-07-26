import { useCallback, useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Eyebrow } from '../components/ui'
import { adminFetch, getAdminName, getToken, logout } from './api'

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

function fmtRupees(paise) {
  const n = Number(paise)
  if (!Number.isFinite(n)) return '—'
  return `₹${(n / 100).toLocaleString('en-IN')}`
}

// Server already returns rows newest-first (ORDER BY created_at DESC). Trust it —
// ids are UUIDs, so client-side sorting/reversing would only corrupt the order.
function recentFirst(rows) {
  return rows
}

export default function AdminDashboard() {
  const navigate = useNavigate()
  const [stats, setStats] = useState(null)
  const [rows, setRows] = useState([])
  const [filter, setFilter] = useState('all')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)
  const [refreshedAt, setRefreshedAt] = useState(null)

  const load = useCallback(async (status) => {
    const query = status && status !== 'all' ? `?status=${status}` : ''
    const [statsRes, regsRes] = await Promise.all([
      adminFetch('/api/admin/stats'),
      adminFetch(`/api/admin/registrations${query}`),
    ])
    if (statsRes.ok) setStats(statsRes.data.stats)
    if (regsRes.ok) setRows(recentFirst(regsRes.data.registrations ?? []))
    const failed = [statsRes, regsRes].find((r) => !r.ok)
    setError(failed ? failed.data.error || 'Could not load admin data.' : '')
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

  function onLogout() {
    logout()
    navigate('/admin/login', { replace: true })
  }

  return (
    <div className="min-h-screen bg-ink text-paper">
      <AdminHeader onLogout={onLogout} />
      <main className="mx-auto max-w-6xl px-6 py-10 space-y-12">
        {error && (
          <p role="alert" className="border-l-2 border-red bg-red/5 px-4 py-3 text-sm text-red">
            {error}
          </p>
        )}

        <StatCards stats={stats} />

        <div className="grid gap-8 md:grid-cols-2">
          <Breakdown title="By designation" items={stats?.byDesignation} nameKey="designation" />
          <Breakdown title="By college" items={stats?.byCollege} nameKey="college" />
        </div>

        <RegistrationsTable
          rows={rows}
          filter={filter}
          onFilter={setFilter}
          loading={loading}
          refreshedAt={refreshedAt}
          onRefresh={() => load(filter)}
        />
      </main>
    </div>
  )
}

function AdminHeader({ onLogout }) {
  return (
    <header className="sticky top-0 z-40 border-b border-paper/15 bg-ink/90 backdrop-blur-md">
      <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-4 px-6 py-4">
        <div>
          <Eyebrow>TEDxKLH Bachupally · Admin</Eyebrow>
          <div className="mt-1 font-display text-xl tracking-tight">Dashboard</div>
        </div>
        <div className="flex items-center gap-5">
          <span className="hidden sm:inline font-mono text-[11px] uppercase tracking-[0.2em] text-paper/55">
            {getAdminName()}
          </span>
          <Link
            to="/admin/scan"
            className="border border-red px-4 py-2 font-mono text-[11px] uppercase tracking-[0.2em] text-red transition-colors hover:bg-red hover:text-ink"
          >
            Gate scanner
          </Link>
          <button
            type="button"
            onClick={onLogout}
            className="font-mono text-[11px] uppercase tracking-[0.2em] text-paper/55 transition-colors hover:text-red"
          >
            Logout
          </button>
        </div>
      </div>
    </header>
  )
}

function StatCards({ stats }) {
  const cards = [
    { label: 'Paid seats', value: stats ? `${stats.paid ?? 0} / ${stats.capacity ?? '—'}` : '—' },
    { label: 'Checked in', value: stats ? stats.checkedIn ?? 0 : '—' },
    { label: 'Pending', value: stats ? stats.pending ?? 0 : '—' },
    { label: 'Revenue', value: stats ? fmtRupees(stats.revenue) : '—' },
  ]
  return (
    <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
      {cards.map((c) => (
        <div key={c.label} className="relative border border-paper/15 bg-paper/[0.02] p-5">
          <span aria-hidden className="absolute left-0 top-0 h-px w-5 bg-red" />
          <div className="font-mono text-[10px] uppercase tracking-[0.2em] text-paper/45">{c.label}</div>
          <div className="mt-2 font-display text-3xl tabular-nums tracking-tight">{c.value}</div>
        </div>
      ))}
    </div>
  )
}

function Breakdown({ title, items, nameKey }) {
  const list = Array.isArray(items) ? items : []
  const max = Math.max(1, ...list.map((i) => Number(i.count) || 0))
  return (
    <div className="border border-paper/15 bg-paper/[0.02] p-5">
      <div className="mb-4 font-mono text-[10px] uppercase tracking-[0.2em] text-paper/45">{title}</div>
      {list.length === 0 && <p className="text-sm text-paper/40">No data yet.</p>}
      <ul className="space-y-3">
        {list.map((item) => {
          const count = Number(item.count) || 0
          return (
            <li key={item[nameKey] ?? '—'}>
              <div className="mb-1 flex items-baseline justify-between gap-4 text-sm">
                <span className="truncate text-paper/80">{item[nameKey] ?? '—'}</span>
                <span className="font-mono text-xs tabular-nums text-paper/55">{count}</span>
              </div>
              <div className="h-1 w-full bg-paper/10">
                <div className="h-1 bg-red" style={{ width: `${(count / max) * 100}%` }} />
              </div>
            </li>
          )
        })}
      </ul>
    </div>
  )
}

function RegistrationsTable({ rows, filter, onFilter, loading, refreshedAt, onRefresh }) {
  return (
    <section>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-4">
        <div className="flex flex-wrap gap-2">
          {FILTERS.map((f) => (
            <button
              key={f.key}
              type="button"
              onClick={() => onFilter(f.key)}
              aria-pressed={filter === f.key}
              className={[
                'border px-4 py-2 font-mono text-[11px] uppercase tracking-[0.18em] transition-colors',
                filter === f.key
                  ? 'border-red bg-red text-paper'
                  : 'border-paper/20 text-paper/60 hover:border-paper/50 hover:text-paper',
              ].join(' ')}
            >
              {f.label}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-4">
          {refreshedAt && (
            <span className="font-mono text-[10px] uppercase tracking-[0.15em] text-paper/35">
              Updated {refreshedAt.toLocaleTimeString('en-IN')}
            </span>
          )}
          <button
            type="button"
            onClick={onRefresh}
            className="border border-paper/25 px-4 py-2 font-mono text-[11px] uppercase tracking-[0.18em] text-paper/70 transition-colors hover:border-red hover:text-red"
          >
            Refresh
          </button>
        </div>
      </div>

      <div className="overflow-x-auto border border-paper/15">
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
            {rows.length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-10 text-center text-paper/40">
                  {loading ? 'Loading…' : 'No registrations found.'}
                </td>
              </tr>
            )}
            {rows.map((row) => (
              <RegistrationRow key={row.id ?? row.email} row={row} />
            ))}
          </tbody>
        </table>
      </div>
    </section>
  )
}

function RegistrationRow({ row }) {
  const [note, setNote] = useState('')
  const [sending, setSending] = useState(false)
  const status = row.payment_status ?? 'pending'
  const badge = STATUS_STYLES[status] ?? 'text-paper/60 border-paper/25'
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

  return (
    <tr className="border-b border-paper/10 last:border-0 align-top">
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
        <span className={`inline-block border px-2 py-1 font-mono text-[10px] uppercase tracking-[0.15em] ${badge}`}>
          {status.replace('_', ' ')}
        </span>
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
