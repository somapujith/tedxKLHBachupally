import { Link } from 'react-router-dom'
import { event } from '../data/site'
import { SectionLabel, Reveal } from '../components/ui'

export default function Events() {
  return (
    <div className="max-w-4xl mx-auto px-6 py-24">
      <SectionLabel n="08" label="Archive · The Timeline" />
      <h1 className="font-display text-4xl mb-16">Our Editions. Infinite Ideas.</h1>
      <Reveal className="border border-paper/20 p-8 hover:border-red transition-colors">
        <div className="font-mono text-xs uppercase tracking-widest text-red mb-2">
          {event.edition} · {event.year}
        </div>
        <h2 className="font-display text-2xl mb-2">TEDxKLH Bachupally</h2>
        <div className="text-sm text-paper/60 mb-4">{event.venue} · {event.date}</div>
        <p className="text-paper/70 mb-6">{event.description}</p>
        <div className="flex gap-8 mb-6 text-sm">
          <span>12 Speakers</span>
          <span>{event.guests} Guests</span>
        </div>
        <Link to="/events/1" className="font-mono text-xs uppercase tracking-widest text-red hover:underline">
          Explore Event →
        </Link>
      </Reveal>
    </div>
  )
}
