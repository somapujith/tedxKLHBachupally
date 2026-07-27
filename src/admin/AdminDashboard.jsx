import { useCallback, useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { adminFetch, getToken } from './api'

function fmtRupees(paise) {
  const n = Number(paise)
  if (!Number.isFinite(n)) return '—'
  return `₹${(n / 100).toLocaleString('en-IN')}`
}

// Stats + breakdowns only. The registrations list lives on its own screen
// (AdminRegistrations); the shared chrome (top bar, bottom nav) is provided by
// AdminShell, so this screen renders just its content into the shell's <Outlet/>.
export default function AdminDashboard() {
  const navigate = useNavigate()
  const [stats, setStats] = useState(null)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)
  const [refreshedAt, setRefreshedAt] = useState(null)

  const load = useCallback(async () => {
    const res = await adminFetch('/api/admin/stats')
    if (res.ok) setStats(res.data.stats)
    setError(res.ok ? '' : res.data.error || 'Could not load stats.')
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

  // Auto-refresh every 30s while the tab is visible.
  useEffect(() => {
    const id = setInterval(() => {
      if (!document.hidden && getToken()) load()
    }, 30000)
    return () => clearInterval(id)
  }, [load])

  return (
    <div className="space-y-8 md:space-y-12">
      {error && (
        <p role="alert" className="border-l-2 border-red bg-red/5 px-4 py-3 text-sm text-red">
          {error}
        </p>
      )}

      <StatCards stats={stats} />

      <div className="grid gap-6 md:grid-cols-2 md:gap-8">
        <Breakdown title="By designation" items={stats?.byDesignation} nameKey="designation" />
        <Breakdown title="By college" items={stats?.byCollege} nameKey="college" />
      </div>

      <div className="flex items-center justify-between">
        <Link
          to="/admin/registrations"
          className="border border-paper/25 px-4 py-2 font-mono text-[11px] uppercase tracking-[0.18em] text-paper/70 transition-colors hover:border-red hover:text-red"
        >
          View registrations →
        </Link>
        <div className="flex items-center gap-3">
          {refreshedAt && (
            <span className="font-mono text-[10px] uppercase tracking-[0.15em] text-paper/30">
              {refreshedAt.toLocaleTimeString('en-IN')}
            </span>
          )}
          <button
            type="button"
            onClick={load}
            className="border border-paper/25 px-3 py-1.5 font-mono text-[10px] uppercase tracking-[0.18em] text-paper/70 transition-colors hover:border-red hover:text-red"
          >
            {loading ? 'Loading…' : 'Refresh'}
          </button>
        </div>
      </div>
    </div>
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
    <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
      {cards.map((c) => (
        <div key={c.label} className="relative border border-paper/15 bg-paper/[0.02] p-4 sm:p-5">
          <span aria-hidden className="absolute left-0 top-0 h-px w-5 bg-red" />
          <div className="font-mono text-[10px] uppercase tracking-[0.2em] text-paper/45">{c.label}</div>
          <div className="mt-2 font-display text-2xl tabular-nums tracking-tight sm:text-3xl">{c.value}</div>
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
