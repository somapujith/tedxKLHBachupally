import { useState } from 'react'
import { Eyebrow } from '../components/ui'

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
      const res = await fetch('/api/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      })
      const data = await res.json()
      if (!res.ok || !data.ok) {
        throw new Error(data.error || 'Registration failed.')
      }
      setSuccess(data)
      setForm(initial)
    } catch (err) {
      setError(err.message || 'Something went wrong.')
    } finally {
      setSubmitting(false)
    }
  }

  if (success) {
    return (
      <div className="max-w-2xl mx-auto px-6 py-24 md:py-32">
        <Eyebrow className="mb-5">Registered</Eyebrow>
        <h1 className="font-display text-4xl md:text-6xl tracking-tight leading-[1.05] mb-6">
          You&rsquo;re on the list.
        </h1>
        <p className="text-lg text-paper/70 leading-relaxed mb-10">
          We saved your details for TEDxKLH Bachupally. Payment comes next — you&rsquo;ll complete that step once
          checkout goes live.
        </p>
        <div className="border border-paper/15 p-6 space-y-3 text-sm">
          <Row label="Email" value={success.registration?.email} />
          <Row label="Status" value="Pending payment" />
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
            {submitting ? 'Saving…' : 'Continue to payment →'}
          </button>
          <p className="text-xs text-paper/45 max-w-xs">
            Payment integration comes next. Submitting saves your registration with pending payment status.
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
