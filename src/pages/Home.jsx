import { Link } from 'react-router-dom'
import { event, speakers, theme } from '../data/site'
import { Countdown, SpeakerCard, Reveal, Section, Eyebrow } from '../components/ui'
import { BinaryDrift, RedGlow, TornEdge } from '../components/texture'
import heroImage from '../assets/tedxhero1.png'

// Single, consistent "read more" CTA — small mono uppercase, red, trailing arrow.
function ReadMore({ to, href, children }) {
  const cls =
    'inline-flex items-center gap-2 font-mono text-[11px] uppercase tracking-widest text-red hover:underline focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-red'
  const arrow = <span aria-hidden="true">→</span>
  if (href) {
    return (
      <a href={href} className={cls}>
        {children} {arrow}
      </a>
    )
  }
  return (
    <Link to={to} className={cls}>
      {children} {arrow}
    </Link>
  )
}

const stats = [
  ['12', 'Speakers'],
  ['01', 'Day'],
  ['06', 'Hours'],
  ['∞', 'Ideas'],
]

export default function Home() {
  return (
    <div>
      {/* HERO — unchanged */}
      <section className="relative min-h-[85vh] flex items-center overflow-hidden">
        <img src={heroImage} alt="" className="absolute inset-0 w-full h-full object-cover" />
        <div className="absolute inset-0 bg-gradient-to-r from-ink via-ink/75 to-ink/10" />
        <BinaryDrift className="opacity-60" columns={12} />
        <RedGlow className="-bottom-32 left-1/4" size={520} />
        <div className="relative z-10 w-full px-6 md:px-12 lg:px-20">
          <div className="max-w-xl">
            <h1 className="font-display leading-[0.95] text-5xl md:text-7xl">
              Technology <span className="text-red">Evolves.</span>
              <br />
              Humanity <span className="text-red">Leads.</span>
            </h1>
            <p className="mt-6 text-paper/70 max-w-md">
              A single day of 12 ideas — staged, recorded, and released to the world. Built by students, attended by
              a city.
            </p>
            <div className="mt-6 font-body text-xs uppercase tracking-widest text-paper/60 space-y-1">
              <div>{event.date}</div>
              <div>{event.venue} · {event.city}</div>
            </div>
            <Link
              to="/register"
              className="inline-block mt-8 border border-red px-6 py-3 font-mono text-xs uppercase tracking-widest hover:bg-red transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-red"
            >
              Reserve a seat →
            </Link>
            <div className="mt-10">
              <Countdown target={event.isoDate} />
            </div>
          </div>
        </div>
        <TornEdge position="bottom" />
      </section>

      {/* ABOUT — statement, stats, and a quiet "what is TEDx" footnote */}
      <Section>
        <Reveal>
          <Eyebrow>About TEDxKLH</Eyebrow>
          <h2 className="font-display text-3xl md:text-4xl leading-tight max-w-3xl mt-5">
            We gather twelve voices a year and give them eighteen minutes to change how a room thinks.
          </h2>
          <p className="text-paper/60 text-lg leading-relaxed max-w-2xl mt-6">
            Engineers, poets, surgeons, builders, dissenters. No panels. No keynotes. No theatrics — only ideas, on a
            red dot, in front of a city that listens.
          </p>

          <div className="flex flex-wrap gap-x-14 gap-y-8 mt-12">
            {stats.map(([value, label]) => (
              <div key={label}>
                <div className="font-display text-4xl text-red leading-none">{value}</div>
                <div className="font-mono text-[11px] uppercase tracking-widest text-paper/50 mt-3">{label}</div>
              </div>
            ))}
          </div>

          <p className="text-sm text-paper/45 leading-relaxed max-w-2xl mt-14">
            In the spirit of ideas worth spreading, TED created{' '}
            <a
              href="https://www.ted.com/about/programs-initiatives/tedx-program"
              className="text-paper/70 underline hover:text-red transition-colors"
            >
              TEDx
            </a>
            {' '}— a program of local, self-organized events that recreate the TED experience. Ours is TEDxKLH
            Bachupally, where x = independently organized TED event. Speakers are never charged; TED provides guidance,
            but the event is entirely student-run.
          </p>
        </Reveal>
      </Section>

      {/* THEME */}
      <Section>
        <Reveal>
          <Eyebrow>{theme.eyebrow}</Eyebrow>
          <h2 className="font-display text-4xl md:text-5xl leading-[1.05] mt-5">
            {theme.h1[0]} <span className="text-red">{theme.h1[1]}</span>
          </h2>
          <p className="text-paper/60 max-w-xl mt-6">
            Every generation negotiates with its tools. Ours is negotiating with intelligence itself.
          </p>
          <div className="mt-8">
            <ReadMore to="/theme">Read the full theme</ReadMore>
          </div>
        </Reveal>
      </Section>

      {/* SPEAKERS */}
      <Section>
        <Reveal className="flex items-end justify-between gap-6">
          <h2 className="font-display text-3xl md:text-4xl">The speakers.</h2>
          <ReadMore to="/events/1/speakers">All 12</ReadMore>
        </Reveal>
        <Reveal className="grid md:grid-cols-2 md:gap-x-14 mt-10">
          {speakers.slice(0, 6).map((s) => (
            <SpeakerCard key={s.slug} speaker={s} />
          ))}
        </Reveal>
      </Section>

      {/* COLLABORATION */}
      <Section>
        <Reveal>
          <Eyebrow>Collaboration</Eyebrow>
          <h2 className="font-display text-3xl md:text-4xl leading-tight max-w-2xl mt-5">
            Supporting the ideas that shape our future.
          </h2>
          <p className="text-paper/60 max-w-xl mt-6">
            Made possible by the institutions, brands, and creative teams who back independent ideas.
          </p>
          <div className="mt-8">
            <ReadMore to="/partners">View Partners & Sponsors</ReadMore>
          </div>
        </Reveal>
      </Section>

      {/* CLOSING CTA */}
      <Section className="text-center">
        <Reveal>
          <Eyebrow className="text-paper/50">{event.date}</Eyebrow>
          <h2 className="font-display text-5xl md:text-6xl mt-5">Be in the room.</h2>
          <p className="text-paper/60 max-w-md mx-auto mt-6">
            Seating is limited and curated. Apply once — we'll confirm within seven days.
          </p>
          <Link
            to="/register"
            className="inline-block mt-10 border border-red px-8 py-4 font-mono text-xs uppercase tracking-widest hover:bg-red transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-red"
          >
            Reserve a seat →
          </Link>
        </Reveal>
      </Section>
    </div>
  )
}
