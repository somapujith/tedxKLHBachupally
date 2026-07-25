import { Link, useParams } from 'react-router-dom'
import { speakers, schedule } from '../data/site'

function sessionFor(slug) {
  return schedule.find((s) => s.slugs?.includes(slug))
}

export default function SpeakerDetail() {
  const { slug } = useParams()
  const speaker = speakers.find((s) => s.slug === slug)

  if (!speaker) {
    return (
      <div className="max-w-3xl mx-auto px-6 py-24">
        <p className="text-paper/70">Speaker not found.</p>
        <Link to="/events/1/speakers" className="font-mono text-xs uppercase tracking-widest text-red hover:underline focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-red">
          ← All speakers
        </Link>
      </div>
    )
  }

  const session = sessionFor(slug)
  const prev = speakers.find((s) => s.n === speaker.n - 1) ?? speakers[speakers.length - 1]
  const next = speakers.find((s) => s.n === speaker.n + 1) ?? speakers[0]

  return (
    <div className="max-w-4xl mx-auto px-6 py-24">
      <Link
        to="/events/1/speakers"
        className="font-mono text-xs uppercase tracking-widest text-paper/50 hover:text-red focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-red"
      >
        ← All speakers
      </Link>

      <div className="grid md:grid-cols-[280px_1fr] gap-12 mt-8">
        <div className="aspect-[3/4] border border-paper/20 flex items-center justify-center text-paper/50 font-mono text-xs uppercase tracking-widest">
          Portrait
        </div>

        <div>
          <div className="font-mono text-xs text-red mb-4">{String(speaker.n).padStart(2, '0')} — {speaker.category}</div>
          <h1 className="font-display text-4xl md:text-5xl mb-3">{speaker.name}</h1>
          <div className="text-paper/60 mb-8">{speaker.role}</div>
          <div className="text-xl md:text-2xl italic mb-8">&ldquo;{speaker.talk}&rdquo;</div>
          {session && (
            <div className="font-mono text-xs uppercase tracking-widest text-paper/50 mb-8">
              {session.time} · {session.label}
            </div>
          )}
          <p className="text-paper/70 leading-relaxed">
            {speaker.name} works at the intersection of {speaker.category.toLowerCase()} — this talk, &ldquo;{speaker.talk}&rdquo;,
            is a preview of Edition 01, arriving on the TEDxKLH Bachupally stage this August.
          </p>
        </div>
      </div>

      <div className="flex justify-between mt-20 pt-8 border-t border-paper/10 font-mono text-xs uppercase tracking-widest">
        <Link
          to={`/events/1/speakers/${prev.slug}`}
          className="hover:text-red focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-red"
        >
          ← {prev.name}
        </Link>
        <Link
          to={`/events/1/speakers/${next.slug}`}
          className="hover:text-red focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-red"
        >
          {next.name} →
        </Link>
      </div>
    </div>
  )
}
