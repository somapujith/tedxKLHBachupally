import { useEffect, useRef, useState } from 'react'
import { Eyebrow, Button } from '../components/ui'
import { RedGlow } from '../components/texture'
import QueueOverlay from '../components/QueueOverlay'
import SupportPanel from '../components/SupportPanel'
import { event } from '../data/site'
import { apiFetch } from '../lib/api'
import { markBackendWarm } from '../lib/backendHealth'
import { useBackendQueue } from '../hooks/useBackendQueue'

// Bank QR shown on the payment step. Dropped in as a static asset so it can be
// swapped without a code change beyond replacing the file.
import paymentQr from '../assets/images/payment-qr.png'

const UTR_EXAMPLE = '123456789012'
// Only ever shown if the availability probe fails. Kept in step with the tail of
// the schedule in server/settings.js — quoting a price the server would not
// charge is worse than quoting the current one late.
const FALLBACK_PRICE = 599
const REGISTRATION_OPEN_MESSAGE = 'Registrations will be opened on 5th August, 7:00AM'

// Screenshots come off phones at 3-8MB, well past what a JSON body should
// carry. Downscale to at most 1400px on the long edge and re-encode as JPEG
// until the base64 payload fits comfortably under the server's ceiling.
const MAX_PROOF_EDGE = 1400
const MAX_PROOF_CHARS = 1_400_000

function readFileAsDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result)
    reader.onerror = () => reject(new Error('Could not read that file.'))
    reader.readAsDataURL(file)
  })
}

function loadImage(src) {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.onload = () => resolve(img)
    img.onerror = () => reject(new Error('That file is not a readable image.'))
    img.src = src
  })
}

// Returns a JPEG data URL small enough to post. Quality steps down before size
// does, so the UTR digits in the screenshot stay legible for the admin.
async function compressImage(file) {
  const dataUrl = await readFileAsDataUrl(file)
  const img = await loadImage(dataUrl)

  const scale = Math.min(1, MAX_PROOF_EDGE / Math.max(img.width, img.height))
  const canvas = document.createElement('canvas')
  canvas.width = Math.max(1, Math.round(img.width * scale))
  canvas.height = Math.max(1, Math.round(img.height * scale))
  canvas.getContext('2d').drawImage(img, 0, 0, canvas.width, canvas.height)

  for (const quality of [0.82, 0.7, 0.6, 0.5, 0.4]) {
    const out = canvas.toDataURL('image/jpeg', quality)
    if (out.length <= MAX_PROOF_CHARS) return out
  }
  throw new Error('That image is too large even after compression. Try a smaller screenshot.')
}

const CAMPUSES = [
  'KLH Bachupally Campus',
  'KL GBS Campus',
  'KL Aziz Nagar Campus',
  'Others',
]

// Students at KLH's own campuses pay a flat rate regardless of the general
// schedule below — mirrors resolvePassPrice() in server/settings.js, which is
// what actually decides the amount at submission.
const KLH_STUDENT_CAMPUSES = ['KLH Bachupally Campus', 'KL GBS Campus', 'KL Aziz Nagar Campus']
const KLH_STUDENT_PRICE = 449

const DESIGNATIONS = [
  { value: 'student', label: 'Student' },
  { value: 'staff', label: 'Staff' },
  { value: 'guest', label: 'Guest' },
]

const initial = {
  fullName: '',
  phone: '',
  email: '',
  designation: '',
  college: '',
  collegeOther: '',
}

export default function Register() {
  const [form, setForm] = useState(initial)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState(null)
  const [soldOut, setSoldOut] = useState(false)
  // Set once the details form is saved: the buyer moves to the bank-QR step and
  // this holds the registration their proof will be attached to.
  const [pending, setPending] = useState(null)
  // The QR is shown first; the UTR + screenshot fields only appear after the
  // buyer presses Proceed, so nobody types a reference before they have paid.
  const [showProofFields, setShowProofFields] = useState(false)
  const [utr, setUtr] = useState('')
  const [proofFile, setProofFile] = useState(null)
  // Live pass counts from GET /api/register. Advisory display only — the server
  // capacity gates stay authoritative; null (fetch failed / loading) just falls
  // back to the static capacity so the form never blocks on this call.
  const [availability, setAvailability] = useState(null)
  const [registrationsOpen, setRegistrationsOpen] = useState(true)

  useEffect(() => {
    if (success) return // refetch when the form returns after a confirmation
    let cancelled = false
    apiFetch('/api/register', { retries: 1 })
      .then(({ ok, data }) => {
        if (cancelled || !ok) return
        if (typeof data.remaining !== 'number' || typeof data.capacity !== 'number') return
        setAvailability(data)
        if (data.registrationOpen === false) setRegistrationsOpen(false)
        // Never gate mid-checkout: this probe can resolve tens of seconds late
        // (cold backend + retry), and tearing the form down under someone who is
        // typing card details — or already paid — is worse than letting the
        // server's own capacity gates reject them.
        if (data.soldOut && !inFlight.current) setSoldOut(true)
      })
      .catch(() => {}) // non-fatal: the page works without the count
    return () => {
      cancelled = true
    }
  }, [success])

  // Hard double-submit guard. The `submitting` state disables the button, but a
  // fast double-click (or Enter held) can fire onSubmit twice before React
  // re-renders the disabled button. A ref flips synchronously, so the second
  // call is rejected immediately — this is what prevents two registrations per
  // person under a 500-user click storm.
  const inFlight = useRef(false)

  // Gate on backend liveness before we take anyone's money. The API spins down
  // when idle and takes 30-60s to boot; without this, a submit against a cold
  // instance is a dead button. `queue` drives the holding screen while it boots.
  const { queue, waitForTurn } = useBackendQueue()

  // Live price from the availability probe, falling back to the constant below
  // if that call failed — the QR screen must always name a number. The server is
  // the authority: it prices the row from its own schedule at submission time,
  // so a stale fallback here can never become the amount actually recorded.
  const isKlhStudent =
    form.designation === 'student' && KLH_STUDENT_CAMPUSES.includes(form.college)
  const price = isKlhStudent ? KLH_STUDENT_PRICE : (availability?.passPrice ?? FALLBACK_PRICE)

  // Applied coupon, as returned by the server's preview endpoint. Null until a
  // buyer enters a code that checks out.
  const [coupon, setCoupon] = useState(null)
  const [couponInput, setCouponInput] = useState('')
  const [couponError, setCouponError] = useState('')
  const [couponBusy, setCouponBusy] = useState(false)

  // Every price on this screen reads from `payable`, never from `price`
  // directly. The QR, the "transfer exactly" line and the image alt text all
  // have to move together — a single stale ₹449 next to a ₹349 QR is the one
  // mistake here that costs a buyer real money and an admin a reconciliation.
  //
  // Still only a display. The server recomputes the amount from the code at
  // submit time and writes that, so nothing here can set what is owed.
  const payable = coupon ? coupon.amount : price

  const needsCollege = form.designation === 'student' || form.designation === 'staff'
  const needsOtherCollege = needsCollege && form.college === 'Others'

  function update(field, value) {
    setForm((prev) => {
      const next = { ...prev, [field]: value }
      if (field === 'designation' && value === 'guest') {
        next.college = ''
        next.collegeOther = ''
      }
      if (field === 'college' && value !== 'Others') {
        next.collegeOther = ''
      }
      return next
    })
    setError('')
  }

  async function onSubmit(e) {
    e.preventDefault()
    if (inFlight.current) return // reject a concurrent double-submit synchronously
    inFlight.current = true
    setError('')
    setSubmitting(true)

    try {
      // 0. Wait for the backend to be confirmed up. Returns immediately when the
      // warm-up service already has a fresh answer (the normal case for anyone who
      // browsed the site first); otherwise it shows the queue screen while the
      // instance boots. Nothing is sent until this resolves true, so a cold
      // backend can never produce a half-submitted registration.
      const ready = await waitForTurn()
      if (!ready) {
        throw new Error(
          'Our booking desk is taking longer than usual to open. Your details are still here — press the button again to rejoin the queue.',
        )
      }

      // 1. Save the registration (pending payment). retries: 0 — creating a
      // registration is NOT idempotent; a retry after a network blip could make
      // a second row. A 429 surfaces as a clean "slow down" message instead.
      const { ok, status, data } = await apiFetch('/api/register', {
        method: 'POST',
        body: form,
        retries: 0,
      })
      if (data.registrationOpen === false) {
        setRegistrationsOpen(false)
        setError(REGISTRATION_OPEN_MESSAGE)
        return
      }
      if (data.soldOut) {
        setSoldOut(true)
        return
      }
      if (status === 429) {
        throw new Error('You are going too fast. Please wait a moment and try again.')
      }
      if (!ok) {
        throw new Error(data.error || 'Registration failed.')
      }

      // A real 200 from the API is stronger evidence of liveness than any health
      // check, so refresh the warm window before the payment step rather than
      // letting it expire and re-queue someone already committed.
      markBackendWarm()

      // 2. Hand off to the bank-transfer step: show the QR, take the UTR and a
      // screenshot. Nothing is confirmed until an admin verifies it.
      setPending({ ...data.registration, fullName: form.fullName, email: form.email })
    } catch (err) {
      setError(err.message || 'Something went wrong.')
    } finally {
      setSubmitting(false)
      inFlight.current = false
    }
  }

  // Buyer has paid into the bank QR and is submitting their reference + proof.
  async function onApplyCoupon(e) {
    // Nested inside the payment <form>, so this must not submit the outer form.
    e.preventDefault()
    const code = couponInput.trim()
    if (!code) {
      setCouponError('Enter a coupon code.')
      return
    }
    setCouponBusy(true)
    setCouponError('')
    try {
      const { ok, status, data } = await apiFetch('/api/payment/coupon', {
        method: 'POST',
        body: { code },
        retries: 0,
      })
      if (status === 429) {
        throw new Error('Too many attempts. Wait a moment and try again.')
      }
      if (!ok || !data.coupon) {
        throw new Error(data.error || 'That coupon code is not valid.')
      }
      setCoupon(data.coupon)
      setCouponInput(data.coupon.code)
    } catch (err) {
      // Clear any previously applied coupon: leaving the old discount on screen
      // after a failed second attempt would show a price the new code does not
      // actually give.
      setCoupon(null)
      setCouponError(err.message || 'That coupon code is not valid.')
    } finally {
      setCouponBusy(false)
    }
  }

  function onRemoveCoupon() {
    setCoupon(null)
    setCouponInput('')
    setCouponError('')
  }

  async function onSubmitProof(e) {
    e.preventDefault()
    if (inFlight.current) return
    if (!proofFile) {
      setError('Attach a screenshot of your transaction.')
      return
    }
    inFlight.current = true
    setError('')
    setSubmitting(true)

    try {
      const proof = await compressImage(proofFile)
      // retries: 0 — a submission is not idempotent (the UTR unique index would
      // reject the second one anyway, but as a confusing "already submitted").
      const { ok, status, data } = await apiFetch('/api/payment/submit', {
        method: 'POST',
        // The CODE goes up, never the discounted amount — the server re-resolves
        // it and computes what was owed. Sending an amount would make the price
        // a client input.
        body: { registrationId: pending.id, utrId: utr, proof, couponCode: coupon?.code },
        retries: 0,
        timeoutMs: 30000,
      })
      if (data.soldOut) {
        setSoldOut(true)
        return
      }
      if (status === 429) {
        throw new Error('You are going too fast. Please wait a moment and try again.')
      }
      if (!ok) {
        throw new Error(data.error || 'Could not submit your payment.')
      }
      // phone rides along explicitly: the server's registration payload does not
      // echo it and setForm(initial) two lines down wipes the only other copy —
      // which would leave the support form on this screen with no number to
      // prefill for the person most likely to need it.
      setSuccess({ registration: { ...pending, phone: form.phone }, submitted: true })
      setPending(null)
      setForm(initial)
      setUtr('')
      setProofFile(null)
      // Cleared with the rest of the checkout state: a coupon left applied would
      // silently discount the next person registering on this device.
      setCoupon(null)
      setCouponInput('')
      setCouponError('')
    } catch (err) {
      setError(err.message || 'Something went wrong.')
    } finally {
      setSubmitting(false)
      inFlight.current = false
    }
  }

  // Success outranks sold-out: someone who just paid must keep their
  // confirmation (email echo, payment id) even if the last seat went to them.
  if (soldOut && !success) {
    return (
      <RegisterState eyebrow="Sold out" title="Every seat is claimed.">
        All seats for TEDxKLH Bachupally have been booked. No further registrations can be
        accepted. Follow us for announcements about future events.
      </RegisterState>
    )
  }

  if (!registrationsOpen && !success && !pending) {
    return <RegisterState eyebrow="Registrations locked" title={REGISTRATION_OPEN_MESSAGE} />
  }

  if (success) {
    return (
      <div className="relative mx-auto max-w-2xl overflow-hidden px-6 py-24 md:py-32">
        <RedGlow className="left-1/2 top-10 -translate-x-1/2" size={520} />
        <div className="relative">
          <Eyebrow className="mb-5">Awaiting verification</Eyebrow>
          <h1 className="mb-6 font-display text-4xl leading-[1.05] tracking-tight md:text-6xl">
            Payment submitted.
          </h1>
          <p className="mb-10 text-lg leading-relaxed text-paper/70">
            We&apos;ve received your transaction reference and screenshot. Our team checks each
            payment against the bank statement by hand — once it&apos;s verified, your confirmation
            email with the QR pass goes to{' '}
            <span className="text-paper">{success.registration?.email}</span>. This usually takes a
            few hours. Check your spam folder if it hasn&apos;t arrived.
          </p>
          <div className="space-y-3 border border-paper/15 bg-paper/[0.02] p-6 text-sm">
            <Row label="Email" value={success.registration?.email} />
            <Row label="Status" value="Submitted — awaiting verification" />
          </div>
          <button
            type="button"
            onClick={() => setSuccess(null)}
            className="mt-10 font-montserrat text-[11px] font-medium uppercase tracking-[0.2em] text-paper/60 transition-colors hover:text-red"
          >
            Register another person →
          </button>
        </div>
      </div>
    )
  }

  // Bank-transfer step. Details are saved; the buyer now pays out-of-band and
  // comes back with a reference and a screenshot.
  if (pending) {
    return (
      <div className="relative mx-auto max-w-2xl overflow-hidden px-6 py-20 md:py-28">
        <RedGlow className="left-1/2 top-10 -translate-x-1/2" size={520} />
        <div className="relative">
          <Eyebrow className="mb-5">Payment</Eyebrow>
          <h1 className="mb-3 font-display text-4xl leading-[1.05] tracking-tight md:text-5xl">
            Scan and pay.
          </h1>

          <div className="mb-8 inline-flex items-baseline gap-3 border border-red/40 bg-red/[0.07] px-5 py-3">
            <span className="font-display text-3xl tracking-tight">₹{payable}</span>
            <span className="font-montserrat text-[11px] font-medium uppercase tracking-[0.2em] text-red">
              Per pass
            </span>
          </div>
          <p className="mb-6 text-sm leading-relaxed text-paper/60">
            Transfer exactly ₹{payable}. Paying a different amount delays verification —
            we match your transfer against the bank statement by hand.
          </p>

          {/* Coupon entry sits ABOVE the QR deliberately: the amount on screen
              has to be final before anyone scans and pays. Applying a discount
              after the transfer is the failure this ordering prevents. */}
          <div className="mb-10 border border-paper/15 bg-paper/[0.02] p-5">
            {coupon ? (
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="min-w-0 text-sm leading-relaxed">
                  <span className="font-mono tracking-wider text-paper">{coupon.code}</span>
                  <span className="text-paper/60"> applied — you save ₹{coupon.discount}.</span>
                  <div className="mt-1 font-mono text-[11px] text-paper/40">
                    <span className="line-through">₹{coupon.passPrice}</span>
                    <span className="text-paper/70"> → ₹{coupon.amount}</span>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={onRemoveCoupon}
                  className="shrink-0 font-mono text-[11px] uppercase tracking-[0.2em] text-paper/50 underline underline-offset-4 transition-colors hover:text-red"
                >
                  Remove
                </button>
              </div>
            ) : (
              <>
                <label
                  htmlFor="coupon-code"
                  className="mb-2 block font-mono text-[11px] uppercase tracking-[0.2em] text-paper/50"
                >
                  Have a coupon?
                </label>
                <div className="flex flex-wrap gap-2">
                  <input
                    id="coupon-code"
                    value={couponInput}
                    onChange={(e) => {
                      setCouponInput(e.target.value.toUpperCase())
                      setCouponError('')
                    }}
                    // Enter inside this field would otherwise submit the payment
                    // form that wraps it.
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') onApplyCoupon(e)
                    }}
                    placeholder="ENTER CODE"
                    autoComplete="off"
                    autoCapitalize="characters"
                    spellCheck="false"
                    className="min-w-0 flex-1 border border-paper/20 bg-transparent px-4 py-3 font-mono text-sm tracking-wider text-paper placeholder:text-paper/25 focus:border-red focus:outline-none"
                  />
                  <button
                    type="button"
                    onClick={onApplyCoupon}
                    disabled={couponBusy}
                    className="shrink-0 border border-paper/25 px-5 py-3 font-mono text-[11px] uppercase tracking-[0.2em] text-paper transition-colors hover:border-red hover:text-red disabled:opacity-50"
                  >
                    {couponBusy ? 'Checking…' : 'Apply'}
                  </button>
                </div>
                {couponError && <p className="mt-2 text-sm text-red">{couponError}</p>}
              </>
            )}
          </div>

          <div className="mb-10 border border-paper/15 bg-paper/[0.02] p-6">
            {/* The asset is a portrait BHIM/UPI card, not a bare square — height
                is capped and the aspect ratio left intact so the code stays
                scannable. */}
            <img
              src={paymentQr}
              alt={`HDFC bank QR code to pay ₹${payable} by UPI`}
              className="mx-auto mb-4 max-h-80 w-auto rounded bg-paper object-contain p-2"
            />
            <p className="text-center text-sm leading-relaxed text-paper/60">
              Scan with any UPI app and pay exactly{' '}
              <span className="text-paper">₹{payable}</span>. Keep the transaction screenshot — you
              need it on the next step.
            </p>
          </div>

          {!showProofFields ? (
            <>
              <Button type="button" onClick={() => setShowProofFields(true)} className="w-full">
                Proceed
              </Button>
              <p className="mt-4 text-center text-xs text-paper/45">
                Press Proceed once your payment has gone through.
              </p>
            </>
          ) : (
            <form onSubmit={onSubmitProof} noValidate>
              <div className="mb-6">
                <label
                  htmlFor="utr"
                  className="mb-2 block font-montserrat text-[11px] font-medium uppercase tracking-[0.2em] text-paper/60"
                >
                  Enter UTR ID
                </label>
                <input
                  id="utr"
                  value={utr}
                  onChange={(e) => {
                    setUtr(e.target.value)
                    setError('')
                  }}
                  placeholder={UTR_EXAMPLE}
                  autoComplete="off"
                  className="w-full border border-paper/20 bg-transparent px-4 py-3 font-mono tracking-wider text-paper placeholder:text-paper/25 focus:border-red focus:outline-none"
                />
                <p className="mt-2 text-xs leading-relaxed text-paper/45">
                  The 12-character reference from your payment app — for example{' '}
                  <span className="font-mono text-paper/70">{UTR_EXAMPLE}</span>. Look for
                  &ldquo;UTR&rdquo;, &ldquo;RRN&rdquo;, or &ldquo;Transaction ID&rdquo;.
                </p>
              </div>

              <div className="mb-8">
                <label
                  htmlFor="proof"
                  className="mb-2 block font-montserrat text-[11px] font-medium uppercase tracking-[0.2em] text-paper/60"
                >
                  Transaction screenshot <span className="text-red">*</span>
                </label>
                <input
                  id="proof"
                  type="file"
                  accept="image/png,image/jpeg,image/webp"
                  onChange={(e) => {
                    setProofFile(e.target.files?.[0] || null)
                    setError('')
                  }}
                  className="w-full border border-paper/20 bg-transparent px-4 py-3 text-sm text-paper/70 file:mr-4 file:border-0 file:bg-paper/10 file:px-4 file:py-2 file:font-montserrat file:text-[11px] file:uppercase file:tracking-[0.15em] file:text-paper hover:file:bg-paper/20 focus:border-red focus:outline-none"
                />
                <p className="mt-2 text-xs leading-relaxed text-paper/45">
                  Required. Make sure the amount and reference are readable.
                </p>
              </div>

              {error && (
                <p className="mb-6 border border-red/40 bg-red/10 px-4 py-3 text-sm text-red">
                  {error}
                </p>
              )}

              <Button type="submit" disabled={submitting} className="w-full">
                {submitting ? 'Submitting…' : 'Submit for verification'}
              </Button>
              <p className="mt-4 text-center text-xs leading-relaxed text-paper/45">
                Your pass is emailed only after our team verifies this payment against the bank
                statement.
              </p>
            </form>
          )}
        </div>
      </div>
    )
  }

  return (
    <div className="relative overflow-hidden">
      {/* Holding screen while a cold backend boots. Only mounts when the submit
          gate actually had to wait — a warm backend goes straight to payment. */}
      {queue && <QueueOverlay {...queue} />}
      <RedGlow className="-right-40 -top-32" size={520} />
      <div className="relative mx-auto max-w-5xl px-6 py-20 md:py-28">
        <Eyebrow className="mb-5">Register · Edition 01</Eyebrow>
        <h1 className="mb-6 font-display text-4xl leading-[1.05] tracking-tight md:text-6xl">
          Claim your seat.
        </h1>
        <p className="mb-14 max-w-2xl text-lg leading-relaxed text-paper/70">
          Three short steps. Tell us who you are, pick your pass, and pay securely — your
          seat is confirmed the moment payment clears.
        </p>

        <div className="grid gap-12 lg:grid-cols-[1fr_320px] lg:gap-16">
          {/* Form column */}
          <form onSubmit={onSubmit} className="space-y-12" noValidate>
            {/* Step 1 — contact */}
            <Step n="1" title="Who are you?">
              <div className="grid gap-6 sm:grid-cols-2">
                {/* Locked while a submit is in flight. The running onSubmit
                    captured these values already, so an edit made during the
                    queue would be shown on screen but silently discarded —
                    sending the ticket to an address the user thinks they fixed. */}
                <Field id="fullName" label="Full name" value={form.fullName} onChange={(v) => update('fullName', v)} autoComplete="name" required disabled={submitting} className="sm:col-span-2" />
                <Field id="phone" label="Phone number" type="tel" value={form.phone} onChange={(v) => update('phone', v)} autoComplete="tel" required disabled={submitting} />
                <Field id="email" label="Email address" type="email" value={form.email} onChange={(v) => update('email', v)} autoComplete="email" required disabled={submitting} />
              </div>
            </Step>

            {/* Step 2 — designation */}
            <Step n="2" title="What brings you?">
              <div className="grid grid-cols-3 gap-3">
                {DESIGNATIONS.map((d) => {
                  const active = form.designation === d.value
                  return (
                    <button
                      key={d.value}
                      type="button"
                      onClick={() => update('designation', d.value)}
                      aria-pressed={active}
                      disabled={submitting}
                      className={[
                        'border px-4 py-4 font-montserrat text-[11px] font-medium uppercase tracking-[0.18em] transition-colors',
                        active
                          ? 'border-red bg-red text-paper'
                          : 'border-paper/20 text-paper/70 hover:border-paper/50 hover:text-paper',
                      ].join(' ')}
                    >
                      {d.label}
                    </button>
                  )
                })}
              </div>

              {needsCollege && (
                <div className="mt-6 grid gap-6 sm:grid-cols-2">
                  <div className="sm:col-span-2">
                    <label htmlFor="college" className="mb-2 block font-montserrat text-[11px] font-medium uppercase tracking-[0.2em] text-paper/40">
                      {form.designation === 'staff' ? 'Institution' : 'College'}
                    </label>
                    <select
                      id="college"
                      value={form.college}
                      onChange={(e) => update('college', e.target.value)}
                      required
                      disabled={submitting}
                      className="w-full appearance-none rounded-none border-0 border-b border-paper/25 bg-transparent px-0 py-3 font-body text-paper focus:border-red focus:outline-none disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      <option value="" disabled className="bg-ink text-paper">Select campus</option>
                      {CAMPUSES.map((c) => (
                        <option key={c} value={c} className="bg-ink text-paper">{c}</option>
                      ))}
                    </select>
                  </div>
                  {needsOtherCollege && (
                    <Field id="collegeOther" label="College name" value={form.collegeOther} onChange={(v) => update('collegeOther', v)} required disabled={submitting} className="sm:col-span-2" />
                  )}
                </div>
              )}
            </Step>

            {/* Step 3 — pay */}
            <Step n="3" title="Confirm & pay">
              {error && (
                <p role="alert" className="mb-4 border-l-2 border-red bg-red/5 px-4 py-3 text-sm text-red">
                  {error}
                </p>
              )}
              <Button
                type="submit"
                variant="primary"
                disabled={submitting || !form.designation}
                className="w-full !font-montserrat text-[11px] font-medium !tracking-[0.2em] sm:w-auto"
              >
                {submitting ? 'Processing…' : 'Continue to secure payment →'}
              </Button>
              <p className="mt-4 text-xs leading-relaxed text-paper/45">
                Next you&apos;ll pay by UPI and send us the transaction reference. Your seat is
                confirmed once our team verifies the payment.
              </p>
            </Step>
          </form>

          {/* Summary aside */}
          <aside className="lg:sticky lg:top-28 lg:self-start">
            <div className="border border-paper/15 bg-paper/[0.02] p-6">
              <div className="font-mono text-[11px] uppercase tracking-[0.2em] text-red">Your pass</div>
              <div className="mt-3 font-display text-2xl leading-tight tracking-tight">
                TEDxKLH Bachupally
              </div>
              <div className="mt-1 text-sm text-paper/55">Edition 01 · {event.year}</div>

              <dl className="mt-6 space-y-3 border-t border-paper/10 pt-6 text-sm">
                <SummaryRow label="Date" value={event.date} />
                <SummaryRow label="Time" value={event.time} />
                <SummaryRow label="Venue" value={event.venue} />
                <SummaryRow label="City" value={event.city} />
              </dl>
              <p className="mt-3 font-mono text-[10px] uppercase tracking-[0.15em] text-paper/35">
                {event.timeNote}
              </p>

              <div className="mt-6 border-t border-paper/10 pt-6">
                <div className="font-mono text-[10px] uppercase tracking-[0.2em] text-paper/40">Includes</div>
                <ul className="mt-3 space-y-2 text-sm text-paper/70">
                  {['All 6 talks, live', 'Idea Lounge & installations', 'Speaker salons', 'Lunch & networking'].map((x) => (
                    <li key={x} className="flex items-start gap-2">
                      <span aria-hidden className="mt-1.5 h-1 w-1 shrink-0 bg-red" />
                      {x}
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </aside>
        </div>
      </div>
    </div>
  )
}

function RegisterState({ eyebrow, title, children }) {
  return (
    <div className="relative mx-auto max-w-2xl overflow-hidden px-6 py-24 md:py-32">
      <RedGlow className="left-1/2 top-10 -translate-x-1/2" size={520} />
      <div className="relative">
        <Eyebrow className="mb-5">{eyebrow}</Eyebrow>
        <h1 className="mb-6 font-display text-4xl leading-[1.05] tracking-tight md:text-6xl">{title}</h1>
        {children ? <p className="text-lg leading-relaxed text-paper/70">{children}</p> : null}
      </div>
    </div>
  )
}

function Step({ n, title, children }) {
  return (
    <section>
      <div className="mb-6 flex items-center gap-3">
        <span className="flex h-7 w-7 items-center justify-center border border-red font-mono text-xs text-red">
          {n}
        </span>
        <h2 className="font-display text-xl tracking-tight">{title}</h2>
      </div>
      {children}
    </section>
  )
}

function Field({ id, label, value, onChange, type = 'text', autoComplete, required, disabled, className = '' }) {
  return (
    <div className={className}>
      <label htmlFor={id} className="mb-2 block font-montserrat text-[11px] font-medium uppercase tracking-[0.2em] text-paper/40">
        {label}
      </label>
      <input
        id={id}
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        autoComplete={autoComplete}
        required={required}
        disabled={disabled}
        className="w-full rounded-none border-0 border-b border-paper/25 bg-transparent px-0 py-3 text-paper transition-colors placeholder:text-paper/30 focus:border-red focus:outline-none disabled:cursor-not-allowed disabled:opacity-50"
      />
    </div>
  )
}

function SummaryRow({ label, value }) {
  return (
    <div className="flex justify-between gap-4">
      <dt className="font-mono text-[10px] uppercase tracking-[0.18em] text-paper/40">{label}</dt>
      <dd className="text-right text-paper/80">{value}</dd>
    </div>
  )
}

function Row({ label, value }) {
  return (
    <div className="flex justify-between gap-6 border-b border-paper/10 pb-3 last:border-0 last:pb-0">
      <span className="font-montserrat text-[11px] uppercase tracking-[0.18em] text-paper/40">{label}</span>
      <span className="text-paper/80">{value}</span>
    </div>
  )
}
