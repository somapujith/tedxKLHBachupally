import { useState } from 'react'
import { Button } from './ui'
import { apiFetch } from '../lib/api'

// Support form shown on the registration confirmation screen. Three states:
// collapsed (a "Raise a ticket" button), the form, and the acknowledgement.
//
// Phone and email are PREFILLED from the registration the attendee just made
// but stay editable — the single most common reason to raise a ticket here is
// that the pass went to a mistyped address, and a locked field would make the
// form unable to express the very problem it exists to report.

const SUBJECTS = [
  'Payment issue',
  'Did not receive my pass',
  'Wrong details on my registration',
  'Refund or cancellation',
  'Other',
]

export default function SupportPanel({ registration }) {
  const [open, setOpen] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')
  const [raised, setRaised] = useState(null)
  const [form, setForm] = useState({
    phone: registration?.phone || '',
    email: registration?.email || '',
    subject: SUBJECTS[0],
    message: '',
  })

  function update(field, value) {
    setForm((prev) => ({ ...prev, [field]: value }))
    setError('')
  }

  async function onSubmit(e) {
    e.preventDefault()
    if (submitting) return
    setSubmitting(true)
    setError('')
    try {
      // retries: 0 — raising a ticket is not idempotent, and a retry after a
      // network blip would put the same complaint in the admin queue twice.
      const { ok, status, data } = await apiFetch('/api/support', {
        method: 'POST',
        body: {
          registrationId: registration?.id,
          fullName: registration?.full_name || registration?.fullName || '',
          phone: form.phone,
          email: form.email,
          subject: form.subject,
          message: form.message,
        },
        retries: 0,
      })
      if (status === 429) {
        throw new Error(
          data.error || 'You have already raised a ticket recently. Please wait for our reply.',
        )
      }
      if (!ok) {
        throw new Error(data.error || 'Could not raise your ticket. Please try again.')
      }
      setRaised({
        message:
          data.message ||
          'Your ticket has been raised. Our admin will contact you as soon as possible — please wait.',
        email: form.email,
        phone: form.phone,
      })
    } catch (err) {
      setError(err.message || 'Could not raise your ticket. Please try again.')
    } finally {
      setSubmitting(false)
    }
  }

  if (raised) {
    return (
      <div
        role="status"
        className="mt-10 border border-red/40 bg-red/[0.06] p-6"
        data-testid="support-raised"
      >
        <div className="font-montserrat text-[11px] font-medium uppercase tracking-[0.2em] text-red">
          Ticket raised
        </div>
        <p className="mt-3 text-sm leading-relaxed text-paper/75">{raised.message}</p>
        <p className="mt-3 text-sm leading-relaxed text-paper/50">
          We will reach you on <span className="text-paper/80">{raised.phone}</span> or{' '}
          <span className="text-paper/80">{raised.email}</span>. You do not need to do anything
          else.
        </p>
      </div>
    )
  }

  if (!open) {
    return (
      <div className="mt-10 border-t border-paper/10 pt-8">
        <p className="text-sm leading-relaxed text-paper/50">
          Something wrong with your registration or payment?
        </p>
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="mt-3 font-montserrat text-[11px] font-medium uppercase tracking-[0.2em] text-paper/70 underline decoration-red decoration-2 underline-offset-[6px] transition-colors hover:text-red"
        >
          Support — raise a ticket →
        </button>
      </div>
    )
  }

  return (
    <form onSubmit={onSubmit} className="mt-10 border border-paper/15 bg-paper/[0.02] p-6" noValidate>
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="font-montserrat text-[11px] font-medium uppercase tracking-[0.2em] text-red">
            Support
          </div>
          <p className="mt-2 text-sm leading-relaxed text-paper/55">
            Tell us what went wrong. Our admin will contact you on these details.
          </p>
        </div>
        <button
          type="button"
          onClick={() => setOpen(false)}
          disabled={submitting}
          className="font-montserrat text-[11px] uppercase tracking-[0.18em] text-paper/40 transition-colors hover:text-paper disabled:opacity-40"
        >
          Close
        </button>
      </div>

      <div className="mt-6 grid gap-5 sm:grid-cols-2">
        <SupportField
          id="support-phone"
          label="Phone number"
          type="tel"
          value={form.phone}
          onChange={(v) => update('phone', v)}
          autoComplete="tel"
          disabled={submitting}
          required
        />
        <SupportField
          id="support-email"
          label="Email address"
          type="email"
          value={form.email}
          onChange={(v) => update('email', v)}
          autoComplete="email"
          disabled={submitting}
          required
        />
        <div className="sm:col-span-2">
          <label
            htmlFor="support-subject"
            className="mb-2 block font-montserrat text-[11px] font-medium uppercase tracking-[0.2em] text-paper/40"
          >
            What is this about?
          </label>
          <select
            id="support-subject"
            value={form.subject}
            onChange={(e) => update('subject', e.target.value)}
            disabled={submitting}
            className="w-full appearance-none rounded-none border-0 border-b border-paper/25 bg-transparent px-0 py-3 font-body text-paper focus:border-red focus:outline-none disabled:cursor-not-allowed disabled:opacity-50"
          >
            {SUBJECTS.map((s) => (
              <option key={s} value={s} className="bg-ink text-paper">
                {s}
              </option>
            ))}
          </select>
        </div>
        <div className="sm:col-span-2">
          <label
            htmlFor="support-message"
            className="mb-2 block font-montserrat text-[11px] font-medium uppercase tracking-[0.2em] text-paper/40"
          >
            Describe the issue
          </label>
          <textarea
            id="support-message"
            rows={4}
            value={form.message}
            onChange={(e) => update('message', e.target.value)}
            disabled={submitting}
            required
            className="w-full resize-y rounded-none border-0 border-b border-paper/25 bg-transparent px-0 py-3 text-paper transition-colors placeholder:text-paper/30 focus:border-red focus:outline-none disabled:cursor-not-allowed disabled:opacity-50"
            placeholder="What happened?"
          />
        </div>
      </div>

      {error && (
        <p role="alert" className="mt-5 border-l-2 border-red bg-red/5 px-4 py-3 text-sm text-red">
          {error}
        </p>
      )}

      <Button
        type="submit"
        variant="primary"
        disabled={submitting}
        className="mt-6 w-full !font-montserrat text-[11px] font-medium !tracking-[0.2em] sm:w-auto"
      >
        {submitting ? 'Raising…' : 'Raise ticket →'}
      </Button>
    </form>
  )
}

function SupportField({ id, label, value, onChange, type = 'text', autoComplete, disabled, required }) {
  return (
    <div>
      <label
        htmlFor={id}
        className="mb-2 block font-montserrat text-[11px] font-medium uppercase tracking-[0.2em] text-paper/40"
      >
        {label}
      </label>
      <input
        id={id}
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        autoComplete={autoComplete}
        disabled={disabled}
        required={required}
        className="w-full rounded-none border-0 border-b border-paper/25 bg-transparent px-0 py-3 text-paper transition-colors placeholder:text-paper/30 focus:border-red focus:outline-none disabled:cursor-not-allowed disabled:opacity-50"
      />
    </div>
  )
}
