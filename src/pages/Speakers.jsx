import { Link } from 'react-router-dom'
import { event, speakers, isRevealed } from '../data/site'
import { Eyebrow, Reveal, Button, PortraitPlaceholder } from '../components/ui'
import { BinaryDrift, RedGlow } from '../components/texture'

// Fixed display order for the fields on stage. Used only to build the
// comma-separated sentence in the hero lede — the same names are this page's
// long-tail search surface, so they read as a real sentence rather than a
// separate index the reader has to parse before ever reaching a name.
const CATEGORY_ORDER = ['Health', 'Technology', 'Business', 'Arts', 'Science', 'Climate', 'Society']

function joinFields(names) {
  if (names.length < 2) return names.join('')
  return `${names.slice(0, -1).join(', ')} and ${names[names.length - 1]}`
}

// "Friday, August 8" + "9:00 AM IST" — always read in India time regardless
// of the visitor's own timezone, since that's the timezone the reveal
// actually happens in.
function formatRevealMoment(iso) {
  const d = new Date(iso)
  const date = d.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', timeZone: 'Asia/Kolkata' })
  const time = d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true, timeZone: 'Asia/Kolkata' })
  return `${date} at ${time} IST`
}

// The next batch of speakers still to unlock: the earliest upcoming
// `revealDate` and everyone who shares it (always 2, by the current
// schedule, but this reads off the data rather than assuming that).
// Compares actual timestamps (`getTime()`), not the raw ISO strings — two
// equal instants written with different offsets (`+05:30` vs `Z`) would
// otherwise sort wrong and fail the "shares it" equality check.
function nextReveal(allSpeakers) {
  const upcoming = allSpeakers.filter((s) => !isRevealed(s))
  if (upcoming.length === 0) return null
  const nextTime = Math.min(...upcoming.map((s) => new Date(s.revealDate).getTime()))
  return {
    count: upcoming.filter((s) => new Date(s.revealDate).getTime() === nextTime).length,
    when: formatRevealMoment(nextTime),
  }
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
  // Two speakers unlock per day at 9 AM IST (src/data/event.js `revealDate`).
  // The roster grid, field list, and "X speakers revealed" copy are all
  // driven off this filtered set, so no unrevealed speaker's name, bio, or
  // category ever renders early. The total roster size (`speakers.length`)
  // is shown regardless — the final headcount is announced upfront, only the
  // identities roll out — same framing as the "N / 6" index on each profile.
  const revealed = speakers.filter((s) => isRevealed(s))
  const categories = CATEGORY_ORDER.filter((name) => revealed.some((s) => s.category === name))
  const fields = joinFields(categories)
  const upcoming = nextReveal(speakers)

  return (
    <div>
      {/* Hero */}
      <section className="relative overflow-hidden border-b border-paper/10 px-6">
        <RedGlow className="-left-40 -top-40" size={560} />
        <BinaryDrift className="opacity-70" columns={10} />
        <div className="relative mx-auto max-w-6xl py-24 md:py-32">
          <Eyebrow className="mb-5">The line-up · {event.edition}</Eyebrow>
          {revealed.length === 0 ? (
            <>
              <h1 className="mb-6 max-w-4xl font-display text-4xl leading-[1.05] tracking-tight md:text-7xl">
                {speakers.length} speakers. <span className="text-red">One reveal at a time.</span>
              </h1>
              <p className="max-w-2xl text-lg leading-relaxed text-paper/70">
                We're unveiling the TEDxKLH Bachupally line-up two speakers a day. The
                first two take the red circle on {event.date} at {event.venue}, {event.city}
                {upcoming && <> — the reveal itself starts {upcoming.when}.</>}
              </p>
            </>
          ) : (
            <>
              <h1 className="mb-6 max-w-4xl font-display text-4xl leading-[1.05] tracking-tight md:text-7xl">
                {revealed.length} speakers. <span className="text-red">One question.</span>
              </h1>
              <p className="max-w-2xl text-lg leading-relaxed text-paper/70">
                {fields} — {revealed.length} of {speakers.length} talks revealed so far. The full
                TEDxKLH Bachupally roster takes the red circle on {event.date} at{' '}
                {event.venue}, {event.city}.
              </p>
            </>
          )}
        </div>
      </section>

      {/* Roster */}
      <section className="px-6 py-16 md:py-24">
        <div className="mx-auto max-w-6xl">
          <Eyebrow className="mb-8 flex items-center gap-2">
            <span aria-hidden className="inline-block h-1.5 w-1.5 rounded-full bg-red" />
            Speakers · {event.year}
          </Eyebrow>

          {revealed.length === 0 && upcoming ? (
            <Reveal className="relative overflow-hidden rounded-lg border border-dashed border-paper/20 px-8 py-16 text-center md:py-24">
              <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-red">
                Next reveal
              </p>
              <p className="mt-4 font-display text-3xl tracking-tight md:text-4xl">
                {upcoming.count} speakers reveal {upcoming.when}
              </p>
              <p className="mt-3 text-sm text-paper/60">
                Check back then — or follow along so you don't miss it.
              </p>
            </Reveal>
          ) : (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 lg:gap-5">
              {revealed.map((speaker) => (
                <SpeakerCard key={speaker.slug} speaker={speaker} />
              ))}
            </div>
          )}

          {revealed.length > 0 && upcoming && (
            <p className="mt-8 font-mono text-[11px] uppercase tracking-[0.2em] text-paper/45">
              {upcoming.count} more revealing {upcoming.when}
            </p>
          )}
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
