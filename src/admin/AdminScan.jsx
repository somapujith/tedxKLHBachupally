import { useEffect, useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Html5Qrcode } from 'html5-qrcode'
import { adminFetch, getToken, isSuperAdmin } from './api'
import { Button, Card, Field } from './ui'

const READER_ID = 'admin-qr-reader'
const DUPLICATE_WINDOW_MS = 3000

function qrbox(viewWidth, viewHeight) {
  const size = Math.max(180, Math.floor(Math.min(viewWidth, viewHeight) * 0.75))
  return { width: size, height: size }
}

export default function AdminScan() {
  const navigate = useNavigate()
  const [result, setResult] = useState(null)
  const [cameraError, setCameraError] = useState('')
  const [manualToken, setManualToken] = useState('')
  const [busy, setBusy] = useState(false)
  const scannerRef = useRef(null)
  // Gate for the decode callback (stale-closure safe): locks while a check-in
  // is in flight or a result is on screen; tracks last decode for debounce.
  const gateRef = useRef({ locked: false, lastText: '', lastAt: 0 })

  async function checkin(token) {
    if (!token) return
    gateRef.current.locked = true
    setBusy(true)
    try {
      scannerRef.current?.pause(true)
    } catch {
      /* not scanning (manual entry path) */
    }
    const { status, data } = await adminFetch('/api/admin/checkin', {
      method: 'POST',
      body: JSON.stringify({ token }),
    })
    if (status === 200 && data.ok) {
      setResult({ kind: 'verified', attendee: data.attendee ?? {} })
    } else if (status === 409 && data.alreadyCheckedIn) {
      setResult({ kind: 'used', attendee: data.attendee ?? {}, error: data.error })
    } else {
      setResult({ kind: 'invalid', error: data.error || 'Ticket not recognized.' })
    }
    setBusy(false)
  }

  useEffect(() => {
    if (!getToken()) {
      navigate('/admin/login', { replace: true })
      return undefined
    }
    const scanner = new Html5Qrcode(READER_ID)
    scannerRef.current = scanner

    const onDecode = (text) => {
      const gate = gateRef.current
      const now = Date.now()
      const duplicate = text === gate.lastText && now - gate.lastAt < DUPLICATE_WINDOW_MS
      if (gate.locked || duplicate) return
      gateRef.current = { locked: true, lastText: text, lastAt: now }
      checkin(text)
    }

    scanner
      .start({ facingMode: 'environment' }, { fps: 10, qrbox }, onDecode, () => {})
      .catch((err) => {
        setCameraError(
          err?.name === 'NotAllowedError' || /permission/i.test(String(err))
            ? 'Camera access was denied. Allow camera permission in your browser, or paste the ticket code below.'
            : 'Could not start the camera on this device. Paste the ticket code below instead.',
        )
      })

    return () => {
      const s = scannerRef.current
      scannerRef.current = null
      if (!s) return
      Promise.resolve()
        .then(() => s.stop())
        .then(() => s.clear())
        .catch(() => {})
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [navigate])

  function scanNext() {
    setResult(null)
    gateRef.current = { ...gateRef.current, locked: false }
    try {
      scannerRef.current?.resume()
    } catch {
      /* camera never started — manual mode */
    }
  }

  function onManualSubmit(e) {
    e.preventDefault()
    const token = manualToken.trim()
    if (!token || busy) return
    setManualToken('')
    checkin(token)
  }

  return (
    <div className="min-h-screen bg-ink font-body text-paper">
      <header className="sticky top-0 z-40 border-b border-white/10 bg-ink/80 backdrop-blur-xl">
        <div className="mx-auto flex h-14 max-w-2xl items-center justify-between gap-4 px-4 sm:px-6">
          <div className="flex items-center gap-2.5">
            <span aria-hidden className="h-2 w-2 rounded-full bg-red" />
            <span className="text-sm font-semibold tracking-tight">Gate check-in</span>
          </div>
          <Link
            to={isSuperAdmin() ? '/admin' : '/admin/checked-in'}
            className="rounded-lg px-2.5 py-1.5 text-sm text-paper/55 transition-colors hover:bg-white/[0.06] hover:text-paper"
          >
            Close
          </Link>
        </div>
      </header>

      <main className="mx-auto max-w-2xl space-y-4 px-4 py-7 sm:px-6">
        {/* Viewfinder — html5-qrcode injects its video into READER_ID. The square
            wrapper reserves the space so the frame does not collapse to a hairline
            while the camera is still starting. */}
        <div className={result || cameraError ? 'hidden' : 'space-y-3'}>
          <div className="relative aspect-square w-full overflow-hidden rounded-xl border border-white/10 bg-black">
            <div className="absolute inset-0 grid place-items-center text-sm text-paper/35">Starting camera…</div>
            <div
              id={READER_ID}
              className="relative h-full w-full [&_video]:h-full [&_video]:w-full [&_video]:object-cover"
            />
          </div>
          <p className="text-center text-sm text-paper/45">
            {busy ? 'Checking ticket…' : 'Point the camera at the attendee’s QR pass'}
          </p>
        </div>

        {cameraError && !result && (
          <Card className="space-y-4 p-5">
            <p className="rounded-lg border border-amber-400/30 bg-amber-400/10 px-4 py-3 text-sm leading-relaxed text-amber-200">
              {cameraError}
            </p>
            <form onSubmit={onManualSubmit} className="space-y-3">
              <Field id="manual-token" label="Ticket code">
                <textarea
                  id="manual-token"
                  rows={3}
                  value={manualToken}
                  onChange={(e) => setManualToken(e.target.value)}
                  placeholder="Paste the QR token here"
                  className="w-full resize-y rounded-lg border border-white/10 bg-white/[0.03] px-3 py-2.5 font-mono text-sm text-paper transition-colors placeholder:text-paper/30 hover:border-white/20 focus:border-red/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red/60 focus-visible:ring-offset-2 focus-visible:ring-offset-ink"
                />
              </Field>
              <Button type="submit" variant="primary" size="lg" disabled={busy || !manualToken.trim()} className="w-full">
                {busy ? 'Checking…' : 'Check in'}
              </Button>
            </form>
          </Card>
        )}

        {result && <ScanResult result={result} onNext={scanNext} />}
      </main>
    </div>
  )
}

function fmtCheckedIn(value) {
  if (!value) return '—'
  const d = new Date(value)
  return Number.isNaN(d.getTime())
    ? String(value)
    : d.toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'Asia/Kolkata' })
}

const PANELS = {
  verified: {
    frame: 'border-emerald-400/30 bg-emerald-400/[0.07]',
    accent: 'text-emerald-300',
    chip: 'bg-emerald-400/15 text-emerald-300',
    title: 'Verified',
    glyph: 'check',
  },
  used: {
    frame: 'border-amber-400/30 bg-amber-400/[0.07]',
    accent: 'text-amber-300',
    chip: 'bg-amber-400/15 text-amber-300',
    title: 'Already checked in',
    glyph: 'alert',
  },
  invalid: {
    frame: 'border-red/30 bg-red/[0.08]',
    accent: 'text-red',
    chip: 'bg-red/15 text-red',
    title: 'Invalid ticket',
    glyph: 'cross',
  },
}

function Glyph({ kind }) {
  const paths = {
    check: <path d="M5 12.5l4.5 4.5L19 7.5" strokeLinecap="round" strokeLinejoin="round" />,
    alert: (
      <>
        <path d="M12 7v6" strokeLinecap="round" />
        <circle cx="12" cy="17" r="1" fill="currentColor" stroke="none" />
      </>
    ),
    cross: <path d="M7 7l10 10M17 7L7 17" strokeLinecap="round" />,
  }
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" className="h-8 w-8" aria-hidden>
      {paths[kind]}
    </svg>
  )
}

function ScanResult({ result, onNext }) {
  const panel = PANELS[result.kind] ?? PANELS.invalid
  const attendee = result.attendee ?? {}

  return (
    <div className={`rounded-2xl border p-6 text-center sm:p-8 ${panel.frame}`} role="status" aria-live="assertive">
      <div className={`mx-auto flex h-14 w-14 items-center justify-center rounded-full ${panel.chip}`}>
        <Glyph kind={panel.glyph} />
      </div>

      <div className={`mt-4 text-2xl font-semibold tracking-tight sm:text-3xl ${panel.accent}`}>{panel.title}</div>

      {result.kind === 'verified' && (
        <div className="mt-5">
          <div className="text-2xl font-semibold tracking-tight text-paper sm:text-3xl">
            {attendee.full_name ?? '—'}
          </div>
          <div className="mt-1 text-sm capitalize text-paper/50">{attendee.designation ?? '—'}</div>
        </div>
      )}

      {result.kind === 'used' && (
        <div className="mt-5">
          <div className="text-xl font-semibold tracking-tight text-paper sm:text-2xl">
            {attendee.full_name ?? '—'}
          </div>
          <div className="mt-1 text-sm text-paper/50">
            {fmtCheckedIn(attendee.checked_in_at)}
            {attendee.checked_in_by ? ` · by ${attendee.checked_in_by}` : ''}
          </div>
        </div>
      )}

      {result.kind === 'invalid' && <p className="mt-4 text-sm text-paper/60">{result.error}</p>}

      <Button variant="primary" size="lg" onClick={onNext} className="mt-7 w-full">
        Scan next
      </Button>
    </div>
  )
}
