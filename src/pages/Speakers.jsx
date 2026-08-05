import { Link } from 'react-router-dom'
import { event, speakers } from '../data/site'
import { Eyebrow, Reveal } from '../components/ui'
import { BinaryDrift, RedGlow } from '../components/texture'

// Fixed display order for the six fields on stage. Driving the strip from this
// list (rather than from whatever order the roster happens to be in) keeps the
// index stable when a speaker is added, and the `.filter` below drops any field
// that has no talk yet instead of rendering an empty cell.
const CATEGORY_ORDER = ['Technology', 'Science', 'Arts', 'Climate', 'Health', 'Society']

const categories = CATEGORY_ORDER.map((name) => ({
  name,
  count: speakers.filter((s) => s.category === name).length,
})).filter((c) => c.count > 0)

// A readable, comma-separated list of the fields for the lede: the same twelve
// names and six categories are this page's long-tail search surface, so they
// appear as real sentences, not only as labels on cards.
function joinFields(names) {
  if (names.length < 2) return names.join('')
  return `${names.slice(0, -1).join(', ')} and ${names[names.length - 1]}`
}

// One roster cell. The name is an <h2> because it is the heading of this
// speaker's block — the category, role and talk title are all real text under
// it, never colour-coded meaning. The card is not a link (there are no speaker
// detail pages yet), so the hover is a quiet wash plus a hairline, not a
// link-like lift that would promise a click it cannot deliver.
function SpeakerCard({ speaker }) {
  return (
    <Reveal className="group relative border-b border-r border-paper/10 transition-colors duration-300 hover:bg-paper/[0.03]">
      <span
        aria-hidden
        className="absolute left-0 top-0 h-px w-0 bg-red transition-all duration-300 ease-out motion-reduce:transition-none group-hover:w-full"
      />
      <article className="flex h-full flex-col p-6 md:p-8">
        <div className="flex items-baseline justify-between gap-4">
          <span className="font-mono text-[11px] uppercase tracking-[0.2em] text-red">
            {speaker.category}
          </span>
          <span aria-hidden className="font-mono text-[11px] tracking-widest text-paper/25">
            {String(speaker.n).padStart(2, '0')}
          </span>
        </div>

        <h2 className="mt-5 font-display text-2xl leading-tight tracking-tight md:text-3xl">
          {speaker.name}
        </h2>
        <p className="mt-2 text-sm leading-relaxed text-paper/70">{speaker.role}</p>

        <div className="mt-8 border-t border-paper/10 pt-5">
          <div className="font-mono text-[10px] uppercase tracking-[0.2em] text-paper/50">Talk</div>
          <p className="mt-2 font-display text-lg leading-snug tracking-tight text-paper/90 md:text-xl">
            {speaker.talk}
          </p>
        </div>
      </article>
    </Reveal>
  )
}

export default function Speakers() {
  const fields = joinFields(categories.map((c) => c.name))

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

      {/* Field index — static, text-first. Category is stated, never implied by colour. */}
      <section className="px-6">
        <div className="mx-auto max-w-6xl py-16 md:py-20">
          <Eyebrow className="mb-6 flex items-center gap-2">
            <span aria-hidden className="inline-block h-1.5 w-1.5 rounded-full bg-red" />
            {categories.length} fields on one stage
          </Eyebrow>
          <ul className="grid grid-cols-2 border-l border-t border-paper/10 sm:grid-cols-3 lg:grid-cols-6">
            {categories.map((c) => (
              <li
                key={c.name}
                className="border-b border-r border-paper/10 px-5 py-6 transition-colors duration-300 hover:bg-paper/[0.03]"
              >
                <div className="font-display text-lg tracking-tight text-paper/90">{c.name}</div>
                <div className="mt-1 font-mono text-[11px] uppercase tracking-[0.2em] text-paper/50">
                  {c.count} {c.count === 1 ? 'talk' : 'talks'}
                </div>
              </li>
            ))}
          </ul>
        </div>
      </section>

      {/* Roster */}
      <section className="px-6 pb-16 md:pb-24">
        <div className="mx-auto max-w-6xl">
          <Eyebrow className="mb-6 flex items-center gap-2">
            <span aria-hidden className="inline-block h-1.5 w-1.5 rounded-full bg-red" />
            Speakers · {event.year}
          </Eyebrow>
          <div className="grid grid-cols-1 border-l border-t border-paper/10 md:grid-cols-2 lg:grid-cols-3">
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
            <Link
              to="/register"
              className="group inline-flex min-h-[44px] items-center gap-2 rounded-full border border-red/50 px-6 font-mono text-[11px] uppercase tracking-[0.2em] text-red transition-colors hover:bg-red hover:text-paper focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-red focus-visible:ring-offset-2 focus-visible:ring-offset-ink"
            >
              Book your seat
              <span
                aria-hidden
                className="transition-transform duration-300 motion-reduce:transition-none group-hover:translate-x-1"
              >
                →
              </span>
            </Link>
          </div>
        </Reveal>
      </section>
    </div>
  )
}
