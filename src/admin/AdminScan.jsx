import { useEffect, useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Html5Qrcode } from 'html5-qrcode'
import { adminFetch, getToken, isSuperAdmin } from './api'
import { Button, Card, Field } from './ui'

const READER_ID = 'admin-qr-reader'
const DUPLICATE_WINDOW_MS = 3000
const AUTO_ADVANCE_MS = 3000

// Sized against the dimensions html5-qrcode reports for the ACTUAL video
// stream, which is what it crops against — not against the square CSS box the
// admin sees. The video used to render with object-cover, which crops visually
// while the library kept sampling the raw stream: the region an admin aimed at
// was not the region being scanned, and a pass held dead centre never decoded.
// The video is object-contain now so the two agree. Kept generous (90%) so a
// pass held anywhere near the centre lands inside the sampled area.
function qrbox(viewWidth, viewHeight) {
  const size = Math.max(180, Math.floor(Math.min(viewWidth, viewHeight) * 0.9))
  return { width: size, height: size }
}

// The two things that decide whether a pass reads instantly or only after the
// admin hunts for the focal plane:
//
//   focusMode: 'continuous' — without it the camera focuses ONCE when the
//   stream opens and then holds that distance, so every pass has to be
//   physically moved to wherever that plane happens to be.
//
//   resolution — the browser's default capture is far below sensor capability.
//   More pixels per QR module is what lets a code resolve at arm's length, and
//   it matters most for the common case of a pass shown on another phone's
//   screen. Requested as `ideal` so a device that cannot hit 1080p downgrades
//   instead of failing.
//
// `advanced` entries are best-effort by spec — a browser that does not know
// focusMode ignores that entry rather than rejecting the request — but the
// caller still falls back to a bare facingMode start if the whole set is
// refused.
const VIDEO_CONSTRAINTS = {
  facingMode: 'environment',
  width: { ideal: 1920 },
  height: { ideal: 1080 },
  advanced: [{ focusMode: 'continuous' }],
}

const SCAN_CONFIG = {
  fps: 24,
  qrbox,
  // A QR is never mirrored, so the library's default second pass over a
  // flipped copy of every frame is pure waste — turning it off halves the work
  // per frame and roughly doubles how fast a code is picked up.
  disableFlip: true,
  // Uses the platform's native detector where present (Android Chrome, recent
  // iOS Safari). Materially better at angles, glare and the low contrast of a
  // QR photographed off another phone's screen — which is how most attendees
  // present a pass at a gate.
  experimentalFeatures: { useBarCodeDetectorIfSupported: true },
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

    // Try for a high-resolution, continuously-focusing stream first, then fall
    // back to a bare facingMode request. The rich constraints are what make a
    // pass decode at arm's length instead of only in the camera's one fixed
    // focal plane — but focusMode is not universally supported, and a device
    // that rejects the whole constraint set must still get a working scanner
    // rather than an error card at the gate.
    Promise.resolve()
      .then(() => scanner.start(VIDEO_CONSTRAINTS, SCAN_CONFIG, onDecode, () => {}))
      .catch(() => scanner.start({ facingMode: 'environment' }, SCAN_CONFIG, onDecode, () => {}))
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

  // Auto-advance so the gate keeps a scan rhythm without a tap between every
  // attendee — 3s is enough to read the name off the result panel. "Scan
  // next" stays as a manual override so an admin who wants to linger on a
  // rejection, or move faster than 3s, still can.
  useEffect(() => {
    if (!result) return undefined
    const timer = setTimeout(scanNext, AUTO_ADVANCE_MS)
    return () => clearTimeout(timer)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [result])

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
        {/* Viewfinder — html5-qrcode injects its video into READER_ID. The
            wrapper reserves the space so the frame does not collapse to a
            hairline while the camera is still starting. Portrait (3:4) rather
            than square: a phone's rear stream is portrait, and object-contain
            letterboxed it into a small strip inside a square box — a bigger,
            correctly-shaped preview is what lets an admin frame a pass at a
            glance instead of hunting. object-contain (never cover) so the
            region shown and the region html5-qrcode samples stay identical. */}
        <div className={result || cameraError ? 'hidden' : 'space-y-3'}>
          <div className="relative aspect-[3/4] w-full overflow-hidden rounded-xl border border-white/10 bg-black">
            <div className="absolute inset-0 grid place-items-center text-sm text-paper/35">Starting camera…</div>
            <div
              id={READER_ID}
              className="relative h-full w-full [&_video]:h-full [&_video]:w-full [&_video]:object-contain"
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

      <Button variant="primary" size="lg" onClick={onNext} className="relative mt-7 w-full overflow-hidden">
        <span
          key={result}
          aria-hidden
          className="absolute inset-y-0 left-0 w-full origin-left bg-white/15 motion-reduce:hidden"
          style={{ animation: `admin-scan-advance ${AUTO_ADVANCE_MS}ms linear forwards` }}
        />
        <span className="relative">Scan next</span>
      </Button>
    </div>
  )
}
