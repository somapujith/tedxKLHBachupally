import { useCallback, useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { adminFetch, getToken, isSuperAdmin } from './api'
import { Alert, Card, EmptyState, RefreshBar, SegmentedControl } from './ui'
import ExportCsvButton from './ExportCsvButton'

// Mirrors listAuditLog / listEmailLog (server/audit.js) respectively.
const AUDIT_EXPORT_FIELDS = [
  { key: 'created_at', label: 'When' },
  { key: 'admin_username', label: 'Admin' },
  { key: 'admin_role', label: 'Role', default: false },
  { key: 'action', label: 'Action' },
  { key: 'result', label: 'Result' },
  { key: 'target_name', label: 'Target' },
  { key: 'target_type', label: 'Target type', default: false },
  { key: 'detail', label: 'Detail' },
  { key: 'ip', label: 'IP', default: false },
]
const EMAIL_EXPORT_FIELDS = [
  { key: 'full_name', label: 'Name' },
  { key: 'to_email', label: 'Email' },
  { key: 'email_type', label: 'Email type' },
  { key: 'status', label: 'Status' },
  { key: 'triggered_by', label: 'Triggered by' },
  { key: 'error', label: 'Error', default: false },
  { key: 'created_at', label: 'Sent at' },
]

// Superadmin activity screen: the admin audit trail and the ticket-email log,
// under one tab. Both answer the same class of question after the event ("who
// scanned this person", "did their pass actually go out"), so splitting them
// across two screens would only add navigation.
//
// Access is enforced server-side (403 from every superadmin route). The role
// check here only avoids rendering a screen that could show nothing but errors.

const VIEWS = [
  { key: 'audit', label: 'Admin actions' },
  { key: 'email', label: 'Ticket emails' },
]

// Only the actions worth filtering to: the ones looked up by name after a gate
// dispute, plus the security-relevant failed logins.
const ACTION_FILTERS = [
  { key: 'all', label: 'All' },
  { key: 'checkin_success', label: 'Scans' },
  { key: 'checkin_duplicate', label: 'Duplicate scans' },
  { key: 'checkin_rejected', label: 'Rejected' },
  { key: 'resend_ticket', label: 'Resends' },
  { key: 'login_failed', label: 'Failed logins' },
]

const EMAIL_FILTERS = [
  { key: 'all', label: 'All' },
  { key: 'sent', label: 'Sent' },
  { key: 'failed', label: 'Failed' },
  { key: 'skipped', label: 'Skipped' },
]

// Human labels for the closed action vocabulary in server/audit.js.
const ACTION_LABELS = {
  login_success: 'Signed in',
  login_failed: 'Failed sign-in',
  checkin_success: 'Checked in',
  checkin_duplicate: 'Duplicate scan',
  checkin_rejected: 'Scan rejected',
  resend_ticket: 'Re-sent pass',
  resend_failed: 'Resend failed',
  admin_created: 'Created admin',
  admin_updated: 'Updated admin',
  admin_deactivated: 'Deactivated admin',
  admin_reactivated: 'Reactivated admin',
  ticket_revoked: 'Revoked QR pass',
  capacity_updated: 'Changed capacity',
}

function fmtDateTime(value) {
  if (!value) return '—'
  const d = new Date(value)
  return Number.isNaN(d.getTime())
    ? String(value)
    : d.toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'medium', timeZone: 'Asia/Kolkata' })
}

function Pill({ tone = 'neutral', children }) {
  const tones = {
    ok: 'border-emerald-400/25 bg-emerald-400/10 text-emerald-300',
    bad: 'border-red/30 bg-red/10 text-red',
    warn: 'border-amber-400/25 bg-amber-400/10 text-amber-200',
    neutral: 'border-white/10 bg-white/[0.04] text-paper/60',
  }
  return (
    <span
      className={`inline-flex flex-none items-center rounded-full border px-2.5 py-1 text-[11px] font-medium ${tones[tone]}`}
    >
      {children}
    </span>
  )
}

// Filters are a selection, not a commitment, so they use the neutral segmented
// treatment rather than a row of red primary buttons — red is reserved for the
// action that actually changes something.
function FilterRow({ options, value, onChange, ariaLabel }) {
  return (
    <div className="-mx-4 overflow-x-auto px-4 sm:mx-0 sm:px-0">
      <SegmentedControl options={options} value={value} onChange={onChange} ariaLabel={ariaLabel} />
    </div>
  )
}

export default function AdminActivity() {
  const navigate = useNavigate()
  const [view, setView] = useState('audit')
  const [actionFilter, setActionFilter] = useState('all')
  const [emailFilter, setEmailFilter] = useState('all')
  const [auditRows, setAuditRows] = useState([])
  const [emailRows, setEmailRows] = useState([])
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)
  const [refreshedAt, setRefreshedAt] = useState(null)

  const load = useCallback(async () => {
    setLoading(true)
    // Both logs are fetched together, so switching tabs is instant and the two
    // views always describe the same moment.
    const [audit, email] = await Promise.all([
      adminFetch(`/api/admin/audit-log?action=${actionFilter}&limit=200`),
      adminFetch(`/api/admin/email-log?status=${emailFilter}&limit=200`),
    ])
    const failed = !audit.ok ? audit : !email.ok ? email : null
    if (audit.ok) setAuditRows(audit.data.entries ?? [])
    if (email.ok) setEmailRows(email.data.entries ?? [])
    setError(failed ? failed.data.error || 'Could not load the logs.' : '')
    setRefreshedAt(new Date())
    setLoading(false)
  }, [actionFilter, emailFilter])

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

  return (
    <div className="space-y-5">
      {error && <Alert>{error}</Alert>}

      <SegmentedControl options={VIEWS} value={view} onChange={setView} ariaLabel="Log to show" />

      <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
        <div className="min-w-0 flex-1">
          <RefreshBar
            left={view === 'audit' ? `${auditRows.length} actions` : `${emailRows.length} emails`}
            refreshedAt={refreshedAt}
            loading={loading}
            onRefresh={load}
          />
        </div>
        {view === 'audit' ? (
          <ExportCsvButton rows={auditRows} fields={AUDIT_EXPORT_FIELDS} filename="tedxklh-activity.csv" />
        ) : (
          <ExportCsvButton rows={emailRows} fields={EMAIL_EXPORT_FIELDS} filename="tedxklh-emails.csv" />
        )}
      </div>

      {view === 'audit' ? (
        <>
          <FilterRow
            options={ACTION_FILTERS}
            value={actionFilter}
            onChange={setActionFilter}
            ariaLabel="Filter admin actions"
          />
          <AuditList rows={auditRows} loading={loading} />
        </>
      ) : (
        <>
          <FilterRow
            options={EMAIL_FILTERS}
            value={emailFilter}
            onChange={setEmailFilter}
            ariaLabel="Filter ticket emails"
          />
          <EmailList rows={emailRows} loading={loading} />
        </>
      )}
    </div>
  )
}

function AuditList({ rows, loading }) {
  if (!rows.length) {
    return (
      <Card pad="none">
        <EmptyState hint="Sign-ins, scans and pass resends are all recorded here.">
          {loading ? 'Loading activity…' : 'No activity recorded yet'}
        </EmptyState>
      </Card>
    )
  }
  return (
    <Card pad="none" className="divide-y divide-white/[0.06]">
      {rows.map((row) => (
        <div key={row.id} className="flex flex-col gap-2 p-4 transition-colors hover:bg-white/[0.02] sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0 space-y-1">
            <div className="flex flex-wrap items-center gap-2">
              <Pill tone={row.result === 'failure' ? 'bad' : 'ok'}>
                {ACTION_LABELS[row.action] || row.action}
              </Pill>
              <span className="text-sm font-medium text-paper">{row.admin_username}</span>
              {row.admin_role === 'superadmin' && <Pill tone="warn">super</Pill>}
            </div>
            {/* The "which admin scanned which attendee" line. */}
            {row.target_name && (
              <p className="truncate text-sm text-paper/70">
                <span className="text-paper/40">
                  {row.target_type === 'admin' ? 'account: ' : 'attendee: '}
                </span>
                {row.target_name}
              </p>
            )}
            {row.detail && <p className="truncate text-xs text-paper/40">{row.detail}</p>}
          </div>
          <div className="flex-none text-left text-xs tabular-nums text-paper/35 sm:text-right">
            <div>{fmtDateTime(row.created_at)}</div>
            {row.ip && <div className="mt-0.5">{row.ip}</div>}
          </div>
        </div>
      ))}
    </Card>
  )
}

function EmailList({ rows, loading }) {
  if (!rows.length) {
    return (
      <Card pad="none">
        <EmptyState hint="Every pass email, automatic or resent, is logged here.">
          {loading ? 'Loading emails…' : 'No ticket emails logged yet'}
        </EmptyState>
      </Card>
    )
  }
  const tone = { sent: 'ok', failed: 'bad', skipped: 'warn' }
  return (
    <Card pad="none" className="divide-y divide-white/[0.06]">
      {rows.map((row) => (
        <div key={row.id} className="flex flex-col gap-2 p-4 transition-colors hover:bg-white/[0.02] sm:flex-row sm:items-start sm:justify-between">
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
