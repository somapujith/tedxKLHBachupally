import { useState } from 'react'
import { Eyebrow } from '../components/ui'

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
    setError('')
    setSubmitting(true)

    try {
      // 1. Save the registration (pending payment).
      const res = await fetch('/api/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      })
      const data = await res.json()
      if (!res.ok || !data.ok) {
        throw new Error(data.error || 'Registration failed.')
      }

      // 2. Create a Razorpay order for it, then open Checkout.
      await startPayment(data.registration)
    } catch (err) {
      setError(err.message || 'Something went wrong.')
    } finally {
      setSubmitting(false)
    }
  }

  async function startPayment(registration) {
    const orderRes = await fetch('/api/payment/order', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ registrationId: registration.id }),
    })
    const orderData = await orderRes.json()
    if (!orderRes.ok || !orderData.ok) {
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
    const verifyRes = await fetch('/api/payment/verify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        razorpay_order_id: response.razorpay_order_id,
        razorpay_payment_id: response.razorpay_payment_id,
        razorpay_signature: response.razorpay_signature,
      }),
    })
    const verifyData = await verifyRes.json()
    if (!verifyRes.ok || !verifyData.ok) {
      throw new Error(verifyData.error || 'Payment could not be verified.')
    }
    setSuccess({ registration: { ...registration, ...verifyData.registration }, paid: true })
    setForm(initial)
  }

  if (success) {
    return (
      <div className="max-w-2xl mx-auto px-6 py-24 md:py-32">
        <Eyebrow className="mb-5">{success.paid ? 'Confirmed' : 'Registered'}</Eyebrow>
        <h1 className="font-display text-4xl md:text-6xl tracking-tight leading-[1.05] mb-6">
          {success.paid ? "You're in." : "You're on the list."}
        </h1>
        <p className="text-lg text-paper/70 leading-relaxed mb-10">
          {success.paid
            ? 'Payment received. Your seat for TEDxKLH Bachupally is confirmed — a receipt is on its way to your email.'
            : 'We saved your details for TEDxKLH Bachupally. Complete payment to confirm your seat.'}
        </p>
        <div className="border border-paper/15 p-6 space-y-3 text-sm">
          <Row label="Email" value={success.registration?.email} />
          <Row label="Status" value={success.paid ? 'Paid — confirmed' : 'Pending payment'} />
          {success.registration?.razorpay_payment_id && (
            <Row label="Payment ID" value={success.registration.razorpay_payment_id} />
          )}
        </div>
        <button
          type="button"
          onClick={() => setSuccess(null)}
          className="mt-10 font-montserrat text-[11px] font-medium uppercase tracking-[0.2em] text-paper/60 hover:text-red transition-colors"
        >
          Register another person →
        </button>
      </div>
    )
  }

  return (
    <div className="max-w-2xl mx-auto px-6 py-24 md:py-32">
      <Eyebrow className="mb-5">Register</Eyebrow>
      <h1 className="font-display text-4xl md:text-6xl tracking-tight leading-[1.05] mb-6">
        Claim your seat.
      </h1>
      <p className="text-lg text-paper/70 leading-relaxed mb-14">
        Tell us who you are. We&rsquo;ll hold your registration, then take you to payment when you&rsquo;re ready.
      </p>

      <form onSubmit={onSubmit} className="space-y-10" noValidate>
        <fieldset className="space-y-8">
          <legend className="font-montserrat text-[11px] font-medium uppercase tracking-[0.2em] text-paper/40 mb-2">
            Contact information
          </legend>

          <Field
            id="fullName"
            label="Full name"
            value={form.fullName}
            onChange={(v) => update('fullName', v)}
            autoComplete="name"
            required
          />
          <Field
            id="phone"
            label="Phone number"
            type="tel"
            value={form.phone}
            onChange={(v) => update('phone', v)}
            autoComplete="tel"
            required
          />
          <Field
            id="email"
            label="Email address"
            type="email"
            value={form.email}
            onChange={(v) => update('email', v)}
            autoComplete="email"
            required
          />
        </fieldset>

        <fieldset>
          <legend className="font-montserrat text-[11px] font-medium uppercase tracking-[0.2em] text-paper/40 mb-5">
            Designation
          </legend>
          <div className="grid grid-cols-3 gap-3">
            {DESIGNATIONS.map((d) => {
              const active = form.designation === d.value
              return (
                <button
                  key={d.value}
                  type="button"
                  onClick={() => update('designation', d.value)}
                  className={[
                    'border px-4 py-3 font-montserrat text-[11px] font-medium uppercase tracking-[0.18em] transition-colors',
                    active
                      ? 'border-red bg-red text-paper'
                      : 'border-paper/20 text-paper/70 hover:border-paper/50 hover:text-paper',
                  ].join(' ')}
                  aria-pressed={active}
                >
                  {d.label}
                </button>
              )
            })}
          </div>
        </fieldset>

        {needsCollege && (
          <fieldset className="space-y-8">
            <legend className="font-montserrat text-[11px] font-medium uppercase tracking-[0.2em] text-paper/40 mb-2">
              {form.designation === 'staff' ? 'Institution' : 'College'}
            </legend>
            <div>
              <label htmlFor="college" className="sr-only">
                Campus
              </label>
              <select
                id="college"
                value={form.college}
                onChange={(e) => update('college', e.target.value)}
                required
                className="w-full bg-transparent border-0 border-b border-paper/25 rounded-none px-0 py-3 font-body text-paper focus:outline-none focus:border-red appearance-none"
              >
                <option value="" disabled className="bg-ink text-paper">
                  Select campus
                </option>
                {CAMPUSES.map((c) => (
                  <option key={c} value={c} className="bg-ink text-paper">
                    {c}
                  </option>
                ))}
              </select>
            </div>
            {needsOtherCollege && (
              <Field
                id="collegeOther"
                label="College name"
                value={form.collegeOther}
                onChange={(v) => update('collegeOther', v)}
                required
              />
            )}
          </fieldset>
        )}

        {error && (
          <p role="alert" className="text-sm text-red">
            {error}
          </p>
        )}

        <div className="pt-2 flex flex-col sm:flex-row sm:items-center gap-6">
          <button
            type="submit"
            disabled={submitting || !form.designation}
            className="border border-red px-8 py-3 font-montserrat text-[11px] font-medium uppercase tracking-[0.2em] hover:bg-red transition-colors disabled:opacity-40 disabled:pointer-events-none"
          >
            {submitting ? 'Processing…' : 'Continue to payment →'}
          </button>
          <p className="text-xs text-paper/45 max-w-xs">
            Secure payment via Razorpay. Your seat is confirmed once payment succeeds.
          </p>
        </div>
      </form>
    </div>
  )
}

function Field({ id, label, value, onChange, type = 'text', autoComplete, required }) {
  return (
    <div>
      <label htmlFor={id} className="block font-montserrat text-[11px] font-medium uppercase tracking-[0.2em] text-paper/40 mb-2">
        {label}
      </label>
      <input
        id={id}
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        autoComplete={autoComplete}
        required={required}
        className="w-full bg-transparent border-0 border-b border-paper/25 rounded-none px-0 py-3 text-paper placeholder:text-paper/30 focus:outline-none focus:border-red transition-colors"
      />
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
