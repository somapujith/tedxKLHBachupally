import { useCallback, useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { adminFetch, getToken, isSuperAdmin } from './api'
import { Alert, Button, Card, EmptyState, Input, Label, SearchIcon } from './ui'
import ExportCsvButton from './ExportCsvButton'

// Links an attendee to their college student ID. The public form never asks for
// one — requiring it would block guests, speakers and outside attendees — so an
// organiser fills them in afterwards by typing part of a name.
//
// Deliberately NOT a select-then-edit flow: a team working down a college list
// enters dozens of these, and every extra click is paid once per student. Each
// search hit carries its own input and Save, so the loop is type, tab, type,
// Enter.

const MIN_QUERY = 2
const DEBOUNCE_MS = 250

const ROLL_EXPORT_FIELDS = [
  { key: 'roll_number', label: 'Roll number' },
  { key: 'full_name', label: 'Name' },
  { key: 'email', label: 'Email' },
  { key: 'phone', label: 'Phone' },
  { key: 'college', label: 'College' },
  { key: 'payment_status', label: 'Payment status', default: false },
]

export default function AdminRollNumbers() {
  const navigate = useNavigate()
  const [query, setQuery] = useState('')
  const [rows, setRows] = useState([])
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [searched, setSearched] = useState(false)

  // Monotonic request id: typing fires overlapping searches, and a slow earlier
  // response landing last would paint results for a query already moved on from.
  const seq = useRef(0)

  const search = useCallback(async (term) => {
    const ticket = ++seq.current
    if (term.trim().length < MIN_QUERY) {
      setRows([])
      setSearched(false)
      setLoading(false)
      return
    }
    setLoading(true)
    const res = await adminFetch(`/api/admin/roll-numbers?q=${encodeURIComponent(term.trim())}`)
    if (ticket !== seq.current) return
    if (res.ok) setRows(res.data.registrants ?? [])
    setError(res.ok ? '' : res.data.error || 'Could not search registrants.')
    setSearched(true)
    setLoading(false)
  }, [])

  useEffect(() => {
    if (!getToken()) {
      navigate('/admin/login', { replace: true })
      return
    }
    // The server enforces this regardless; bouncing early just avoids showing a
    // screen that would only ever answer 403.
    if (!isSuperAdmin()) navigate('/admin', { replace: true })
  }, [navigate])

  // Debounced so a burst of keystrokes is one request, not one per key.
  useEffect(() => {
    const id = setTimeout(() => search(query), DEBOUNCE_MS)
    return () => clearTimeout(id)
  }, [query, search])

  // Applied in place rather than re-running the search: a re-fetch would re-sort
  // the row that was just saved (unlinked rows sort first) and yank it out from
  // under the cursor mid-entry.
  function applySaved(saved) {
    setRows((prev) => prev.map((r) => (r.id === saved.id ? { ...r, roll_number: saved.roll_number } : r)))
  }

  const linked = rows.filter((r) => r.roll_number).length

  return (
    <section className="space-y-4">
      {error && <Alert>{error}</Alert>}

      <Card pad="none" className="p-4 md:p-5">
        <Label>How this works</Label>
        <p className="mt-2 text-sm leading-relaxed text-paper/55">
          Type at least {MIN_QUERY} letters of a name or email, then enter that person’s roll number
          and save. Verified attendees only. Rows still missing a number are listed first, and
          clearing a field unlinks it.
        </p>
      </Card>

      <div className="relative">
        <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-paper/35">
          <SearchIcon />
        </span>
        <Input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Start typing a verified attendee’s name or email…"
          aria-label="Search verified attendees by name or email"
          autoFocus
          className="pl-9"
        />
      </div>

      {rows.length > 0 && (
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <span className="text-xs text-paper/45">
            {loading ? 'Searching…' : `${rows.length} match${rows.length === 1 ? '' : 'es'} · ${linked} linked`}
          </span>
          <ExportCsvButton
            rows={rows.filter((r) => r.roll_number)}
            fields={ROLL_EXPORT_FIELDS}
            filename="tedxklh-roll-numbers.csv"
          />
        </div>
      )}

      {rows.length === 0 ? (
        <Card pad="none">
          <EmptyState
            hint={
              query.trim().length < MIN_QUERY
                ? `Enter at least ${MIN_QUERY} letters to search the register.`
                : 'No verified attendee matches that name or email.'
            }
          >
            {loading
              ? 'Searching…'
              : query.trim().length < MIN_QUERY
                ? 'Search for an attendee'
                : searched
                  ? 'Nothing found'
                  : 'Search for an attendee'}
          </EmptyState>
        </Card>
      ) : (
        <ul className="space-y-2.5">
          {rows.map((row) => (
            <li key={row.id}>
              <RollRow row={row} onSaved={applySaved} />
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}

function RollRow({ row, onSaved }) {
  const [value, setValue] = useState(row.roll_number ?? '')
  const [busy, setBusy] = useState(false)
  const [note, setNote] = useState('')
  const [failed, setFailed] = useState(false)

  // A fresh search can reuse this component for a different person; without this
  // the previous attendee's typed value would persist into their row.
  useEffect(() => {
    setValue(row.roll_number ?? '')
    setNote('')
    setFailed(false)
  }, [row.id, row.roll_number])

  const dirty = value.trim().toUpperCase() !== (row.roll_number ?? '')

  async function save() {
    if (!dirty || busy) return
    setBusy(true)
    setNote('')
    setFailed(false)
    const { ok, data } = await adminFetch('/api/admin/roll-numbers', {
      method: 'POST',
      body: { registrationId: row.id, rollNumber: value },
    })
    setBusy(false)
    if (!ok) {
      setFailed(true)
      setNote(data.error || 'Could not save.')
      return
    }
    setNote(data.registrant?.roll_number ? 'Saved' : 'Cleared')
    onSaved(data.registrant)
  }

  return (
    <Card pad="sm">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className="truncate text-[15px] font-medium tracking-tight">{row.full_name ?? '—'}</span>
            {row.roll_number && (
              <span className="flex-none rounded-full border border-emerald-400/25 bg-emerald-400/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-emerald-300">
                Linked
              </span>
            )}
          </div>
          <div className="mt-0.5 truncate text-xs text-paper/45">
            {row.email ?? '—'}
            {row.phone ? ` · ${row.phone}` : ''}
          </div>
          <div className="mt-0.5 truncate text-xs text-paper/35">
            {row.college_other || row.college || 'No college on file'}
          </div>
        </div>
        {/* Arrival state, not payment: the search only returns verified
            attendees, so a "Verified" badge on every row would say nothing.
            Whether they are already through the gate does differ row to row. */}
        {row.checked_in_at && (
          <span className="flex-none rounded-full border border-sky-400/25 bg-sky-400/10 px-2 py-0.5 text-[11px] font-medium text-sky-300">
            Checked in
          </span>
        )}
      </div>

      <form
        onSubmit={(e) => {
          e.preventDefault()
          save()
        }}
        className="mt-3 flex flex-wrap items-center gap-2 border-t border-white/10 pt-3"
      >
        <Input
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder="Roll number"
          aria-label={`Roll number for ${row.full_name ?? 'this attendee'}`}
          className="w-full font-mono uppercase sm:w-56"
        />
        <Button type="submit" variant={dirty ? 'primary' : 'subtle'} size="md" disabled={busy || !dirty}>
          {busy ? 'Saving…' : 'Save'}
        </Button>
        {note && (
          <span className={`text-xs ${failed ? 'text-red' : 'text-emerald-300'}`}>{note}</span>
        )}
      </form>
    </Card>
  )
}
