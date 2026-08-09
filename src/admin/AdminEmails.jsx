import { useCallback, useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { adminFetch, getToken, isSuperAdmin } from './api'
import { Alert, Card, EmptyState, Label, RefreshBar, SegmentedControl, fmtDateTime } from './ui'
import ExportCsvButton from './ExportCsvButton'

// Mirrors exactly what listEmailLog returns (server/audit.js).
const EMAIL_EXPORT_FIELDS = [
  { key: 'full_name', label: 'Name' },
  { key: 'to_email', label: 'Email' },
  { key: 'email_type', label: 'Email type' },
  { key: 'status', label: 'Status' },
  { key: 'triggered_by', label: 'Triggered by' },
  { key: 'error', label: 'Error', default: false },
  { key: 'provider_message_id', label: 'Provider message ID', default: false },
  { key: 'created_at', label: 'Sent at' },
  { key: 'id', label: 'Log ID', default: false },
]

// Two tabs over the SAME email_log table, split by `email_type` — Confirmation
// is the booking email sent the moment a bank-transfer proof is approved;
// Pass is the ticket email (with the entry QR) sent once a superadmin verifies
// the payment. They're different emails, sent at different points in the
// flow, to potentially different states of "has this person actually paid" —
// worth separate tabs rather than one undifferentiated list.
const CATEGORIES = [
  {
    key: 'booking',
    emailType: 'booking',
    label: 'Confirmation',
    hint: 'Sent the moment a bank-transfer proof is approved — before an admin has verified the payment.',
  },
  {
    key: 'ticket',
    emailType: 'ticket',
    label: 'Pass',
    hint: 'Sent once a superadmin verifies the payment — carries the entry QR code.',
  },
]

const STATUS_FILTERS = [
  { key: 'all', label: 'All' },
  { key: 'sent', label: 'Sent' },
  { key: 'failed', label: 'Failed' },
  { key: 'skipped', label: 'Skipped' },
]

const ICONS = {
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
  clock: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" className="h-4 w-4" aria-hidden>
      <circle cx="12" cy="12" r="8.5" />
      <path d="M12 7.5V12l3 2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  ),
  check: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" className="h-4 w-4" aria-hidden>
      <path d="M20 6 9.5 16.5 4 11" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  ),
}

// Same tile as the Dashboard's superadmin stat row, kept local — four numbers,
// an icon, and an optional "something's wrong" red accent. Not worth exporting
// a shared component for one other caller; see src/admin/AdminDashboard.jsx.
function Stat({ label, value, sub, icon, accent = false }) {
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
      <div className={`mt-2 text-2xl font-semibold tabular-nums tracking-tight md:text-3xl ${accent ? 'text-red' : 'text-paper'}`}>
        {value}
      </div>
      {sub && <p className="mt-1 text-xs text-paper/45">{sub}</p>}
    </Card>
  )
}

function Pill({ tone = 'neutral', children }) {
  const tones = {
    ok: 'border-emerald-400/25 bg-emerald-400/10 text-emerald-300',
    bad: 'border-red/30 bg-red/10 text-red',
    warn: 'border-amber-400/25 bg-amber-400/10 text-amber-200',
    neutral: 'border-white/10 bg-white/[0.04] text-paper/60',
  }
  return (
    <span className={`inline-flex flex-none items-center rounded-full border px-2.5 py-1 text-[11px] font-medium ${tones[tone]}`}>
      {children}
    </span>
  )
}

export default function AdminEmails() {
  const navigate = useNavigate()
  const [category, setCategory] = useState('booking')
  const [statusFilter, setStatusFilter] = useState('all')
  const [rows, setRows] = useState([])
  const [typeStats, setTypeStats] = useState([])
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)
  const [refreshedAt, setRefreshedAt] = useState(null)

  const active = CATEGORIES.find((c) => c.key === category)

  const load = useCallback(async () => {
    setLoading(true)
    // The row list (capped, filtered to the active tab) and the exact
    // per-type counts (uncapped, from a DB-side GROUP BY) are fetched
    // together — the stat tiles above the list must never undercount just
    // because the list itself is paginated.
    const [list, stats] = await Promise.all([
      adminFetch(`/api/admin/email-log?type=${active.emailType}&status=${statusFilter}&limit=200`),
      adminFetch('/api/admin/super-stats'),
    ])
    const failed = !list.ok ? list : !stats.ok ? stats : null
    if (list.ok) setRows(list.data.entries ?? [])
    if (stats.ok) setTypeStats(stats.data.superStats?.emailByTypeStatus ?? [])
    setError(failed ? failed.data.error || 'Could not load emails.' : '')
    setRefreshedAt(new Date())
    setLoading(false)
  }, [active.emailType, statusFilter])

  useEffect(() => {
    if (!getToken()) {
      navigate('/admin/login', { replace: true })
      return
    }
    load()
  }, [navigate, load])

  if (!isSuperAdmin()) {
    return <Alert>This screen is available to superadmins only.</Alert>
  }

  const countFor = (status) =>
    typeStats.find((s) => s.email_type === active.emailType && s.status === status)?.count ?? 0
  const sent = countFor('sent')
  const failedCount = countFor('failed')
  const skipped = countFor('skipped')
  const total = sent + failedCount + skipped
  const deliveryRate = total > 0 ? Math.round((sent / total) * 100) : null

  return (
    <div className="space-y-5">
      {error && <Alert>{error}</Alert>}

      <div className="space-y-2">
        <SegmentedControl
          options={CATEGORIES.map((c) => ({ key: c.key, label: c.label }))}
          value={category}
          onChange={setCategory}
          ariaLabel="Email category"
        />
        <p className="text-sm text-paper/50">{active.hint}</p>
      </div>

      <div className="grid grid-cols-2 gap-3 md:gap-4 lg:grid-cols-4">
        <Stat label="Sent" value={String(sent)} sub={`${active.label} emails delivered`} icon={ICONS.mail} />
        <Stat
          label="Failed"
          value={String(failedCount)}
          sub="Rejected or errored by Resend"
          icon={ICONS.alert}
          accent={failedCount > 0}
        />
        <Stat label="Skipped" value={String(skipped)} sub="No API key, or a test run" icon={ICONS.clock} />
        <Stat
          label="Delivery rate"
          value={deliveryRate == null ? '—' : `${deliveryRate}%`}
          sub={`${total} total`}
          icon={ICONS.check}
        />
      </div>

      <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
        <div className="min-w-0 flex-1">
          <RefreshBar
            left={`${rows.length} shown`}
            refreshedAt={refreshedAt}
            loading={loading}
            onRefresh={load}
          />
        </div>
        <ExportCsvButton rows={rows} fields={EMAIL_EXPORT_FIELDS} filename={`tedxklh-emails-${active.key}.csv`} />
      </div>

      <div className="-mx-4 overflow-x-auto px-4 sm:mx-0 sm:px-0">
        <SegmentedControl options={STATUS_FILTERS} value={statusFilter} onChange={setStatusFilter} ariaLabel="Filter by status" />
      </div>

      <EmailList rows={rows} loading={loading} category={active.label} />
    </div>
  )
}

function EmailList({ rows, loading, category }) {
  if (!rows.length) {
    return (
      <Card pad="none">
        <EmptyState hint={`${category} emails will appear here once they start sending.`}>
          {loading ? 'Loading emails…' : `No ${category.toLowerCase()} emails logged yet`}
        </EmptyState>
      </Card>
    )
  }
  const tone = { sent: 'ok', failed: 'bad', skipped: 'warn' }
  return (
    <Card pad="none" className="divide-y divide-white/[0.06]">
      {rows.map((row) => (
        <div
          key={row.id}
          className="flex flex-col gap-2 p-4 transition-colors hover:bg-white/[0.02] sm:flex-row sm:items-start sm:justify-between"
        >
          <div className="min-w-0 space-y-1">
            <div className="flex flex-wrap items-center gap-2">
              <Pill tone={tone[row.status] || 'neutral'}>{row.status}</Pill>
              <span className="truncate text-sm font-medium text-paper">{row.full_name || row.to_email}</span>
            </div>
            <p className="truncate text-sm text-paper/60">{row.to_email}</p>
            <p className="text-xs text-paper/40">
              Triggered by <span className="text-paper/60">{row.triggered_by}</span>
              {row.provider_message_id && <span className="ml-2 font-mono">{row.provider_message_id}</span>}
            </p>
            {row.error && <p className="truncate text-xs text-red/80">{row.error}</p>}
          </div>
          <div className="flex-none text-left text-xs tabular-nums text-paper/35 sm:text-right">
            {fmtDateTime(row.created_at)}
          </div>
        </div>
      ))}
    </Card>
  )
}
