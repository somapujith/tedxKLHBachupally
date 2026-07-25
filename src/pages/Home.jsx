import { Link } from 'react-router-dom'
import { event, speakers, schedule, theme, galleryTiles } from '../data/site'
import { Countdown, SpeakerCard, SectionLabel, Reveal } from '../components/ui'
import heroImage from '../assets/tedxhero1.png'

export default function Home() {
  return (
    <div>
      <section className="relative min-h-[85vh] flex items-center overflow-hidden">
        <img src={heroImage} alt="" className="absolute inset-0 w-full h-full object-cover" />
        <div className="absolute inset-0 bg-gradient-to-r from-ink via-ink/75 to-ink/10" />
        <div className="relative w-full px-6 md:px-12 lg:px-20">
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
            <div className="mt-6 font-mono text-xs uppercase tracking-widest text-paper/60 space-y-1">
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
      </section>

      <section className="max-w-6xl mx-auto px-6 py-24 grid md:grid-cols-3 gap-12 border-t border-paper/10">
        <Reveal className="md:col-span-2">
          <SectionLabel n="01" label="About" />
          <h2 className="font-display text-3xl mb-4">TEDxKLH</h2>
          <p className="text-paper/70 max-w-xl">
            We gather twelve voices a year — engineers, poets, surgeons, builders, dissenters — and give them
            eighteen minutes to change how a room thinks. No panels. No keynotes. No theatrics. Only ideas, on a red
            dot, in front of a city that listens.
          </p>
        </Reveal>
        <Reveal className="grid grid-cols-2 gap-6">
          {[
            ['12', 'Speakers'],
            ['01', 'Day'],
            ['06', 'Hours'],
            ['∞', 'Ideas'],
          ].map(([value, label]) => (
            <div key={label}>
              <div className="font-display text-3xl text-red">{value}</div>
              <div className="text-xs uppercase tracking-widest text-paper/60">{label}</div>
            </div>
          ))}
        </Reveal>
      </section>

      <section className="max-w-6xl mx-auto px-6 py-24 border-t border-paper/10">
        <Reveal>
          <SectionLabel n="01b" label="Program" />
          <h3 className="font-display text-2xl mb-4">What is TEDx?</h3>
          <p className="text-paper/70 max-w-2xl">
            In the spirit of discovering and spreading ideas, TED has created a program called{' '}
            <a href="https://www.ted.com/about/programs-initiatives/tedx-program" className="underline hover:text-red">
              TEDx
            </a>
            . TEDx is a program of local, self-organized events that bring people together to share a TED-like
            experience. Our event is called TEDxKLH Bachupally, where x = independently organized TED event.
            Speakers never pay to join a TEDx event — consideration, coaching, and participation are all free of
            charge. TED provides general guidance for the program, but individual TEDx events, including ours, are
            self-organized.
          </p>
        </Reveal>
      </section>

      <section className="max-w-6xl mx-auto px-6 py-24 border-t border-paper/10 grid md:grid-cols-2 gap-12">
        <Reveal>
          <SectionLabel n="01c" label="Highlights" />
          <h3 className="font-display text-xl mb-3">Target Audience</h3>
          <p className="text-paper/70">Students, educators, professionals, innovators, and changemakers.</p>
        </Reveal>
        <Reveal>
          <h3 className="font-display text-xl mb-3">Event Highlights</h3>
          <ul className="space-y-2 text-paper/70">
            <li>· Inspiring talks by distinguished speakers</li>
            <li>· Networking opportunities</li>
            <li>· Live TEDx experience</li>
          </ul>
        </Reveal>
      </section>

      <section className="max-w-6xl mx-auto px-6 py-24 border-t border-paper/10">
        <Reveal>
          <SectionLabel n="02" label="Theme" />
          <h2 className="font-display text-4xl mb-4">
            {theme.h1[0]} <span className="text-red">{theme.h1[1]}</span>
          </h2>
          <p className="text-paper/70 max-w-xl mb-4">
            Every generation negotiates with its tools. Ours is negotiating with intelligence itself.
          </p>
          <Link to="/theme" className="font-mono text-xs uppercase tracking-widest text-red hover:underline">
            Read the full theme →
          </Link>
        </Reveal>
      </section>

      <section className="max-w-6xl mx-auto px-6 py-24 border-t border-paper/10">
        <Reveal className="flex justify-between items-end mb-10">
          <div>
            <SectionLabel n="03" label="Voices" />
            <h2 className="font-display text-3xl">The speakers.</h2>
          </div>
          <Link to="/events/1/speakers" className="font-mono text-xs uppercase tracking-widest text-red hover:underline">
            All 12 →
          </Link>
        </Reveal>
        <div className="grid md:grid-cols-3 gap-6">
          {speakers.slice(0, 6).map((s) => (
            <SpeakerCard key={s.slug} speaker={s} />
          ))}
        </div>
      </section>

      <section className="max-w-6xl mx-auto px-6 py-24 border-t border-paper/10">
        <Reveal className="mb-10">
          <SectionLabel n="04" label="Run of show" />
          <h2 className="font-display text-3xl">One day. 3 sessions.</h2>
        </Reveal>
        <div className="divide-y divide-paper/10 border-y border-paper/10">
          {schedule.map((item) => (
            <div key={item.time} className="flex gap-6 py-4">
              <div className="font-mono text-sm text-red w-16 shrink-0">{item.time}</div>
              <div className="text-paper/80">
                {item.label}
                {item.slugs && (
                  <div className="text-xs text-paper/50 mt-1">Featuring: {item.slugs.length} speakers</div>
                )}
              </div>
            </div>
          ))}
        </div>
        <Link
          to="/events/1/schedule"
          className="inline-block mt-6 font-mono text-xs uppercase tracking-widest text-red hover:underline"
        >
          Full schedule →
        </Link>
      </section>

      <section className="max-w-6xl mx-auto px-6 py-24 border-t border-paper/10">
        <Reveal>
          <SectionLabel n="05" label="Setting" />
          <h2 className="font-display text-3xl mb-6">The auditorium.</h2>
          <div className="aspect-video border border-paper/20 flex items-center justify-center text-paper/60 font-mono text-xs uppercase tracking-widest mb-6">
            Audience Setting
          </div>
          <div className="flex flex-wrap gap-10">
            <div>
              <div className="text-xs uppercase tracking-widest text-paper/50">Location</div>
              <div>{event.address}</div>
            </div>
            <div>
              <div className="text-xs uppercase tracking-widest text-paper/50">Capacity</div>
              <div>{event.capacity} seats</div>
            </div>
            <a href={event.mapsUrl} className="self-end font-mono text-xs uppercase tracking-widest text-red hover:underline">
              Get directions →
            </a>
          </div>
        </Reveal>
      </section>

      <section className="max-w-6xl mx-auto px-6 py-24 border-t border-paper/10">
        <Reveal>
          <SectionLabel n="06" label="Collaboration" />
          <h2 className="font-display text-3xl mb-4">Supporting the ideas that shape our future.</h2>
          <p className="text-paper/70 max-w-xl mb-4">
            Our independent event is made possible by the collaboration of institutions, brands, and creative teams.
          </p>
          <Link to="/partners" className="font-mono text-xs uppercase tracking-widest text-red hover:underline">
            View Partners & Sponsors →
          </Link>
        </Reveal>
      </section>

      <section className="max-w-6xl mx-auto px-6 py-24 border-t border-paper/10">
        <Reveal className="flex justify-between items-end mb-10">
          <div>
            <SectionLabel n="07" label="Archive" />
            <h2 className="font-display text-3xl">From the floor.</h2>
          </div>
          <Link to="/events/1/gallery" className="font-mono text-xs uppercase tracking-widest text-red hover:underline">
            Full gallery →
          </Link>
        </Reveal>
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
          {galleryTiles.slice(0, 5).map((tile) => (
            <Link
              key={tile}
              to="/events/1/gallery"
              className="aspect-square border border-paper/20 flex items-center justify-center text-center px-2 text-xs font-mono uppercase tracking-widest hover:border-red transition-colors"
            >
              {tile}
            </Link>
          ))}
        </div>
      </section>

      <section className="max-w-6xl mx-auto px-6 py-32 border-t border-paper/10 text-center">
        <Reveal>
          <div className="section-number justify-center mb-4">{event.date}</div>
          <h2 className="font-display text-4xl md:text-5xl mb-6">Be in the room.</h2>
          <p className="text-paper/70 mb-8">Seating is limited and curated. Apply once — we'll confirm within seven days.</p>
          <Link
            to="/register"
            className="inline-block border border-red px-8 py-4 font-mono text-xs uppercase tracking-widest hover:bg-red transition-colors"
          >
            Reserve a seat →
          </Link>
        </Reveal>
      </section>
    </div>
  )
}
