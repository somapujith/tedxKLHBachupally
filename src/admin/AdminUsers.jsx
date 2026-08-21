import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { adminFetch, getToken } from './api'
import { Alert, Card, EmptyState, Input, Label, RefreshBar, SearchIcon } from './ui'
import ExportCsvButton from './ExportCsvButton'

const USER_EXPORT_FIELDS = [
  { key: 'full_name', label: 'Name' },
  { key: 'email', label: 'Email' },
  { key: 'phone', label: 'Phone' },
  { key: 'college', label: 'College' },
  { key: 'checked_in_at', label: 'Checked in at' },
]

function matches(row, q) {
  if (!q) return true
  const hay = `${row.full_name ?? ''} ${row.email ?? ''} ${row.phone ?? ''} ${row.college ?? ''}`.toLowerCase()
  return hay.includes(q)
}

// Every attendee whose payment has been verified — payment_status stays 'paid'
// after check-in (only checked_in_at gets set), so this one filter is the
// complete "total verified users" list regardless of whether they've walked in.
export default function AdminUsers() {
  const navigate = useNavigate()
  const [rows, setRows] = useState([])
  const [search, setSearch] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)
  const [refreshedAt, setRefreshedAt] = useState(null)

  // Monotonic request id — auto-refresh and a manual refresh can overlap;
  // without this a slow earlier response landing last could repaint a stale list.
  const seq = useRef(0)

  const load = useCallback(async () => {
    const ticket = ++seq.current
    setLoading(true)
    const res = await adminFetch('/api/admin/registrations?status=paid')
    if (ticket !== seq.current) return
    if (res.ok) setRows(res.data.registrations ?? [])
    setError(res.ok ? '' : res.data.error || 'Could not load verified users.')
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
    }, 30000)
    return () => clearInterval(id)
  }, [load])

  const q = search.trim().toLowerCase()
  const visible = useMemo(() => rows.filter((r) => matches(r, q)), [rows, q])

  return (
    <section className="space-y-4">
      {error && <Alert>{error}</Alert>}

      <Card pad="none" className="p-4 md:p-5">
        <Label>Verified users</Label>
        <div className="mt-3 text-[28px] font-semibold leading-none tracking-tight tabular-nums md:text-[32px]">
          {loading && rows.length === 0 ? (
            <span className="inline-block h-7 w-20 animate-pulse rounded-md bg-white/10 align-middle motion-reduce:animate-none" />
          ) : (
            rows.length
          )}
        </div>
      </Card>

      <div className="relative">
        <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-paper/35">
          <SearchIcon />
        </span>
        <Input
          type="search"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search name, email, phone or college"
          aria-label="Search verified users"
          className="pl-9"
        />
      </div>

      <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
        <div className="min-w-0 flex-1">
          <RefreshBar
            left={loading ? 'Loading…' : `${visible.length} ${visible.length === 1 ? 'user' : 'users'}`}
            refreshedAt={refreshedAt}
            loading={loading}
            onRefresh={load}
          />
        </div>
        <ExportCsvButton rows={visible} fields={USER_EXPORT_FIELDS} filename="tedxklh-verified-users.csv" />
      </div>

      {/* Mobile: cards. */}
      <div className="space-y-3 md:hidden">
        {visible.length === 0 && !loading && (
          <Card>
            <EmptyState
              hint={
                q
                  ? 'Try a different name, email or phone.'
                  : 'Verified users appear here once a payment is approved.'
              }
            >
              {q ? 'No match for that search' : 'No verified users yet'}
            </EmptyState>
          </Card>
        )}
        {visible.map((row) => (
          <UserCard key={row.id} row={row} />
        ))}
      </div>

      {/* Desktop: table. */}
      <Card pad="none" className="hidden overflow-hidden md:block">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[720px] text-left text-sm">
            <thead>
              <tr className="border-b border-white/10 bg-white/[0.02] text-[11px] font-medium uppercase tracking-[0.08em] text-paper/45">
                <th className="px-4 py-3 font-medium">Name</th>
                <th className="px-4 py-3 font-medium">Email</th>
                <th className="px-4 py-3 font-medium">Phone</th>
                <th className="px-4 py-3 text-right font-medium">Uploaded image</th>
              </tr>
            </thead>
            <tbody>
              {visible.length === 0 && (
                <tr>
                  <td colSpan={4} className="p-0">
                    <EmptyState
                      hint={
                        q
                          ? 'Try a different name, email or phone.'
                          : 'Verified users appear here once a payment is approved.'
                      }
                    >
                      {loading ? 'Loading verified users…' : q ? 'No match for that search' : 'No verified users yet'}
                    </EmptyState>
                  </td>
                </tr>
              )}
              {visible.map((row) => (
                <UserRow key={row.id} row={row} />
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </section>
  )
}

// Proof state, shared by the mobile card and desktop row. Fetched on demand —
// one image at a time, only when an admin actually opens a row — the same
// reasoning as the payment-verification queue: a screen of N attendees pulling
// every screenshot at once would be megabytes for nothing.
function useProof(id) {
  const [open, setOpen] = useState(false)
  const [proof, setProof] = useState(null)
  const [proofError, setProofError] = useState('')
  const [loadingProof, setLoadingProof] = useState(false)

  const load = useCallback(async () => {
    setProof(null)
    setProofError('')
    setLoadingProof(true)
    const { ok, data } = await adminFetch(`/api/admin/verifications?id=${id}`)
    if (ok && data.proof) {
      setProof(data.proof)
    } else if (data.error === 'No payment proof on file.') {
      setProof(null) // genuinely nothing uploaded — the empty state is correct
    } else {
      setProofError(data.error || 'Could not load the uploaded image. Try again.')
    }
    setLoadingProof(false)
  }, [id])

  async function toggle() {
    if (open) {
      setOpen(false)
      return
    }
    setOpen(true)
    await load()
  }

  return { open, proof, proofError, loadingProof, toggle, retry: load }
}

function ProofPanel({ proof, proofError, loadingProof, name, onRetry }) {
  if (loadingProof) {
    return (
      <div className="h-40 w-full animate-pulse rounded-lg border border-white/10 bg-white/[0.05] motion-reduce:animate-none" />
    )
  }
  if (proof) {
    return (
      <a
        href={proof}
        target="_blank"
        rel="noreferrer"
        className="group block w-fit overflow-hidden rounded-lg border border-white/10 transition-colors hover:border-white/25"
      >
        <img
          src={proof}
          alt={`Uploaded image from ${name}`}
          className="max-h-72 w-auto transition-transform duration-300 group-hover:scale-[1.02] motion-reduce:transform-none"
        />
      </a>
    )
  }
  if (proofError) {
    return (
      <div className="rounded-lg border border-red/30 bg-red/10 px-3 py-2">
        <p className="text-xs text-red">{proofError}</p>
        <button
          type="button"
          onClick={onRetry}
          className="mt-1 text-xs text-paper/60 underline underline-offset-2 hover:text-paper"
        >
          Retry
        </button>
      </div>
    )
  }
  return (
    <p className="rounded-lg border border-dashed border-white/10 px-3 py-6 text-center text-xs text-paper/40">
      No image on file.
    </p>
  )
}

function UserCard({ row }) {
  const { open, proof, proofError, loadingProof, toggle, retry } = useProof(row.id)
  return (
    <Card pad="sm">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="truncate text-[15px] font-medium tracking-tight">{row.full_name ?? '—'}</div>
          <div className="mt-0.5 truncate text-xs text-paper/45">{row.college ?? '—'}</div>
        </div>
        {row.checked_in_at && (
          <span className="flex-none rounded-full border border-sky-400/25 bg-sky-400/10 px-2 py-0.5 text-[11px] font-medium text-sky-300">
            Checked in
          </span>
        )}
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm">
        {row.phone && (
          <a href={`tel:${row.phone}`} className="text-red underline-offset-4 hover:underline">
            {row.phone}
          </a>
        )}
        <span className="truncate text-paper/55">{row.email ?? '—'}</span>
      </div>

      <button
        type="button"
        onClick={toggle}
        className="mt-3 text-xs font-medium text-paper/70 underline underline-offset-4 hover:text-paper"
      >
        {open ? 'Hide image' : 'View uploaded image'}
      </button>

      {open && (
        <div className="mt-3 border-t border-white/10 pt-3">
          <ProofPanel proof={proof} proofError={proofError} loadingProof={loadingProof} name={row.full_name} onRetry={retry} />
        </div>
      )}
    </Card>
  )
}

function UserRow({ row }) {
  const { open, proof, proofError, loadingProof, toggle, retry } = useProof(row.id)
  return (
    <>
      <tr className="border-b border-white/[0.06] align-top transition-colors last:border-0 hover:bg-white/[0.02]">
        <td className="px-4 py-3">
          <div className="font-medium text-paper/90">{row.full_name ?? '—'}</div>
          <div className="mt-0.5 text-xs text-paper/45">{row.college ?? '—'}</div>
          {row.checked_in_at && <div className="mt-1 text-[11px] text-sky-300">Checked in</div>}
        </td>
        <td className="px-4 py-3 text-paper/75">{row.email ?? '—'}</td>
        <td className="px-4 py-3 text-paper/75">{row.phone ?? '—'}</td>
        <td className="px-4 py-3 text-right">
          <button
            type="button"
            onClick={toggle}
            className="text-xs font-medium text-paper/70 underline underline-offset-4 hover:text-paper"
          >
            {open ? 'Hide' : 'View'}
          </button>
        </td>
      </tr>
      {open && (
        <tr className="border-b border-white/[0.06] last:border-0">
          <td colSpan={4} className="bg-black/20 px-4 py-3">
            <ProofPanel proof={proof} proofError={proofError} loadingProof={loadingProof} name={row.full_name} onRetry={retry} />
          </td>
        </tr>
      )}
    </>
  )
}
