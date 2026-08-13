import { useCallback, useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { adminFetch, getToken, isSuperAdmin } from './api'
import { Alert, Card, EmptyState, Input, Label, RefreshBar, SearchIcon } from './ui'
import ExportCsvButton from './ExportCsvButton'

// Mirrors exactly what listVerifiedPayments returns (server/payments.js).
const PAYMENT_EXPORT_FIELDS = [
  { key: 'full_name', label: 'Name' },
  { key: 'email', label: 'Email' },
  { key: 'phone', label: 'Phone' },
  { key: 'designation', label: 'Designation' },
  { key: 'college', label: 'College' },
  { key: 'college_other', label: 'College (other)', default: false },
  { key: 'utr_id', label: 'UTR' },
  { key: 'amount', label: 'Amount' },
  // Reconciliation needs the reason a line differs from the list price, not
  // just the net figure. Blank on full-price rows.
  { key: 'coupon_code', label: 'Coupon code' },
  { key: 'discount_amount', label: 'Discount' },
  { key: 'submitted_at', label: 'Submitted at', default: false },
  { key: 'verified_at', label: 'Verified at' },
  { key: 'verified_by', label: 'Verified by' },
  { key: 'paid_at', label: 'Paid at', default: false },
  { key: 'checked_in_at', label: 'Checked in at' },
  { key: 'ticket_issued', label: 'Ticket issued', value: (r) => (r.ticket_issued ? 'yes' : 'no'), default: false },
  { key: 'ticket_revoked', label: 'Ticket revoked', value: (r) => (r.ticket_revoked ? 'yes' : 'no'), default: false },
  { key: 'id', label: 'Registration ID', default: false },
]

// The verified-payment ledger. Every approved bank transfer with the UTR
// reference front and centre, because reconciliation starts from a line on a
// bank statement and works back to an attendee.
//
// Search is server-side (it matches UTR, name and email) rather than filtering
// an already-fetched page: the whole point is finding one reference among
// hundreds, and a client-side filter would only ever search the rows that
// happened to fit under the limit.

function fmtRupees(rupees) {
  const n = Number(rupees)
  if (!Number.isFinite(n)) return '—'
  return `₹${n.toLocaleString('en-IN')}`
}

function fmtDateTime(value) {
  if (!value) return '—'
  const d = new Date(value)
  return Number.isNaN(d.getTime())
    ? String(value)
    : d.toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'Asia/Kolkata' })
}

export default function AdminPayments() {
  const navigate = useNavigate()
  const [rows, setRows] = useState([])
  const [totals, setTotals] = useState({ count: 0, amount: 0 })
  const [search, setSearch] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)
  const [refreshedAt, setRefreshedAt] = useState(null)

  // Monotonic request id: typing in the search box fires overlapping requests,
  // and a slow earlier response landing last would paint results for a query
  // the admin has already moved on from.
  const seq = useRef(0)

  const load = useCallback(async (q) => {
    const ticket = ++seq.current
    setLoading(true)
    const query = q ? `?search=${encodeURIComponent(q)}` : ''
    const res = await adminFetch(`/api/admin/payments${query}`)
    if (ticket !== seq.current) return
    if (res.ok) {
      setRows(res.data.payments ?? [])
      setTotals({ count: res.data.totalCount ?? 0, amount: res.data.totalAmount ?? 0 })
    }
    setError(res.ok ? '' : res.data.error || 'Could not load payments.')
    setRefreshedAt(new Date())
    setLoading(false)
  }, [])

  useEffect(() => {
    if (!getToken()) {
      navigate('/admin/login', { replace: true })
      return
    }
    // The server enforces this regardless; bouncing early just avoids showing a
    // gate admin a screen that would only ever answer 403.
    if (!isSuperAdmin()) {
      navigate('/admin', { replace: true })
      return
    }
    load('')
  }, [navigate, load])

  // Debounced search so a burst of keystrokes is one request, not one per key.
  useEffect(() => {
    if (!getToken() || !isSuperAdmin()) return
    const id = setTimeout(() => load(search.trim()), 300)
    return () => clearTimeout(id)
  }, [search, load])

  return (
    <section className="space-y-4">
      {error && <Alert>{error}</Alert>}

      <div className="grid grid-cols-2 gap-3 md:gap-4">
        <Card pad="none" className="p-4 md:p-5">
          <Label>Verified payments</Label>
          <div className="mt-3 text-[28px] font-semibold leading-none tracking-tight tabular-nums md:text-[32px]">
            {totals.count}
          </div>
        </Card>
        <Card pad="none" className="p-4 md:p-5">
          <Label>Total collected</Label>
          <div className="mt-3 text-[28px] font-semibold leading-none tracking-tight tabular-nums md:text-[32px]">
            {fmtRupees(totals.amount)}
          </div>
        </Card>
      </div>

      <div className="relative">
        <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-paper/35">
          <SearchIcon />
        </span>
        <Input
          type="search"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search UTR ID, name or email"
          aria-label="Search verified payments"
          className="pl-9"
        />
      </div>

      <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
        <div className="min-w-0 flex-1">
          <RefreshBar
            left={
              loading
                ? 'Loading…'
                : search.trim()
                  ? `${rows.length} matching ${rows.length === 1 ? 'payment' : 'payments'}`
                  : `${rows.length} shown of ${totals.count}`
            }
            refreshedAt={refreshedAt}
            loading={loading}
            onRefresh={() => load(search.trim())}
          />
        </div>
        <ExportCsvButton rows={rows} fields={PAYMENT_EXPORT_FIELDS} filename="tedxklh-payments.csv" />
      </div>

      {/* Mobile: one card per payment. */}
      <div className="space-y-3 md:hidden">
        {rows.length === 0 && !loading && (
          <Card>
            <EmptyState
              hint={
                search.trim()
                  ? 'Try the full UTR reference, or the attendee’s name.'
                  : 'Approved bank transfers are listed here with their reference.'
              }
            >
              {search.trim() ? 'No payment matches that search' : 'No verified payments yet'}
            </EmptyState>
          </Card>
        )}
        {rows.map((row) => (
          <Card key={row.id} pad="sm">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="truncate text-sm font-medium text-paper">{row.full_name}</div>
                <div className="truncate text-xs text-paper/50">{row.email}</div>
              </div>
              <div className="shrink-0 text-right">
                <div className="text-sm font-semibold tabular-nums text-paper">
                  {fmtRupees(row.amount)}
                </div>
                {row.coupon_code && (
                  <div className="mt-0.5 text-[11px] font-medium tracking-wide text-red">
                    {row.coupon_code}
                  </div>
                )}
              </div>
            </div>
            <div className="mt-3 rounded-lg border border-white/[0.07] bg-black/25 px-3 py-2">
              <Label className="text-[10px]">UTR ID</Label>
              <div className="mt-0.5 select-all font-mono text-sm tracking-wider text-paper">
                {row.utr_id || '—'}
              </div>
            </div>
            <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-paper/45">
              <span>Verified {fmtDateTime(row.verified_at)}</span>
              {row.verified_by && <span>by {row.verified_by}</span>}
              {row.checked_in_at && <span className="text-paper/60">Checked in</span>}
              {row.ticket_revoked && <span className="text-red">Pass revoked</span>}
            </div>
          </Card>
        ))}
      </div>

      {/* Desktop: dense ledger table. */}
      <Card pad="none" className="hidden overflow-hidden md:block">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[820px] text-left text-sm">
            <thead>
              <tr className="border-b border-white/10 bg-white/[0.02] text-[11px] font-medium uppercase tracking-[0.08em] text-paper/45">
                <th className="px-4 py-3 font-medium">UTR ID</th>
                <th className="px-4 py-3 font-medium">Attendee</th>
                <th className="px-4 py-3 text-right font-medium">Amount</th>
                <th className="px-4 py-3 font-medium">Verified</th>
                <th className="px-4 py-3 font-medium">By</th>
                <th className="px-4 py-3 font-medium">Pass</th>
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 && (
                <tr>
                  <td colSpan={6} className="p-0">
                    <EmptyState
                      hint={
                        search.trim()
                          ? 'Try the full UTR reference, or the attendee’s name.'
                          : 'Approved bank transfers are listed here with their reference.'
                      }
                    >
                      {loading
                        ? 'Loading payments…'
                        : search.trim()
                          ? 'No payment matches that search'
                          : 'No verified payments yet'}
                    </EmptyState>
                  </td>
                </tr>
              )}
              {rows.map((row) => (
                <tr
                  key={row.id}
                  className="border-b border-white/[0.06] transition-colors last:border-0 hover:bg-white/[0.03]"
                >
                  {/* select-all so one click copies the reference for pasting
                      into a bank statement search. */}
                  <td className="whitespace-nowrap px-4 py-3">
                    <span className="select-all font-mono tracking-wider text-paper">
                      {row.utr_id || '—'}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="text-paper">{row.full_name}</div>
                    <div className="text-xs text-paper/45">{row.email}</div>
                  </td>
                  {/* Coupon sits under the figure rather than in its own
                      column: it explains why this line differs from the list
                      price, and it is blank on most rows. */}
                  <td className="whitespace-nowrap px-4 py-3 text-right tabular-nums text-paper">
                    {fmtRupees(row.amount)}
                    {row.coupon_code && (
                      <div className="mt-1 text-xs font-medium tracking-wide text-red">
                        {row.coupon_code}
                        {row.discount_amount !== null && row.discount_amount !== undefined && (
                          <span className="ml-1.5 font-normal text-paper/40">
                            −{fmtRupees(row.discount_amount)}
                          </span>
                        )}
                      </div>
                    )}
                  </td>
                  <td className="whitespace-nowrap px-4 py-3 text-xs text-paper/60">
                    {fmtDateTime(row.verified_at)}
                  </td>
                  <td className="whitespace-nowrap px-4 py-3 text-xs text-paper/60">
                    {row.verified_by || '—'}
                  </td>
                  <td className="whitespace-nowrap px-4 py-3 text-xs">
                    {row.ticket_revoked ? (
                      <span className="text-red">Revoked</span>
                    ) : row.checked_in_at ? (
                      <span className="text-emerald-300">Checked in</span>
                    ) : row.ticket_issued ? (
                      <span className="text-paper/60">Issued</span>
                    ) : (
                      <span className="text-paper/40">—</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </section>
  )
}
