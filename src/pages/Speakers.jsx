import { Link } from 'react-router-dom'
import { event, speakers } from '../data/site'
import { Eyebrow, Reveal, Button, PortraitPlaceholder } from '../components/ui'
import { BinaryDrift, RedGlow } from '../components/texture'

// Fixed display order for the fields on stage. Used only to build the
// comma-separated sentence in the hero lede — the same names are this page's
// long-tail search surface, so they read as a real sentence rather than a
// separate index the reader has to parse before ever reaching a name.
const CATEGORY_ORDER = ['Health', 'Technology', 'Business', 'Arts', 'Science', 'Climate', 'Society']

const categories = CATEGORY_ORDER.filter((name) => speakers.some((s) => s.category === name))

function joinFields(names) {
  if (names.length < 2) return names.join('')
  return `${names.slice(0, -1).join(', ')} and ${names[names.length - 1]}`
}

// Full-bleed portrait card: photo (or monogram placeholder) fills the frame,
// name + role sit on a bottom scrim. The caption is pinned to the bottom edge
// with absolute positioning rather than flex/mt-auto, so a two-line role never
// drifts the text block relative to the card next to it — every caption sits
// on the exact same baseline regardless of how much text it holds.
function SpeakerCard({ speaker }) {
  return (
    <Reveal className="h-full">
      <Link
        to={`/speakers/${speaker.slug}`}
        className="group relative block aspect-[3/4] h-full overflow-hidden border border-paper/10 transition-colors duration-300 hover:border-red/50"
      >
        {speaker.photo ? (
          <img
            src={speaker.photo}
            alt={speaker.name}
            loading="lazy"
            style={speaker.photoPos ? { objectPosition: speaker.photoPos } : undefined}
            className="absolute inset-0 h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
          />
        ) : (
          <div className="absolute inset-0">
            <PortraitPlaceholder name={speaker.name.replace(/^Dr\.?\s+/i, '')} />
          </div>
        )}

        {/* Index, floating over the image */}
        <div className="absolute inset-x-0 top-0 flex justify-end p-4 md:p-5">
          <span aria-hidden className="font-mono text-[11px] tracking-widest text-paper/60">
            {String(speaker.n).padStart(2, '0')}
          </span>
        </div>

        {/* Bottom scrim + caption */}
        <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-ink via-ink/80 to-transparent pb-5 pt-16">
          <div className="px-5">
            <h2 className="font-display text-xl leading-tight tracking-tight text-paper md:text-2xl">
              {speaker.name}
            </h2>
            <p className="mt-1 text-sm leading-snug text-paper/70">{speaker.role}</p>
          </div>
        </div>

        <span
          aria-hidden
          className="absolute inset-x-0 bottom-0 h-0.5 w-full origin-left scale-x-0 bg-red transition-transform duration-300 ease-out motion-reduce:transition-none group-hover:scale-x-100"
        />
      </Link>
    </Reveal>
  )
}

export default function Speakers() {
  const fields = joinFields(categories)

  return (
    <div>
      {/* Hero */}
      <section className="relative overflow-hidden border-b border-paper/10 px-6">
        <RedGlow className="-left-40 -top-40" size={560} />
        <BinaryDrift className="opacity-70" columns={10} />
        <div className="relative mx-auto max-w-6xl py-24 md:py-32">
          <Eyebrow className="mb-5">The line-up · {event.edition}</Eyebrow>
          <h1 className="mb-6 max-w-4xl font-display text-4xl leading-[1.05] tracking-tight md:text-7xl">
            {speakers.length} speakers. <span className="text-red">One question.</span>
          </h1>
          <p className="max-w-2xl text-lg leading-relaxed text-paper/70">
            {fields} — {speakers.length} talks, one stage, one afternoon. The full
            TEDxKLH Bachupally roster takes the red circle on {event.date} at{' '}
            {event.venue}, {event.city}.
          </p>
        </div>
      </section>

      {/* Roster */}
      <section className="px-6 py-16 md:py-24">
        <div className="mx-auto max-w-6xl">
          <Eyebrow className="mb-8 flex items-center gap-2">
            <span aria-hidden className="inline-block h-1.5 w-1.5 rounded-full bg-red" />
            Speakers · {event.year}
          </Eyebrow>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 lg:gap-5">
            {speakers.map((speaker) => (
              <SpeakerCard key={speaker.slug} speaker={speaker} />
            ))}
          </div>
        </div>
      </section>

      {/* Handoff — the line-up into the room */}
      <section className="px-6 pb-24 md:pb-32">
        <Reveal className="relative mx-auto max-w-6xl overflow-hidden rounded-lg border border-paper/10 p-8 md:p-12">
          <RedGlow className="-right-24 -top-24" size={360} />
          <div className="relative flex flex-col items-start justify-between gap-6 sm:flex-row sm:items-center">
            <div>
              <p className="font-display text-2xl tracking-tight md:text-3xl">
                Every talk lands once. <span className="text-red">Be in the room.</span>
              </p>
              <p className="mt-2 max-w-md text-sm leading-relaxed text-paper/70 md:text-base">
                {event.date} · {event.time} · {event.venue}, {event.city}.
              </p>
            </div>
            <Button to="/register" variant="primary">
              Book your seat →
            </Button>
          </div>
        </Reveal>
      </section>
    </div>
  )
}
