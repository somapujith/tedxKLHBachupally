import { useCallback, useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { adminFetch, getToken, isSuperAdmin } from './api'
import {
  Alert,
  BarRow,
  Button,
  Card,
  CardHeader,
  CheckCircleIcon,
  EmptyState,
  fmtDateTime,
  Input,
  Label,
  RefreshBar,
} from './ui'

// Stat glyphs. Each card gets one so the four numbers are distinguishable at a
// glance on a phone at the gate, instead of four identical grey boxes.
const STAT_ICONS = {
  seat: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" className="h-4 w-4" aria-hidden>
      <path d="M6 11V6.5A2.5 2.5 0 0 1 8.5 4h7A2.5 2.5 0 0 1 18 6.5V11" strokeLinecap="round" />
      <path d="M4.5 11h15a1.5 1.5 0 0 1 1.5 1.5V17H3v-4.5A1.5 1.5 0 0 1 4.5 11Z" strokeLinejoin="round" />
      <path d="M6 17v2.5M18 17v2.5" strokeLinecap="round" />
    </svg>
  ),
  check: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" className="h-4 w-4" aria-hidden>
      <path d="M20 6 9.5 16.5 4 11" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  ),
  clock: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" className="h-4 w-4" aria-hidden>
      <circle cx="12" cy="12" r="8.5" />
      <path d="M12 7.5V12l3 2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  ),
  rupee: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" className="h-4 w-4" aria-hidden>
      <path d="M7 5h10M7 9.5h10M16 5c0 4-3.2 5.2-6.5 5.2H7L15 19" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  ),
  mail: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" className="h-4 w-4" aria-hidden>
      <rect x="3" y="5.5" width="18" height="13" rx="2" />
      <path d="m3.5 7 8.5 6 8.5-6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  ),
  alert: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" className="h-4 w-4" aria-hidden>
      <path d="M12 4.5 21 19H3z" strokeLinejoin="round" />
      <path d="M12 10v3.5" strokeLinecap="round" />
      <circle cx="12" cy="16.4" r="0.85" fill="currentColor" stroke="none" />
    </svg>
  ),
  shield: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" className="h-4 w-4" aria-hidden>
      <path d="M12 3.5 19 6v6c0 4.2-2.9 7.4-7 8.5-4.1-1.1-7-4.3-7-8.5V6z" strokeLinejoin="round" />
    </svg>
  ),
  pulse: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" className="h-4 w-4" aria-hidden>
      <path d="M3 12h4l2.5-6 4 12 2.5-6h5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  ),
}

// `amount` is stored in whole rupees. It held paise under the old card gateway,
// which is why this used to divide by 100 — bank transfers are recorded at the
// price the buyer was shown, so there is no sub-unit to convert.
function fmtRupees(rupees) {
  const n = Number(rupees)
  if (!Number.isFinite(n)) return '—'
  return `₹${n.toLocaleString('en-IN')}`
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
  const [verifications, setVerifications] = useState([])
  const [openTickets, setOpenTickets] = useState(0)
  const superAdmin = isSuperAdmin()

  const load = useCallback(async () => {
    setLoading(true)
    // A plain admin never issues the extra requests — they would only 403.
    const [base, extra, config, queue, support] = await Promise.all([
      adminFetch('/api/admin/stats'),
      superAdmin ? adminFetch('/api/admin/super-stats') : Promise.resolve(null),
      superAdmin ? adminFetch('/api/admin/settings') : Promise.resolve(null),
      adminFetch('/api/admin/verifications'),
      // Count only — the tickets themselves live on their own screen. A failure
      // here leaves the badge at zero rather than blocking the dashboard: the
      // queue is still one tap away and stats matter more at the gate.
      adminFetch('/api/admin/support?status=open'),
    ])
    if (base.ok) setStats(base.data.stats)
    if (extra?.ok) setSuperStats(extra.data.superStats)
    if (config?.ok) setSettings(config.data.settings)
    if (queue.ok) setVerifications(queue.data.registrations || [])
    if (support.ok) setOpenTickets(support.data.openCount ?? 0)
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

      <div className="grid grid-cols-2 gap-3 md:gap-4 lg:grid-cols-4">
        <Stat
          label="Paid seats"
          value={stats ? String(stats.paid ?? 0) : null}
          sub={stats?.capacity ? `of ${stats.capacity} capacity` : null}
          progress={filled}
          icon={STAT_ICONS.seat}
          accent
        />
        <Stat
          label="Checked in"
          value={stats ? String(stats.checkedIn ?? 0) : null}
          sub="At the gate"
          icon={STAT_ICONS.check}
        />
        <Stat
          label="Pending"
          value={stats ? String(stats.pending ?? 0) : null}
          sub="Payment not completed"
          icon={STAT_ICONS.clock}
        />
        <Stat
          label="Revenue"
          value={stats ? fmtRupees(stats.revenue) : null}
          sub="Verified bank transfers"
          icon={STAT_ICONS.rupee}
        />
      </div>

      <VerificationQueue items={verifications} onChanged={load} />

      <div className="grid gap-3 md:grid-cols-2 md:gap-4">
        <Breakdown title="By designation" items={stats?.byDesignation} nameKey="designation" />
        <Breakdown title="By college" items={stats?.byCollege} nameKey="college" />
      </div>

      {superAdmin && <SuperSection superStats={superStats} settings={settings} onSaved={load} />}

      {/* Secondary navigation out of the dashboard. Framed as one row of equal
          cards rather than loose outlined buttons, so it reads as a deliberate
          footer instead of two stray controls. */}
      <div className="grid gap-3 sm:grid-cols-2">
        <NavTile
          to="/admin/registrations"
          title="All registrations"
          hint="Search, filter and resend passes"
        />
        {/* Also the only route to Support on a superadmin's phone — the bottom
            nav is already at its legible five-tab ceiling for that role. */}
        <NavTile
          to="/admin/support"
          title="Support tickets"
          hint={openTickets > 0 ? `${openTickets} waiting on a reply` : 'Nobody is waiting'}
          badge={openTickets > 0 ? openTickets : null}
        />
        {/* Superadmin only, and the only route to the ledger on a phone — the
            bottom nav is at its legible five-tab ceiling for that role. */}
        {superAdmin && (
          <NavTile
            to="/admin/payments"
            title="Verified payments"
            hint="Every approved transfer, by UTR reference"
          />
        )}
      </div>
    </div>
  )
}

// Footer navigation card: title, one line of context, and an affordance arrow
// that slides on hover.
function NavTile({ to, title, hint, badge }) {
  return (
    <Link
      to={to}
      className={[
        'group flex items-center justify-between gap-4 rounded-2xl border border-white/10',
        'bg-gradient-to-b from-white/[0.055] to-white/[0.02] px-5 py-4',
        'transition-[border-color,background-color,transform] duration-200',
        'hover:-translate-y-0.5 hover:border-white/20 hover:from-white/[0.08] motion-reduce:transform-none',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red/60 focus-visible:ring-offset-2 focus-visible:ring-offset-ink',
      ].join(' ')}
    >
      <span className="min-w-0">
        <span className="flex items-center gap-2">
          <span className="text-sm font-semibold tracking-tight text-paper">{title}</span>
          {badge != null && (
            <span className="rounded-full bg-red px-2 py-0.5 text-[11px] font-semibold tabular-nums text-white">
              {badge}
            </span>
          )}
        </span>
        <span className="mt-0.5 block truncate text-xs text-paper/45">{hint}</span>
      </span>
      <svg
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        aria-hidden
        className="h-4 w-4 flex-none text-paper/30 transition-[transform,color] duration-200 group-hover:translate-x-0.5 group-hover:text-paper/70 motion-reduce:transform-none"
      >
        <path d="M5 12h14M13 6l6 6-6 6" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </Link>
  )
}

// Bank-transfer submissions waiting on a human. Approving here is what issues
// the pass and sends the confirmation mail — nothing else in the system emails
// a buyer automatically.
function VerificationQueue({ items, onChanged }) {
  const [openId, setOpenId] = useState(null)
  const [proof, setProof] = useState(null)
  const [loadingProof, setLoadingProof] = useState(false)
  // Kept apart from `proof` so the panel can tell "the fetch failed" from "this
  // row genuinely has no screenshot". Collapsing the two into a null proof is
  // what made a broken endpoint read as a missing upload — the admin sees
  // "No screenshot available." and blames the attendee for not attaching one.
  const [proofError, setProofError] = useState('')
  const [busyId, setBusyId] = useState(null)
  const [note, setNote] = useState('')
  // Bulk selection. Superadmin-only, matching the server's gate on
  // /api/admin/bulk-verify — a plain admin never sees a checkbox, and would get
  // a 403 if they forged the request anyway.
  const canBulk = isSuperAdmin()
  const [selected, setSelected] = useState(() => new Set())
  const [bulkBusy, setBulkBusy] = useState(false)

  // Drop selections for rows that have left the queue (approved elsewhere, or
  // rejected), so the count never claims more than is actually on screen.
  useEffect(() => {
    setSelected((prev) => {
      const live = new Set(items.map((i) => i.id))
      const next = new Set([...prev].filter((id) => live.has(id)))
      return next.size === prev.size ? prev : next
    })
  }, [items])

  function toggle(id) {
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const allSelected = items.length > 0 && selected.size === items.length

  function toggleAll() {
    setSelected(allSelected ? new Set() : new Set(items.map((i) => i.id)))
  }

  async function verifySelected() {
    const ids = [...selected]
    if (ids.length === 0) return
    if (
      !window.confirm(
        `Verify ${ids.length} payment${ids.length === 1 ? '' : 's'} and email ${ids.length === 1 ? 'their pass' : 'their passes'}? This takes ${ids.length === 1 ? 'a seat' : `${ids.length} seats`}.`,
      )
    ) {
      return
    }

    setBulkBusy(true)
    setNote('')
    const { ok, data } = await adminFetch('/api/admin/bulk-verify', {
      method: 'POST',
      body: { registrationIds: ids },
    })
    setBulkBusy(false)

    if (!ok) {
      setNote(data.error || 'Could not verify the selected payments.')
      return
    }

    // Partial success is normal — a row can lose the capacity gate or fail its
    // email while the rest go through. Naming the ones that failed matters more
    // than the totals: those are the rows the superadmin has to act on next.
    const failures = (data.results || []).filter((r) => !r.ok)
    setNote(
      failures.length === 0
        ? `Verified ${data.approved} payment${data.approved === 1 ? '' : 's'} and emailed their passes.`
        : `Verified ${data.approved} of ${data.attempted}. Failed: ${failures
            .map((f) => `${f.name || f.registrationId} (${f.error})`)
            .join('; ')}`,
    )
    setSelected(new Set())
    setOpenId(null)
    onChanged()
  }

  // Shared by the Verify toggle and the Retry link, so a transient failure does
  // not force the admin to collapse and reopen the row to try again.
  async function loadProof(id) {
    setProof(null)
    setProofError('')
    setLoadingProof(true)
    const { ok, data } = await adminFetch(`/api/admin/verifications?id=${id}`)
    // A 404 from getPaymentProof is the only "no proof on file" answer; every
    // other failure is an error the admin must see as an error, not as an
    // attendee who skipped the upload.
    if (ok && data.proof) {
      setProof(data.proof)
    } else if (data.error === 'No payment proof on file.') {
      setProof(null) // genuinely nothing attached — the empty state is correct
    } else {
      setProofError(data.error || 'Could not load the payment screenshot. Try again.')
    }
    setLoadingProof(false)
  }

  async function openVerify(reg) {
    if (openId === reg.id) {
      setOpenId(null)
      setProof(null)
      setProofError('')
      return
    }
    setOpenId(reg.id)
    setNote('')
    await loadProof(reg.id)
  }

  async function approve(reg) {
    // Deliberate confirm: this both takes a seat and emails the buyer.
    if (!window.confirm(`Confirm payment for ${reg.full_name} and email their pass?`)) return
    setBusyId(reg.id)
    setNote('')
    const { ok, data } = await adminFetch('/api/admin/verifications', {
      method: 'POST',
      body: { registrationId: reg.id },
    })
    setBusyId(null)
    if (!ok) {
      setNote(data.error || 'Could not approve this payment.')
      return
    }
    setOpenId(null)
    setProof(null)
    setProofError('')
    onChanged()
  }

  async function reject(reg) {
    const reason = window.prompt(`Why is ${reg.full_name}'s payment being rejected?`)
    if (reason === null) return
    setBusyId(reg.id)
    setNote('')
    const { ok, data } = await adminFetch('/api/admin/verifications', {
      method: 'POST',
      body: { registrationId: reg.id, reject: true, reason },
    })
    setBusyId(null)
    if (!ok) {
      setNote(data.error || 'Could not reject this payment.')
      return
    }
    setOpenId(null)
    setProof(null)
    setProofError('')
    onChanged()
  }

  async function resend(reg) {
    if (!window.confirm(`Resend the confirmation email to ${reg.email}?`)) return
    setBusyId(reg.id)
    setNote('')
    const { ok, data } = await adminFetch('/api/admin/resend-ticket', {
      method: 'POST',
      body: { registrationId: reg.id },
    })
    setBusyId(null)
    setNote(ok ? `Confirmation email resent to ${reg.email}.` : data.error || 'Could not resend.')
  }

  return (
    <Card>
      <CardHeader
        title="Awaiting verification"
        meta={
          items.length > 0 ? (
            <span className="inline-flex items-center gap-1.5 rounded-full border border-amber-400/25 bg-amber-400/10 px-2.5 py-1 font-medium text-amber-200">
              <span aria-hidden className="h-1.5 w-1.5 rounded-full bg-amber-400" />
              {items.length} pending
            </span>
          ) : null
        }
      />

      {note && <Alert>{note}</Alert>}

      {/* Batch bar. Only rendered for a superadmin, and only once the queue has
          something in it — an always-present "select all" over an empty list is
          just noise. */}
      {canBulk && items.length > 0 && (
        <div className="mb-3 flex flex-wrap items-center justify-between gap-3 rounded-lg border border-white/[0.07] bg-white/[0.03] px-3 py-2">
          <label className="flex cursor-pointer items-center gap-2 text-xs text-paper/70">
            <input
              type="checkbox"
              checked={allSelected}
              onChange={toggleAll}
              disabled={bulkBusy}
              className="h-4 w-4 cursor-pointer accent-red"
            />
            {selected.size > 0 ? `${selected.size} selected` : 'Select all'}
          </label>
          <Button
            type="button"
            size="sm"
            variant="primary"
            onClick={verifySelected}
            disabled={bulkBusy || selected.size === 0}
          >
            {bulkBusy ? 'Verifying…' : `Verify selected${selected.size ? ` (${selected.size})` : ''}`}
          </Button>
        </div>
      )}

      {items.length === 0 ? (
        <EmptyState
          tone="good"
          icon={<CheckCircleIcon />}
          hint="Bank transfers appear here the moment an attendee submits one."
        >
          Everything is verified
        </EmptyState>
      ) : (
        <ul className="-mx-1 divide-y divide-white/[0.07]">
          {items.map((reg) => (
            <li key={reg.id} className="px-1 py-3 first:pt-0 last:pb-0">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex min-w-0 items-center gap-3">
                  {canBulk && (
                    <input
                      type="checkbox"
                      checked={selected.has(reg.id)}
                      onChange={() => toggle(reg.id)}
                      disabled={bulkBusy}
                      aria-label={`Select ${reg.full_name} for bulk verification`}
                      className="h-4 w-4 flex-none cursor-pointer accent-red"
                    />
                  )}
                  {/* Initials avatar: gives each row an anchor point so a long
                      queue scans as people rather than as repeated text rows. */}
                  <span
                    aria-hidden
                    className="flex h-9 w-9 flex-none items-center justify-center rounded-full border border-white/10 bg-white/[0.06] text-[11px] font-semibold uppercase tracking-wide text-paper/70"
                  >
                    {initials(reg.full_name)}
                  </span>
                  <div className="min-w-0">
                    <div className="truncate text-sm font-medium text-paper">{reg.full_name}</div>
                    <div className="truncate text-xs text-paper/45">{reg.email}</div>
                    {reg.created_at && (
                      <div className="mt-0.5 truncate text-[11px] text-paper/35">
                        Registered {fmtDateTime(reg.created_at)}
                      </div>
                    )}
                  </div>
                </div>
                <div className="flex shrink-0 gap-2">
                  {/* Deliberately not red: a queue of N rows would otherwise
                      show N primary buttons and flatten the hierarchy. The red
                      commit lives on "Verified — send pass" inside the panel,
                      which is the step that actually issues the seat. */}
                  <Button type="button" size="sm" onClick={() => openVerify(reg)} disabled={busyId === reg.id}>
                    {openId === reg.id ? 'Close' : 'Verify'}
                  </Button>
                  <Button type="button" size="sm" onClick={() => resend(reg)} disabled={busyId === reg.id}>
                    Resend email
                  </Button>
                </div>
              </div>

              {openId === reg.id && (
                <div className="mt-4 rounded-xl border border-white/10 bg-black/25 p-4">
                  <div className="mb-3 grid gap-2 sm:grid-cols-2">
                    <div className="rounded-lg border border-white/[0.07] bg-white/[0.03] px-3 py-2">
                      <Label>UTR ID</Label>
                      <div className="mt-1 truncate font-mono text-xs tracking-wider text-paper">{reg.utr_id}</div>
                    </div>
                    <div className="rounded-lg border border-white/[0.07] bg-white/[0.03] px-3 py-2">
                      <Label>Amount</Label>
                      <div className="mt-1 text-sm font-semibold tabular-nums text-paper">{fmtRupees(reg.amount)}</div>
                    </div>
                    <div className="rounded-lg border border-white/[0.07] bg-white/[0.03] px-3 py-2">
                      <Label>Registered</Label>
                      <div className="mt-1 text-xs text-paper/80">{fmtDateTime(reg.created_at)}</div>
                    </div>
                    <div className="rounded-lg border border-white/[0.07] bg-white/[0.03] px-3 py-2">
                      <Label>Payment submitted</Label>
                      <div className="mt-1 text-xs text-paper/80">{fmtDateTime(reg.submitted_at)}</div>
                    </div>
                  </div>

                  {loadingProof ? (
                    <div className="h-48 w-full animate-pulse rounded-lg border border-white/10 bg-white/[0.05] motion-reduce:animate-none" />
                  ) : proof ? (
                    <a
                      href={proof}
                      target="_blank"
                      rel="noreferrer"
                      className="group block w-fit overflow-hidden rounded-lg border border-white/10 transition-colors hover:border-white/25"
                    >
                      <img
                        src={proof}
                        alt={`Payment screenshot from ${reg.full_name}`}
                        className="max-h-96 w-auto transition-transform duration-300 group-hover:scale-[1.02] motion-reduce:transform-none"
                      />
                    </a>
                  ) : proofError ? (
                    // Never approve a payment you could not actually look at.
                    <div className="rounded-lg border border-red/30 bg-red/10 px-3 py-2">
                      <p className="text-xs text-red">{proofError}</p>
                      <button
                        type="button"
                        onClick={() => loadProof(reg.id)}
                        className="mt-1 text-xs text-paper/60 underline underline-offset-2 hover:text-paper"
                      >
                        Retry
                      </button>
                    </div>
                  ) : (
                    <p className="rounded-lg border border-dashed border-white/10 px-3 py-6 text-center text-xs text-paper/40">
                      No screenshot available.
                    </p>
                  )}

                  <div className="mt-4 flex flex-wrap gap-2 border-t border-white/[0.07] pt-4">
                    <Button type="button" variant="primary" onClick={() => approve(reg)} disabled={busyId === reg.id}>
                      {busyId === reg.id ? 'Working…' : 'Verified — send pass'}
                    </Button>
                    <Button type="button" variant="danger" onClick={() => reject(reg)} disabled={busyId === reg.id}>
                      Reject
                    </Button>
                  </div>
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
    </Card>
  )
}

// Every card reserves the same vertical slots (label row · number · meter ·
// caption) whether or not it has a progress value, so the four never end up at
// different heights — the ragged bottom edge was the main reason the row looked
// unfinished. `accent` tints only the icon, never the whole card.
function Stat({ label, value, sub, progress, icon, accent = false }) {
  const hasProgress = typeof progress === 'number'
  return (
    <Card pad="none" className="flex h-full flex-col p-4 md:p-5">
      <div className="flex items-start justify-between gap-3">
        <Label className="pt-0.5">{label}</Label>
        {icon && (
          <span
            aria-hidden
            className={[
              'flex h-7 w-7 flex-none items-center justify-center rounded-lg border',
              accent ? 'border-red/25 bg-red/10 text-red' : 'border-white/10 bg-white/[0.05] text-paper/45',
            ].join(' ')}
          >
            {icon}
          </span>
        )}
      </div>

      <div className="mt-3 text-[28px] font-semibold leading-none tracking-tight tabular-nums md:text-[32px]">
        {value ?? (
          <span className="inline-block h-7 w-20 animate-pulse rounded-md bg-white/10 align-middle motion-reduce:animate-none" />
        )}
      </div>

      {/* Meter slot is always present so card heights stay identical. */}
      <div className="mt-3 h-1.5">
        {hasProgress && (
          <div className="h-1.5 w-full overflow-hidden rounded-full bg-white/[0.08]">
            <div
              className="h-full rounded-full bg-gradient-to-r from-red/70 to-red transition-[width] duration-700 ease-out motion-reduce:transition-none"
              style={{ width: `${progress}%` }}
            />
          </div>
        )}
      </div>

      <div className="mt-2 flex items-baseline gap-1.5 text-xs text-paper/40">
        {hasProgress && <span className="font-medium tabular-nums text-paper/60">{progress}%</span>}
        {sub && <span className="truncate">{sub}</span>}
      </div>
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

  const maxScans = Math.max(1, ...byAdmin.map((a) => Number(a.scans) || 0))

  return (
    <div className="space-y-4 md:space-y-5">
      {/* Section divider — a labelled rule, so the superadmin-only block is
          clearly a separate region instead of more cards in the same stream. */}
      <div className="flex items-center gap-3 pt-2">
        <span className="inline-flex items-center gap-2 rounded-full border border-red/25 bg-red/10 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.08em] text-red">
          <span aria-hidden className="h-1.5 w-1.5 rounded-full bg-red" />
          Superadmin
        </span>
        <span aria-hidden className="h-px flex-1 bg-gradient-to-r from-white/12 to-transparent" />
      </div>

      <div className="grid gap-3 md:grid-cols-2 md:gap-4">
        <RegistrationAccessCard settings={settings} onSaved={onSaved} />
        <CapacityCard settings={settings} onSaved={onSaved} />
      </div>

      <div className="grid grid-cols-2 gap-3 md:gap-4 lg:grid-cols-4">
        <Stat label="Emails sent" value={String(sent)} sub="Passes delivered to Resend" icon={STAT_ICONS.mail} />
        <Stat
          label="Email failures"
          value={String(failed)}
          sub={skipped ? `${skipped} skipped (no API key)` : 'Rejected or errored'}
          icon={STAT_ICONS.alert}
          accent={failed > 0}
        />
        <Stat
          label="Failed logins"
          value={String(superStats?.failedLogins24h ?? 0)}
          sub="Last 24 hours"
          icon={STAT_ICONS.shield}
        />
        <Stat
          label="Admin actions"
          value={String(superStats?.actionsLastHour ?? 0)}
          sub="Last hour"
          icon={STAT_ICONS.pulse}
        />
      </div>

      <div className="grid gap-3 md:grid-cols-2 md:gap-4">
        <Card>
          <CardHeader title="Scans by admin" meta={totalScans > 0 ? `${totalScans} total` : null} />
          {byAdmin.length === 0 ? (
            <EmptyState hint="Check-ins appear here as the gate starts scanning.">No check-ins yet</EmptyState>
          ) : (
            <ul className="space-y-4">
              {byAdmin.map((row) => (
                <BarRow
                  key={row.admin ?? '—'}
                  label={row.admin || 'Unattributed'}
                  value={row.scans}
                  max={maxScans}
                  total={totalScans}
                />
              ))}
            </ul>
          )}
        </Card>

        <Card>
          <CardHeader title="Emails by trigger" />
          {(superStats?.emailByTrigger ?? []).length === 0 ? (
            <EmptyState hint="Every pass email is logged here once sending begins.">No emails logged yet</EmptyState>
          ) : (
            <ul className="divide-y divide-white/[0.06]">
              {superStats.emailByTrigger.map((row) => (
                <li key={row.triggered_by} className="flex items-baseline justify-between gap-4 py-2.5 text-sm first:pt-0">
                  <span className="truncate text-paper/80">
                    {row.triggered_by === 'system' ? 'Automatic (after payment)' : `Resent by ${row.triggered_by}`}
                  </span>
                  <span className="flex-none font-medium tabular-nums text-paper/80">{row.count}</span>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>

      <div className="grid gap-3 md:grid-cols-2 md:gap-4">
        <NavTile to="/admin/emails" title="Confirmation & pass emails" hint="Sent counts and failures, by email type" />
        <NavTile to="/admin/activity" title="Full activity log" hint="Every admin action and ticket email" />
      </div>
    </div>
  )
}

function RegistrationAccessCard({ settings, onSaved }) {
  const [busy, setBusy] = useState(false)
  const [note, setNote] = useState('')
  const isOpen = settings?.registrationOpen === true
  const overridden = settings?.registrationOpenOverridden === true
  const opensAt = settings?.registrationOpensAt || '2026-08-05T07:00:00+05:30'

  async function setOverride(forceOpen) {
    setBusy(true)
    setNote('')
    const { ok, data } = await adminFetch('/api/admin/settings', {
      method: 'PATCH',
      body: JSON.stringify({ registrationOpenOverride: forceOpen }),
    })
    setNote(ok ? (forceOpen ? 'Registrations enabled.' : 'Scheduled lock restored.') : data.error || 'Could not update registration access.')
    setBusy(false)
    if (ok) onSaved?.()
  }

  return (
    <Card>
      <div className="flex flex-wrap items-end justify-between gap-x-6 gap-y-4">
        <div className="min-w-0">
          <Label>Registrations</Label>
          <div className="mt-2 flex items-center gap-2">
            <span className="text-[28px] font-semibold leading-none tracking-tight md:text-[32px]">
              {isOpen ? 'Open' : 'Locked'}
            </span>
            {overridden && (
              <span className="rounded-full border border-red/30 bg-red/10 px-2 py-0.5 text-[10px] font-medium uppercase tracking-[0.06em] text-red">
                Manual
              </span>
            )}
          </div>
          <div className="mt-2 text-xs text-paper/40">
            {overridden
              ? `Opened early by ${settings?.registrationUpdatedBy || 'a superadmin'}`
              : `Scheduled to open on ${fmtRegistrationOpenAt(opensAt)}`}
          </div>
        </div>

        <div className="flex items-center gap-2">
          {!overridden ? (
            <Button size="md" variant="primary" onClick={() => setOverride(true)} disabled={busy}>
              {busy ? 'Saving…' : 'Enable now'}
            </Button>
          ) : (
            <Button size="md" onClick={() => setOverride(false)} disabled={busy}>
              {busy ? 'Saving…' : 'Use schedule'}
            </Button>
          )}
        </div>
      </div>
      {note && <div className="mt-3 text-xs text-paper/50">{note}</div>}
    </Card>
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
    <Card>
      <div className="flex flex-wrap items-end justify-between gap-x-6 gap-y-4">
        <div className="min-w-0">
          <Label>Seat capacity</Label>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-[28px] font-semibold leading-none tracking-tight tabular-nums md:text-[32px]">
              {typeof current === 'number' ? (
                current
              ) : (
                <span className="inline-block h-7 w-20 animate-pulse rounded-md bg-white/10 align-middle motion-reduce:animate-none" />
              )}
            </span>
            <span className="text-xs text-paper/40">seats</span>
            {settings?.overridden && (
              <span className="rounded-full border border-white/10 bg-white/[0.06] px-2 py-0.5 text-[10px] font-medium uppercase tracking-[0.06em] text-paper/55">
                Custom
              </span>
            )}
          </div>
          <div className="mt-2 text-xs text-paper/40">
            {settings?.overridden
              ? `Set by ${settings.updatedBy || 'an admin'} · default is ${settings.fallbackCapacity}`
              : 'Deploy default — set a custom value to change it live'}
            {` · ${paid} paid`}
          </div>
          {belowPaid && (
            <div className="mt-2 flex items-center gap-1.5 text-xs text-red">
              <span aria-hidden className="h-1.5 w-1.5 flex-none rounded-full bg-red" />
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

function fmtRegistrationOpenAt(value) {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return '5th August at 7:00 am'
  return date
    .toLocaleString('en-IN', {
      month: 'long',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
      timeZone: 'Asia/Kolkata',
    })
    .replace(',', ' at')
    .toLowerCase()
}

function Breakdown({ title, items, nameKey }) {
  const list = Array.isArray(items) ? items : []
  const max = Math.max(1, ...list.map((i) => Number(i.count) || 0))
  const total = list.reduce((sum, i) => sum + (Number(i.count) || 0), 0)

  return (
    <Card>
      <CardHeader title={title} meta={total > 0 ? `${total} total` : null} />
      {list.length === 0 ? (
        <EmptyState hint="Numbers appear here once registrations start coming in.">No data yet</EmptyState>
      ) : (
        <ul className="space-y-4">
          {list.map((item) => (
            <BarRow
              key={item[nameKey] ?? '—'}
              label={item[nameKey] ?? '—'}
              value={item.count}
              max={max}
              total={total}
            />
          ))}
        </ul>
      )}
    </Card>
  )
}

// "Aarav Menon" -> "AM". Falls back to a dash so the avatar never renders empty.
function initials(name) {
  const parts = String(name ?? '')
    .trim()
    .split(/\s+/)
    .filter(Boolean)
  if (parts.length === 0) return '—'
  return (parts[0][0] + (parts.length > 1 ? parts[parts.length - 1][0] : '')).toUpperCase()
}
