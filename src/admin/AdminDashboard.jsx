import { useCallback, useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { adminFetch, getToken } from './api'
import { Alert, Card, Label, RefreshBar } from './ui'

function fmtRupees(paise) {
  const n = Number(paise)
  if (!Number.isFinite(n)) return '—'
  return `₹${(n / 100).toLocaleString('en-IN')}`
}

function pct(part, whole) {
  const a = Number(part)
  const b = Number(whole)
  if (!Number.isFinite(a) || !Number.isFinite(b) || b <= 0) return null
  return Math.min(100, Math.round((a / b) * 100))
}

// Stats + breakdowns only. The registrations list lives on its own screen
// (AdminRegistrations); the shared chrome (top bar, page title, bottom nav) is
// provided by AdminShell, so this screen renders just its content.
export default function AdminDashboard() {
  const navigate = useNavigate()
  const [stats, setStats] = useState(null)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)
  const [refreshedAt, setRefreshedAt] = useState(null)

  const load = useCallback(async () => {
    setLoading(true)
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

  const filled = pct(stats?.paid, stats?.capacity)

  return (
    <div className="space-y-6">
      {error && <Alert>{error}</Alert>}

      <RefreshBar left="Auto-refreshes every 30 seconds" refreshedAt={refreshedAt} loading={loading} onRefresh={load} />

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat
          label="Paid seats"
          value={stats ? String(stats.paid ?? 0) : null}
          sub={stats?.capacity ? `of ${stats.capacity} capacity` : null}
          progress={filled}
        />
        <Stat label="Checked in" value={stats ? String(stats.checkedIn ?? 0) : null} sub="At the gate" />
        <Stat label="Pending" value={stats ? String(stats.pending ?? 0) : null} sub="Payment not completed" />
        <Stat label="Revenue" value={stats ? fmtRupees(stats.revenue) : null} sub="Collected via Razorpay" />
      </div>

      <div className="grid gap-3 md:grid-cols-2">
        <Breakdown title="By designation" items={stats?.byDesignation} nameKey="designation" />
        <Breakdown title="By college" items={stats?.byCollege} nameKey="college" />
      </div>

      <Link
        to="/admin/registrations"
        className="inline-flex h-10 items-center rounded-lg border border-white/10 bg-white/[0.04] px-4 text-sm font-medium text-paper/80 transition-colors hover:bg-white/[0.08] hover:text-paper"
      >
        View all registrations
      </Link>
    </div>
  )
}

function Stat({ label, value, sub, progress }) {
  return (
    <Card className="p-4 sm:p-5">
      <Label>{label}</Label>
      <div className="mt-2 text-[26px] font-semibold leading-none tracking-tight tabular-nums sm:text-3xl">
        {value ?? <span className="inline-block h-6 w-16 animate-pulse rounded bg-white/10 align-middle" />}
      </div>
      {typeof progress === 'number' && (
        <div className="mt-3 h-1 w-full overflow-hidden rounded-full bg-white/10">
          <div className="h-full rounded-full bg-red transition-[width] duration-500" style={{ width: `${progress}%` }} />
        </div>
      )}
      {sub && <div className="mt-2 text-xs text-paper/40">{sub}</div>}
    </Card>
  )
}

function Breakdown({ title, items, nameKey }) {
  const list = Array.isArray(items) ? items : []
  const max = Math.max(1, ...list.map((i) => Number(i.count) || 0))

  return (
    <Card className="p-5">
      <Label>{title}</Label>
      {list.length === 0 ? (
        <p className="mt-4 text-sm text-paper/35">No data yet.</p>
      ) : (
        <ul className="mt-4 space-y-3.5">
          {list.map((item) => {
            const count = Number(item.count) || 0
            return (
              <li key={item[nameKey] ?? '—'}>
                <div className="mb-1.5 flex items-baseline justify-between gap-4 text-sm">
                  <span className="truncate capitalize text-paper/75">{item[nameKey] ?? '—'}</span>
                  <span className="flex-none tabular-nums text-paper/45">{count}</span>
                </div>
                <div className="h-1 w-full overflow-hidden rounded-full bg-white/[0.07]">
                  <div className="h-full rounded-full bg-red/70" style={{ width: `${(count / max) * 100}%` }} />
                </div>
              </li>
            )
          })}
        </ul>
      )}
    </Card>
  )
}
