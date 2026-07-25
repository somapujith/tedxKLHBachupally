import { Link } from 'react-router-dom'
import { event } from '../data/site'
import { Eyebrow, Reveal } from '../components/ui'

export default function Events() {
  return (
    <div className="max-w-3xl mx-auto px-6 py-24 md:py-32">
      <Eyebrow className="mb-5">Editions</Eyebrow>
      <h1 className="font-display text-4xl md:text-6xl tracking-tight leading-[1.05] mb-20">
        Our editions. Infinite ideas.
      </h1>

      <Reveal className="group block border-t border-paper/10 pt-10">
        <div className="font-mono text-[11px] uppercase tracking-[0.2em] text-paper/40 mb-3">
          {event.edition} · {event.year}
        </div>
        <h2 className="font-display text-3xl tracking-tight mb-2">TEDxKLH Bachupally</h2>
        <div className="text-[11px] uppercase tracking-[0.2em] text-paper/40 mb-6">
          {event.venue} · {event.date}
        </div>
        <p className="text-lg text-paper/70 leading-relaxed mb-6">{event.description}</p>
        <div className="flex gap-10 mb-8 text-sm text-paper/60">
          <span>12 Speakers</span>
          <span>{event.guests} Guests</span>
        </div>
        <Link
          to="/events/1"
          className="inline-flex items-center gap-2 font-mono text-[11px] uppercase tracking-[0.2em] text-red hover:underline focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-red"
        >
          Explore event <span aria-hidden>→</span>
        </Link>
      </Reveal>
    </div>
  )
}
