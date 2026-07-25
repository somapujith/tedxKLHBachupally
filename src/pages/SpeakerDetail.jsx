import { Link, useParams } from 'react-router-dom'
import { speakers, schedule } from '../data/site'
import { Eyebrow } from '../components/ui'

function sessionFor(slug) {
  return schedule.find((s) => s.slugs?.includes(slug))
}

export default function SpeakerDetail() {
  const { slug } = useParams()
  const speaker = speakers.find((s) => s.slug === slug)

  if (!speaker) {
    return (
      <div className="max-w-3xl mx-auto px-6 py-24 md:py-32">
        <p className="text-lg text-paper/70 mb-6">Speaker not found.</p>
        <Link
          to="/events/1/speakers"
          className="inline-flex items-center gap-2 font-mono text-[11px] uppercase tracking-[0.2em] text-red hover:underline focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-red"
        >
          <span aria-hidden>←</span> All speakers
        </Link>
      </div>
    )
  }

  const session = sessionFor(slug)
  const prev = speakers.find((s) => s.n === speaker.n - 1) ?? speakers[speakers.length - 1]
  const next = speakers.find((s) => s.n === speaker.n + 1) ?? speakers[0]

  return (
    <div className="max-w-4xl mx-auto px-6 py-24 md:py-32">
      <Link
        to="/events/1/speakers"
        className="inline-flex items-center gap-2 font-mono text-[11px] uppercase tracking-[0.2em] text-paper/40 hover:text-red transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-red"
      >
        <span aria-hidden>←</span> All speakers
      </Link>

      <div className="grid md:grid-cols-[280px_1fr] gap-12 md:gap-16 mt-12">
        <div className="aspect-[3/4] border border-paper/10 flex items-center justify-center text-paper/40 font-mono text-[11px] uppercase tracking-[0.2em]">
          Portrait
        </div>

        <div>
          <Eyebrow className="mb-4">{speaker.category}</Eyebrow>
          <h1 className="font-display text-4xl md:text-6xl tracking-tight leading-[1.05] mb-3">{speaker.name}</h1>
          <div className="text-[11px] uppercase tracking-[0.2em] text-paper/40 mb-8">{speaker.role}</div>
          <div className="font-display text-2xl md:text-3xl tracking-tight text-paper mb-8">
            &ldquo;{speaker.talk}&rdquo;
          </div>
          {session && (
            <div className="font-mono text-[11px] uppercase tracking-[0.2em] text-red mb-8">
              {session.time} · {session.label}
            </div>
          )}
          <p className="text-lg text-paper/70 leading-relaxed">
            {speaker.name} works at the intersection of {speaker.category.toLowerCase()} — this talk, &ldquo;{speaker.talk}&rdquo;,
            is a preview of Edition 01, arriving on the TEDxKLH Bachupally stage this August.
          </p>
        </div>
      </div>

      <div className="flex justify-between mt-24 pt-8 border-t border-paper/10 font-mono text-[11px] uppercase tracking-[0.2em]">
        <Link
          to={`/events/1/speakers/${prev.slug}`}
          className="text-paper/60 hover:text-red transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-red"
        >
          <span aria-hidden>←</span> {prev.name}
        </Link>
        <Link
          to={`/events/1/speakers/${next.slug}`}
          className="text-paper/60 hover:text-red transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-red"
        >
          {next.name} <span aria-hidden>→</span>
        </Link>
      </div>
    </div>
  )
}
