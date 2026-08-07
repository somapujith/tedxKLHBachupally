import { Link, useParams } from 'react-router-dom'
import { event, speakers, isRevealed } from '../data/site'
import { Eyebrow, Reveal, PortraitPlaceholder } from '../components/ui'
import { BinaryDrift, RedGlow } from '../components/texture'
import NotFound from './NotFound'

// Portrait placeholder — same monogram + texture fallback as the Team page,
// used for any speaker whose `photo` is still null in src/data/event.js. A
// real photo gets the full portrait ratio; the placeholder collapses to a
// short fixed band instead of stretching an empty box the same size a photo
// would fill, which reads as a broken image rather than a "coming soon".
function SpeakerPortrait({ speaker }) {
  return (
    <div className={`relative w-full overflow-hidden bg-ink ${speaker.photo ? 'aspect-[3/4]' : 'h-56 md:h-full'}`}>
      {speaker.photo ? (
        <img
          src={speaker.photo}
          alt={speaker.name}
          style={speaker.photoPos ? { objectPosition: speaker.photoPos } : undefined}
          className="h-full w-full object-cover"
        />
      ) : (
        <PortraitPlaceholder name={speaker.name.replace(/^Dr\.?\s+/i, '')} size="text-6xl md:text-7xl" />
      )}
    </div>
  )
}

// Small square thumbnail for the prev/next nav — same photo-or-monogram
// fallback as the hero portrait, just cropped square and much smaller.
function SpeakerThumb({ speaker }) {
  return (
    <div className="relative h-16 w-16 shrink-0 overflow-hidden rounded-full bg-ink sm:h-20 sm:w-20">
      {speaker.photo ? (
        <img
          src={speaker.photo}
          alt=""
          style={speaker.photoPos ? { objectPosition: speaker.photoPos } : undefined}
          className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-110"
        />
      ) : (
        <PortraitPlaceholder name={speaker.name.replace(/^Dr\.?\s+/i, '')} size="text-lg" />
      )}
    </div>
  )
}

// One nav card: round thumbnail, label, name + role. `direction` is null for
// the two-revealed-speakers case (see below), where "Previous"/"Next" would
// be a meaningless label on the one other speaker there is to link to.
function SpeakerNavCard({ speaker, direction }) {
  const label = direction === 'prev' ? 'Previous' : direction === 'next' ? 'Next' : 'Also revealed'
  const arrow = direction === 'prev' ? '←' : '→'
  return (
    <Link
      to={`/speakers/${speaker.slug}`}
      className="group flex items-center gap-4 rounded-lg border border-paper/10 p-5 transition-all duration-300 hover:border-red/50 hover:bg-paper/[0.03] sm:gap-5 sm:p-6"
    >
      <SpeakerThumb speaker={speaker} />
      <div className="min-w-0">
        <div className="flex items-center gap-2 font-mono text-[11px] uppercase tracking-[0.2em] text-paper/50 transition-colors group-hover:text-red">
          {direction === 'prev' && <span aria-hidden className="transition-transform duration-300 group-hover:-translate-x-1">{arrow}</span>}
          {label}
          {direction === 'next' && <span aria-hidden className="transition-transform duration-300 group-hover:translate-x-1">{arrow}</span>}
        </div>
        <div className="mt-2 truncate font-display text-xl tracking-tight md:text-2xl">{speaker.name}</div>
        <div className="mt-0.5 truncate text-sm text-paper/60">{speaker.role}</div>
      </div>
    </Link>
  )
}

export default function SpeakerDetail() {
  const { slug } = useParams()
  const speaker = speakers.find((s) => s.slug === slug)

  // A slug for a speaker who hasn't been revealed yet renders the same 404 as
  // an unknown slug — the reveal schedule (src/data/event.js `revealDate`)
  // must never be bypassable by guessing a future speaker's URL.
  if (!speaker || !isRevealed(speaker)) return <NotFound />

  // Prev/next only ever cycles through OTHER revealed speakers, so a visitor
  // can never land one click away from a page that immediately 404s. With
  // exactly 2 speakers revealed (day one of the schedule), prev and next
  // both resolve to that one other speaker — rendered as a single "Also
  // revealed" card instead of two identical "Previous"/"Next" links to the
  // same person. With 1 (or, degenerately, 0) revealed, there's no one else
  // to link to and the section doesn't render at all.
  const revealed = speakers.filter((s) => isRevealed(s))
  const index = revealed.findIndex((s) => s.slug === slug)
  const prev = revealed.length > 1 ? revealed[(index - 1 + revealed.length) % revealed.length] : null
  const next = revealed.length > 1 ? revealed[(index + 1) % revealed.length] : null
  const showsSamePersonTwice = revealed.length === 2

  return (
    <div>
      {/* Hero */}
      <section className="relative overflow-hidden border-b border-paper/10 px-6">
        <RedGlow className="-right-40 -top-40" size={560} />
        <BinaryDrift className="opacity-50" columns={10} />
        <div className="relative mx-auto max-w-6xl py-16 md:py-24">
          <Link
            to="/speakers"
            className="group inline-flex items-center gap-2 font-mono text-[11px] uppercase tracking-[0.2em] text-paper/50 transition-colors hover:text-red"
          >
            <span aria-hidden className="transition-transform duration-300 group-hover:-translate-x-1">
              ←
            </span>
            All speakers
          </Link>

          <div className="mt-10 grid grid-cols-1 gap-10 md:grid-cols-[minmax(0,320px)_1fr] md:gap-16">
            <Reveal className="border border-paper/10 md:self-start">
              <SpeakerPortrait speaker={speaker} />
            </Reveal>

            <Reveal>
              <div className="flex items-baseline justify-between gap-4">
                <Eyebrow>{speaker.category} · {event.edition}</Eyebrow>
                <span aria-hidden className="font-mono text-[11px] tracking-widest text-paper/25">
                  {String(speaker.n).padStart(2, '0')} / {String(speakers.length).padStart(2, '0')}
                </span>
              </div>
              <h1 className="mt-5 font-display text-4xl leading-[1.05] tracking-tight md:text-6xl">
                {speaker.name}
              </h1>
              <p className="mt-4 max-w-xl text-lg leading-relaxed text-paper/70">{speaker.role}</p>

              {speaker.highlight && (
                <div className="mt-8 max-w-xl border-l-2 border-red pl-4 font-display text-xl leading-snug tracking-tight text-paper/90 md:text-2xl">
                  {speaker.highlight}
                </div>
              )}

              {speaker.credentials && (
                <p className="mt-6 max-w-xl font-mono text-[11px] uppercase tracking-[0.15em] text-paper/45">
                  {speaker.credentials}
                </p>
              )}

              <p className="mt-8 max-w-xl text-base leading-relaxed text-paper/75 md:text-lg">
                {speaker.bio}
              </p>
            </Reveal>
          </div>
        </div>
      </section>

      {/* Prev / next */}
      {prev && next && (
        <section className="px-6 py-16 md:py-20">
          <div className={`mx-auto grid max-w-6xl grid-cols-1 gap-4 sm:gap-5 ${showsSamePersonTwice ? '' : 'sm:grid-cols-2'}`}>
            {showsSamePersonTwice ? (
              <SpeakerNavCard speaker={next} direction={null} />
            ) : (
              <>
                <SpeakerNavCard speaker={prev} direction="prev" />
                <SpeakerNavCard speaker={next} direction="next" />
              </>
            )}
          </div>
        </section>
      )}
    </div>
  )
}
