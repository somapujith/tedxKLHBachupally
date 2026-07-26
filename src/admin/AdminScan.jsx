import { useEffect, useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Html5Qrcode } from 'html5-qrcode'
import { Eyebrow } from '../components/ui'
import { adminFetch, getToken } from './api'

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
    <div className="min-h-screen bg-ink text-paper">
      <header className="sticky top-0 z-40 border-b border-paper/15 bg-ink/90 backdrop-blur-md">
        <div className="mx-auto flex max-w-2xl items-center justify-between px-6 py-4">
          <div>
            <Eyebrow>Gate check-in</Eyebrow>
            <div className="mt-1 font-display text-xl tracking-tight">Scan passes</div>
          </div>
          <Link
            to="/admin"
            className="font-mono text-[11px] uppercase tracking-[0.2em] text-paper/55 transition-colors hover:text-red"
          >
            ← Dashboard
          </Link>
        </div>
      </header>

      <main className="mx-auto max-w-2xl px-6 py-8 space-y-6">
        {/* Viewfinder — html5-qrcode injects its video here. */}
        <div className={result ? 'hidden' : ''}>
          <div id={READER_ID} className="w-full overflow-hidden border border-paper/20 bg-black" />
          {!cameraError && (
            <p className="mt-3 text-center font-mono text-[10px] uppercase tracking-[0.2em] text-paper/40">
              {busy ? 'Checking ticket…' : 'Point the camera at the attendee’s QR pass'}
            </p>
          )}
        </div>

        {cameraError && !result && (
          <div className="space-y-4 border border-amber-400/40 bg-amber-400/5 p-5">
            <p className="text-sm leading-relaxed text-amber-200">{cameraError}</p>
            <form onSubmit={onManualSubmit} className="space-y-3">
              <label
                htmlFor="manual-token"
                className="block font-montserrat text-[11px] font-medium uppercase tracking-[0.2em] text-paper/40"
              >
                Ticket code
              </label>
              <textarea
                id="manual-token"
                rows={3}
                value={manualToken}
                onChange={(e) => setManualToken(e.target.value)}
                placeholder="Paste the QR token here"
                className="w-full resize-y rounded-none border border-paper/25 bg-transparent px-3 py-2 font-mono text-sm text-paper placeholder:text-paper/30 focus:border-red focus:outline-none"
              />
              <button
                type="submit"
                disabled={busy || !manualToken.trim()}
                className="w-full border border-red bg-red px-6 py-3 font-mono text-xs uppercase tracking-widest text-paper transition-opacity disabled:opacity-40"
              >
                {busy ? 'Checking…' : 'Check in'}
              </button>
            </form>
          </div>
        )}

        {result && <ScanResult result={result} onNext={scanNext} />}
      </main>
    </div>
  )
}

function ScanResult({ result, onNext }) {
  const panels = {
    verified: {
      frame: 'border-emerald-500 bg-emerald-500/10',
      badge: 'text-emerald-400',
      title: '✓ VERIFIED',
    },
    used: {
      frame: 'border-red bg-red/10',
      badge: 'text-red',
      title: '✗ ALREADY USED',
    },
    invalid: {
      frame: 'border-red bg-red/10',
      badge: 'text-red',
      title: '✗ INVALID TICKET',
    },
  }
  const p = panels[result.kind] ?? panels.invalid
  const attendee = result.attendee ?? {}

  return (
    <div className={`border-4 p-8 text-center ${p.frame}`} role="status" aria-live="assertive">
      <div className={`font-display text-4xl font-bold tracking-tight sm:text-5xl ${p.badge}`}>
        {p.title}
      </div>

      {result.kind === 'verified' && (
        <div className="mt-6 space-y-2">
          <div className="font-display text-3xl tracking-tight text-paper">{attendee.full_name ?? '—'}</div>
          <div className="font-mono text-sm uppercase tracking-[0.2em] text-paper/60">
            {attendee.designation ?? '—'}
          </div>
        </div>
      )}

      {result.kind === 'used' && (
        <div className="mt-6 space-y-2 text-paper/80">
          <div className="font-display text-2xl tracking-tight text-paper">{attendee.full_name ?? '—'}</div>
          <div className="text-sm">
            Checked in {attendee.checked_in_at ? new Date(attendee.checked_in_at).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' }) : '—'}
            {attendee.checked_in_by ? ` · by ${attendee.checked_in_by}` : ''}
          </div>
        </div>
      )}

      {result.kind === 'invalid' && (
        <p className="mt-4 text-sm text-paper/70">{result.error}</p>
      )}

      <button
        type="button"
        onClick={onNext}
        className="mt-8 w-full border border-paper/40 px-6 py-4 font-mono text-xs uppercase tracking-widest text-paper transition-colors hover:border-paper hover:bg-paper/10"
      >
        Scan next →
      </button>
    </div>
  )
}
