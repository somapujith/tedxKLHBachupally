import { useEffect, useRef, useState } from 'react'
import { Eyebrow, Button } from '../components/ui'
import { RedGlow } from '../components/texture'
import QueueOverlay from '../components/QueueOverlay'
import { event } from '../data/site'
import { apiFetch } from '../lib/api'
import { markBackendWarm } from '../lib/backendHealth'
import { useBackendQueue } from '../hooks/useBackendQueue'

const RAZORPAY_SRC = 'https://checkout.razorpay.com/v1/checkout.js'

// Load the Razorpay Checkout script on demand. If the SDK is already present,
// resolve immediately. Otherwise (re)inject a fresh tag — a stale tag from a
// prior failed load would never fire again, so we drop it first.
function loadRazorpay() {
  return new Promise((resolve, reject) => {
    if (window.Razorpay) return resolve(window.Razorpay)
    document.querySelector(`script[src="${RAZORPAY_SRC}"]`)?.remove()
    const script = document.createElement('script')
    script.src = RAZORPAY_SRC
    script.onload = () =>
      window.Razorpay
        ? resolve(window.Razorpay)
        : reject(new Error('Payment SDK loaded but unavailable.'))
    script.onerror = () => reject(new Error('Failed to load payment SDK.'))
    document.body.appendChild(script)
  })
}

const CAMPUSES = [
  'KLH Bachupally Campus',
  'KL GBS Campus',
  'KL Aziz Nagar Campus',
  'Others',
]

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
  // Live pass counts from GET /api/register. Advisory display only — the server
  // capacity gates stay authoritative; null (fetch failed / loading) just falls
  // back to the static capacity so the form never blocks on this call.
  const [availability, setAvailability] = useState(null)

  useEffect(() => {
    if (success) return // refetch when the form returns after a confirmation
    let cancelled = false
    apiFetch('/api/register', { retries: 1 })
      .then(({ ok, data }) => {
        if (cancelled || !ok) return
        if (typeof data.remaining !== 'number' || typeof data.capacity !== 'number') return
        setAvailability(data)
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
  // call is rejected immediately — this is what prevents two registrations /
  // two Razorpay orders per person under a 500-user click storm.
  const inFlight = useRef(false)

  // Gate on backend liveness before we take anyone's money. The API spins down
  // when idle and takes 30-60s to boot; without this, a submit against a cold
  // instance is a dead button. `queue` drives the holding screen while it boots.
  const { queue, waitForTurn } = useBackendQueue()

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
      // check, so refresh the warm window before the payment call rather than
      // letting it expire mid-checkout and re-queue someone already committed.
      markBackendWarm()

      // 2. Create a Razorpay order for it, then open Checkout.
      await startPayment(data.registration)
    } catch (err) {
      setError(err.message || 'Something went wrong.')
    } finally {
      setSubmitting(false)
      inFlight.current = false
    }
  }

  async function startPayment(registration) {
    // retries: 0 — orders.create on the server is not idempotent (a retry could
    // mint a second order). The button lock + inFlight ref already prevent user
    // duplicates; we do not add network-level retries on top.
    const { ok, status, data: orderData } = await apiFetch('/api/payment/order', {
      method: 'POST',
      body: { registrationId: registration.id },
      retries: 0,
    })
    if (orderData.soldOut) {
      setSoldOut(true)
      return
    }
    if (status === 429) {
      throw new Error('Too many attempts. Please wait a moment and try again.')
    }
    if (!ok) {
      throw new Error(orderData.error || 'Could not start payment.')
    }

    const Razorpay = await loadRazorpay()

    // settle() guarantees the outer promise resolves exactly once, so no modal
    // outcome (success, dismiss, or failure) can leave onSubmit awaiting forever.
    await new Promise((resolve) => {
      let settled = false
      const settle = () => {
        if (settled) return
        settled = true
        resolve()
      }

      const rzp = new Razorpay({
        key: orderData.keyId || import.meta.env.VITE_RAZORPAY_KEY_ID,
        order_id: orderData.order.id,
        amount: orderData.order.amount,
        currency: orderData.order.currency,
        name: 'TEDxKLH Bachupally',
        description: 'Event registration',
        prefill: {
          name: registration.fullName || form.fullName,
          email: registration.email || form.email,
          contact: form.phone,
        },
        theme: { color: '#eb0028' },
        handler: async (response) => {
          setSubmitting(true)
          try {
            await verifyAndFinish(response, registration)
          } catch (err) {
            setError(err.message || 'Payment verification failed.')
          } finally {
            setSubmitting(false)
            settle()
          }
        },
        modal: {
          ondismiss: () => {
            setError('Payment was cancelled. Your seat is held — submit again to resume payment.')
            settle()
          },
        },
      })
      rzp.on('payment.failed', (resp) => {
        setError(resp?.error?.description || 'Payment failed. Submit again to retry.')
        settle()
      })
      rzp.open()
    })
  }

  async function verifyAndFinish(response, registration) {
    // retries: 2 — verify is idempotent server-side (settlePayment's paid-flip
    // is guarded and converges on replay), so retrying a transient failure here
    // is safe and important: the user has ALREADY PAID at this point. Losing the
    // verify to a network blip would leave them charged with no ticket. A longer
    // timeout too, since settlement fetches from Razorpay + issues the ticket.
    const { ok, data: verifyData } = await apiFetch('/api/payment/verify', {
      method: 'POST',
      body: {
        razorpay_order_id: response.razorpay_order_id,
        razorpay_payment_id: response.razorpay_payment_id,
        razorpay_signature: response.razorpay_signature,
      },
      retries: 2,
      timeoutMs: 20000,
    })
    if (!ok) {
      throw new Error(
        verifyData.error ||
          'Payment received but confirmation is delayed. Your ticket will arrive by email shortly.',
      )
    }
    setSuccess({ registration: { ...registration, ...verifyData.registration }, paid: true })
    setForm(initial)
  }

  // Success outranks sold-out: someone who just paid must keep their
  // confirmation (email echo, payment id) even if the last seat went to them.
  if (soldOut && !success) {
    return (
      <div className="relative mx-auto max-w-2xl overflow-hidden px-6 py-24 md:py-32">
        <RedGlow className="left-1/2 top-10 -translate-x-1/2" size={520} />
        <div className="relative">
          <Eyebrow className="mb-5">Sold out</Eyebrow>
          <h1 className="mb-6 font-display text-4xl leading-[1.05] tracking-tight md:text-6xl">
            Every seat is claimed.
          </h1>
          <p className="text-lg leading-relaxed text-paper/70">
            All seats for TEDxKLH Bachupally have been booked. No further registrations can be
            accepted. Follow us for announcements about future events.
          </p>
        </div>
      </div>
    )
  }

  if (success) {
    return (
      <div className="relative mx-auto max-w-2xl overflow-hidden px-6 py-24 md:py-32">
        <RedGlow className="left-1/2 top-10 -translate-x-1/2" size={520} />
        <div className="relative">
          <Eyebrow className="mb-5">{success.paid ? 'Confirmed' : 'Registered'}</Eyebrow>
          <h1 className="mb-6 font-display text-4xl leading-[1.05] tracking-tight md:text-6xl">
            {success.paid ? "You're in." : "You're on the list."}
          </h1>
          <p className="mb-10 text-lg leading-relaxed text-paper/70">
            {success.paid ? (
              <>
                Payment confirmed. A confirmation email with your QR pass has been sent to{' '}
                <span className="text-paper">{success.registration?.email}</span>. Show the QR at
                the gate to claim your pass — if it isn&apos;t in your inbox, check your spam folder.
              </>
            ) : (
              'We saved your details for TEDxKLH Bachupally. Complete payment to confirm your seat.'
            )}
          </p>
          <div className="space-y-3 border border-paper/15 bg-paper/[0.02] p-6 text-sm">
            <Row label="Email" value={success.registration?.email} />
            <Row label="Status" value={success.paid ? 'Paid — confirmed' : 'Pending payment'} />
            {success.registration?.razorpay_payment_id && (
              <Row label="Payment ID" value={success.registration.razorpay_payment_id} />
            )}
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
                Payments handled by Razorpay. We never see your card details. Your seat is
                confirmed only after payment succeeds.
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
                  {['All 12 talks, live', 'Idea Lounge & installations', 'Speaker salons', 'Lunch & networking'].map((x) => (
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
