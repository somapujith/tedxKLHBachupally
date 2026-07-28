import { useCallback, useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { adminFetch, getToken, isSuperAdmin } from './api'
import { Alert, Button, Card, Input, Label, RefreshBar } from './ui'

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
  const [settings, setSettings] = useState(null)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)
  const [refreshedAt, setRefreshedAt] = useState(null)
  const superAdmin = isSuperAdmin()

  const load = useCallback(async () => {
    setLoading(true)
    // A plain admin never issues the extra requests — they would only 403.
    const [base, extra, config] = await Promise.all([
      adminFetch('/api/admin/stats'),
      superAdmin ? adminFetch('/api/admin/super-stats') : Promise.resolve(null),
      superAdmin ? adminFetch('/api/admin/settings') : Promise.resolve(null),
    ])
    if (base.ok) setStats(base.data.stats)
    if (extra?.ok) setSuperStats(extra.data.superStats)
    if (config?.ok) setSettings(config.data.settings)
    // A failed settings read is surfaced, not swallowed: silently leaving the
    // capacity card on its loading skeleton (or worse, on a stale value right
    // after a save) hides the state of the control that decides whether the
    // event can sell tickets at all.
    setError(
      base.ok
        ? config && !config.ok
          ? config.data.error || 'Could not load the seat capacity setting.'
          : ''
        : base.data.error || 'Could not load stats.',
    )
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

      {superAdmin && <SuperSection superStats={superStats} settings={settings} onSaved={load} />}

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
function SuperSection({ superStats, settings, onSaved }) {
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

      <CapacityCard settings={settings} onSaved={onSaved} />

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

// Seat-capacity editor. The number shown everywhere (register page, sold-out
// gate, dashboard) follows this value the moment it saves — no redeploy. The
// server validates again and records the change in the audit trail.
function CapacityCard({ settings, onSaved }) {
  const [value, setValue] = useState('')
  const [busy, setBusy] = useState(false)
  const [note, setNote] = useState('')

  const current = settings?.seatCapacity
  const paid = Number(settings?.paid ?? 0)
  const belowPaid = typeof current === 'number' && current < paid

  async function save(capacity) {
    setBusy(true)
    setNote('')
    const { ok, data } = await adminFetch('/api/admin/settings', {
      method: 'PATCH',
      body: JSON.stringify({ capacity }),
    })
    setNote(ok ? 'Saved.' : data.error || 'Could not update capacity.')
    setBusy(false)
    if (ok) {
      setValue('')
      onSaved?.()
    }
  }

  function submit(e) {
    e.preventDefault()
    const n = Number(value)
    if (!Number.isInteger(n) || n < 0) {
      setNote('Enter a whole number of seats.')
      return
    }
    // Two separate confirmations, because 0 is not caught by the below-paid
    // check when nothing has sold yet (0 < 0 is false) — and typing 0 before
    // sales open is a total, silent freeze with no other warning on screen.
    if (
      n === 0 &&
      !window.confirm(
        'Setting capacity to 0 closes registrations entirely — every visitor sees a sold-out page. Continue?',
      )
    )
      return
    if (
      n > 0 &&
      n < paid &&
      !window.confirm(
        `New capacity (${n}) is below the ${paid} seats already sold. Sales will read as sold out immediately. Continue?`,
      )
    )
      return
    save(n)
  }

  return (
    <Card className="p-5">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <Label>Seat capacity</Label>
          <div className="mt-2 text-[26px] font-semibold leading-none tracking-tight tabular-nums">
            {typeof current === 'number' ? (
              current
            ) : (
              <span className="inline-block h-6 w-16 animate-pulse rounded bg-white/10 align-middle" />
            )}
          </div>
          <div className="mt-2 text-xs text-paper/40">
            {settings?.overridden
              ? `Custom value${settings.updatedBy ? ` · set by ${settings.updatedBy}` : ''} · default is ${settings.fallbackCapacity}`
              : 'Deploy default — set a custom value to change it live'}
            {` · ${paid} paid`}
          </div>
          {belowPaid && (
            <div className="mt-2 text-xs text-red">
              Capacity is below seats already sold — registrations read as sold out.
            </div>
          )}
        </div>

        <form onSubmit={submit} className="flex items-center gap-2">
          <Input
            type="number"
            min="0"
            step="1"
            inputMode="numeric"
            value={value}
            onChange={(e) => setValue(e.target.value)}
            placeholder={typeof current === 'number' ? String(current) : 'Seats'}
            aria-label="New seat capacity"
            className="w-28"
          />
          <Button type="submit" variant="primary" size="md" disabled={busy || value.trim() === ''}>
            {busy ? 'Saving…' : 'Save'}
          </Button>
          {settings?.overridden && (
            <Button size="md" onClick={() => save(null)} disabled={busy}>
              Reset
            </Button>
          )}
        </form>
      </div>
      {note && <div className="mt-3 text-xs text-paper/50">{note}</div>}
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
