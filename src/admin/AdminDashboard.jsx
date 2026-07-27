import { useCallback, useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { adminFetch, getToken, isSuperAdmin } from './api'
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
  const [superStats, setSuperStats] = useState(null)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)
  const [refreshedAt, setRefreshedAt] = useState(null)
  const superAdmin = isSuperAdmin()

  const load = useCallback(async () => {
    setLoading(true)
    // A plain admin never issues the second request — it would only 403.
    const [base, extra] = await Promise.all([
      adminFetch('/api/admin/stats'),
      superAdmin ? adminFetch('/api/admin/super-stats') : Promise.resolve(null),
    ])
    if (base.ok) setStats(base.data.stats)
    if (extra?.ok) setSuperStats(extra.data.superStats)
    setError(base.ok ? '' : base.data.error || 'Could not load stats.')
    setRefreshedAt(new Date())
    setLoading(false)
  }, [superAdmin])

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

      {superAdmin && <SuperSection superStats={superStats} />}

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

// Everything below renders only for a superadmin. It answers the three
// questions the base dashboard cannot: who is doing the scanning, whether the
// passes are actually reaching inboxes, and whether anyone is trying to get in.
function SuperSection({ superStats }) {
  const byAdmin = superStats?.byAdmin ?? []
  const emailByStatus = superStats?.emailByStatus ?? []
  const sent = emailByStatus.find((e) => e.status === 'sent')?.count ?? 0
  const failed = emailByStatus.find((e) => e.status === 'failed')?.count ?? 0
  const skipped = emailByStatus.find((e) => e.status === 'skipped')?.count ?? 0
  const totalScans = byAdmin.reduce((sum, a) => sum + (Number(a.scans) || 0), 0)

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2 pt-2">
        <span aria-hidden className="h-1.5 w-1.5 rounded-full bg-red" />
        <Label>Superadmin</Label>
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="Emails sent" value={String(sent)} sub="Passes delivered to Resend" />
        <Stat label="Email failures" value={String(failed)} sub={skipped ? `${skipped} skipped (no API key)` : 'Rejected or errored'} />
        <Stat label="Failed logins" value={String(superStats?.failedLogins24h ?? 0)} sub="Last 24 hours" />
        <Stat label="Admin actions" value={String(superStats?.actionsLastHour ?? 0)} sub="Last hour" />
      </div>

      <div className="grid gap-3 md:grid-cols-2">
        <Card className="p-5">
          <Label>Scans by admin</Label>
          {byAdmin.length === 0 ? (
            <p className="mt-4 text-sm text-paper/35">No check-ins yet.</p>
          ) : (
            <ul className="mt-4 space-y-3.5">
              {byAdmin.map((row) => {
                const count = Number(row.scans) || 0
                return (
                  <li key={row.admin ?? '—'}>
                    <div className="mb-1.5 flex items-baseline justify-between gap-4 text-sm">
                      <span className="truncate text-paper/75">{row.admin || 'Unattributed'}</span>
                      <span className="flex-none tabular-nums text-paper/45">{count}</span>
                    </div>
                    <div className="h-1 w-full overflow-hidden rounded-full bg-white/[0.07]">
                      <div
                        className="h-full rounded-full bg-red/70"
                        style={{ width: `${(count / Math.max(1, totalScans)) * 100}%` }}
                      />
                    </div>
                  </li>
                )
              })}
            </ul>
          )}
        </Card>

        <Card className="p-5">
          <Label>Emails by trigger</Label>
          {(superStats?.emailByTrigger ?? []).length === 0 ? (
            <p className="mt-4 text-sm text-paper/35">No emails logged yet.</p>
          ) : (
            <ul className="mt-4 space-y-2.5">
              {superStats.emailByTrigger.map((row) => (
                <li key={row.triggered_by} className="flex items-baseline justify-between gap-4 text-sm">
                  <span className="truncate text-paper/75">
                    {row.triggered_by === 'system' ? 'Automatic (after payment)' : `Resent by ${row.triggered_by}`}
                  </span>
                  <span className="flex-none tabular-nums text-paper/45">{row.count}</span>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>

      <Link
        to="/admin/activity"
        className="inline-flex h-10 items-center rounded-lg border border-white/10 bg-white/[0.04] px-4 text-sm font-medium text-paper/80 transition-colors hover:bg-white/[0.08] hover:text-paper"
      >
        Open the full activity log
      </Link>
    </div>
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
