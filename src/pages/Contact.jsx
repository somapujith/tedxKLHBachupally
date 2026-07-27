import { useRef, useState } from 'react'
import { Eyebrow, Button } from '../components/ui'
import { RedGlow } from '../components/texture'
import { event } from '../data/site'
import { apiFetch } from '../lib/api'

const CONTACT_EMAIL = 'hello@tedxklhbachupally.in'
const INSTAGRAM_URL = 'https://www.instagram.com/tedxklhbachupally?igsh=ZnljMmcydTZia3Fj'

const initial = { name: '', email: '', phone: '', subject: '', message: '', website: '' }

export default function Contact() {
  const [form, setForm] = useState(initial)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')
  const [sent, setSent] = useState(false)
  const inFlight = useRef(false) // synchronous double-submit guard

  function update(field, value) {
    setForm((prev) => ({ ...prev, [field]: value }))
    setError('')
  }

  async function onSubmit(e) {
    e.preventDefault()
    if (inFlight.current) return
    inFlight.current = true
    setError('')
    setSubmitting(true)
    try {
      // retries: 0 — sending a message is not idempotent. A 429 (contact is the
      // most abuse-prone endpoint, tightest limit) becomes a clear message.
      const { ok, status, data } = await apiFetch('/api/contact', {
        method: 'POST',
        body: form,
        retries: 0,
      })
      if (status === 429) {
        throw new Error('Too many messages sent. Please wait a few minutes and try again.')
      }
      if (!ok) {
        throw new Error(data.error || 'Could not send your message.')
      }
      setSent(true)
      setForm(initial)
    } catch (err) {
      setError(err.message || 'Something went wrong.')
    } finally {
      setSubmitting(false)
      inFlight.current = false
    }
  }

  return (
    <div className="relative overflow-hidden">
      <RedGlow className="-right-40 -top-32" size={520} />
      <div className="relative mx-auto max-w-5xl px-6 py-20 md:py-28">
        <Eyebrow className="mb-5">Contact · {event.edition}</Eyebrow>
        <h1 className="mb-6 font-display text-4xl leading-[1.05] tracking-tight md:text-6xl">
          Say hello.
        </h1>
        <p className="mb-14 max-w-2xl text-lg leading-relaxed text-paper/70">
          Questions about the event, partnerships, press, or anything else — write to us and
          the team will get back to you.
        </p>

        <div className="grid gap-12 lg:grid-cols-[1fr_320px] lg:gap-16">
          {/* Form column */}
          {sent ? (
            <div className="border border-paper/15 bg-paper/[0.02] p-8">
              <Eyebrow className="mb-4">Message sent</Eyebrow>
              <h2 className="mb-4 font-display text-3xl tracking-tight">We got it.</h2>
              <p className="text-paper/70 leading-relaxed">
                Thanks for reaching out. We usually reply within a couple of days — keep an
                eye on your inbox.
              </p>
              <button
                type="button"
                onClick={() => setSent(false)}
                className="mt-8 font-montserrat text-[11px] font-medium uppercase tracking-[0.2em] text-paper/60 transition-colors hover:text-red"
              >
                Send another message →
              </button>
            </div>
          ) : (
            <form onSubmit={onSubmit} className="space-y-8" noValidate>
              {/* Honeypot — invisible to humans, bots fill it and get silently dropped */}
              <div aria-hidden="true" className="absolute -left-[9999px] top-auto h-px w-px overflow-hidden">
                <label htmlFor="website">Website</label>
                <input
                  id="website"
                  type="text"
                  tabIndex={-1}
                  autoComplete="off"
                  value={form.website}
                  onChange={(e) => update('website', e.target.value)}
                />
              </div>
              <div className="grid gap-6 sm:grid-cols-2">
                <Field id="name" label="Your name" value={form.name} onChange={(v) => update('name', v)} autoComplete="name" required className="sm:col-span-2" />
                <Field id="email" label="Email address" type="email" value={form.email} onChange={(v) => update('email', v)} autoComplete="email" required />
                <Field id="phone" label="Phone (optional)" type="tel" value={form.phone} onChange={(v) => update('phone', v)} autoComplete="tel" />
                <Field id="subject" label="Subject (optional)" value={form.subject} onChange={(v) => update('subject', v)} className="sm:col-span-2" />
                <div className="sm:col-span-2">
                  <label htmlFor="message" className="mb-2 block font-montserrat text-[11px] font-medium uppercase tracking-[0.2em] text-paper/40">
                    Message
                  </label>
                  <textarea
                    id="message"
                    rows={6}
                    value={form.message}
                    onChange={(e) => update('message', e.target.value)}
                    required
                    maxLength={2000}
                    className="w-full rounded-none border border-paper/25 bg-transparent px-4 py-3 text-paper transition-colors placeholder:text-paper/30 focus:border-red focus:outline-none"
                  />
                  <p className="mt-1 text-right font-mono text-[10px] text-paper/35">
                    {form.message.length}/2000
                  </p>
                </div>
              </div>

              {error && (
                <p role="alert" className="border-l-2 border-red bg-red/5 px-4 py-3 text-sm text-red">
                  {error}
                </p>
              )}

              <Button
                type="submit"
                variant="primary"
                disabled={submitting}
                className="w-full !font-montserrat text-[11px] font-medium !tracking-[0.2em] sm:w-auto"
              >
                {submitting ? 'Sending…' : 'Send message →'}
              </Button>
            </form>
          )}

          {/* Details aside */}
          <aside className="lg:sticky lg:top-28 lg:self-start">
            <div className="border border-paper/15 bg-paper/[0.02] p-6">
              <div className="font-mono text-[11px] uppercase tracking-[0.2em] text-red">
                Reach us
              </div>

              <dl className="mt-6 space-y-5 text-sm">
                <DetailRow label="Email">
                  <a href={`mailto:${CONTACT_EMAIL}`} className="text-paper/80 transition-colors hover:text-red">
                    {CONTACT_EMAIL}
                  </a>
                </DetailRow>
                <DetailRow label="Instagram">
                  <a href={INSTAGRAM_URL} target="_blank" rel="noreferrer" className="text-paper/80 transition-colors hover:text-red">
                    @tedxklhbachupally
                  </a>
                </DetailRow>
                <DetailRow label="Venue">
                  <address className="not-italic text-paper/80 leading-relaxed">
                    {event.address}
                  </address>
                </DetailRow>
                <DetailRow label="Directions">
                  <a href={event.mapsUrl} target="_blank" rel="noreferrer" className="text-paper/80 transition-colors hover:text-red">
                    Open in Google Maps →
                  </a>
                </DetailRow>
                <DetailRow label="Event date">
                  <span className="text-paper/80">{event.date}</span>
                </DetailRow>
                <DetailRow label="Time">
                  <span className="text-paper/80">{event.time}</span>
                </DetailRow>
              </dl>

              <p className="mt-6 border-t border-paper/10 pt-5 text-xs leading-relaxed text-paper/45">
                For speaker nominations use the nominate page; for partnership decks write
                with the subject &ldquo;Partnership&rdquo;.
              </p>
            </div>
          </aside>
        </div>
      </div>
    </div>
  )
}

function Field({ id, label, value, onChange, type = 'text', autoComplete, required, className = '' }) {
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
        className="w-full rounded-none border-0 border-b border-paper/25 bg-transparent px-0 py-3 text-paper transition-colors placeholder:text-paper/30 focus:border-red focus:outline-none"
      />
    </div>
  )
}

function DetailRow({ label, children }) {
  return (
    <div>
      <dt className="mb-1 font-mono text-[10px] uppercase tracking-[0.18em] text-paper/40">{label}</dt>
      <dd>{children}</dd>
    </div>
  )
}
