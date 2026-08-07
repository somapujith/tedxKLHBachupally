import { Link, useParams } from 'react-router-dom'
import { event, speakers } from '../data/site'
import { Eyebrow, Reveal, PortraitPlaceholder } from '../components/ui'
import { BinaryDrift, RedGlow } from '../components/texture'
import NotFound from './NotFound'

// Portrait placeholder — same monogram + texture fallback as the Team page.
// A real photo gets the full portrait ratio; the placeholder collapses to a
// short fixed band instead of stretching an empty box the same size a photo
// would fill, which reads as a broken image rather than a "coming soon".
// Swap `speaker.photo` in src/data/event.js once a real headshot exists;
// nothing else on this page needs to change.
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

export default function SpeakerDetail() {
  const { slug } = useParams()
  const index = speakers.findIndex((s) => s.slug === slug)
  const speaker = speakers[index]

  if (!speaker) return <NotFound />

  const prev = speakers[(index - 1 + speakers.length) % speakers.length]
  const next = speakers[(index + 1) % speakers.length]

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
            </Reveal>
          </div>
        </div>
      </section>

      {/* Bio — shares the hero's left edge (max-w-6xl) so the page reads as
          one column, not two differently-centred blocks; the copy itself
          still wraps at a readable measure via the inner max-w-3xl. */}
      <section className="px-6">
        <Reveal className="mx-auto max-w-6xl py-16 md:py-24">
          <div className="max-w-3xl">
            <Eyebrow className="mb-6 flex items-center gap-2">
              <span aria-hidden className="inline-block h-1.5 w-1.5 rounded-full bg-red" />
              About
            </Eyebrow>
            <p className="text-lg leading-relaxed text-paper/80 md:text-xl">{speaker.bio}</p>
          </div>
        </Reveal>
      </section>

      {/* Prev / next */}
      <section className="border-t border-paper/10 px-6">
        <div className="mx-auto grid max-w-6xl grid-cols-1 sm:grid-cols-2">
          <Link
            to={`/speakers/${prev.slug}`}
            className="group border-b border-paper/10 p-8 transition-colors hover:bg-paper/[0.03] sm:border-b-0 sm:border-r"
          >
            <div className="font-mono text-[11px] uppercase tracking-[0.2em] text-paper/50 group-hover:text-red">
              ← Previous
            </div>
            <div className="mt-3 font-display text-2xl tracking-tight">{prev.name}</div>
          </Link>
          <Link
            to={`/speakers/${next.slug}`}
            className="group p-8 text-left transition-colors hover:bg-paper/[0.03] sm:text-right"
          >
            <div className="font-mono text-[11px] uppercase tracking-[0.2em] text-paper/50 group-hover:text-red">
              Next →
            </div>
            <div className="mt-3 font-display text-2xl tracking-tight">{next.name}</div>
          </Link>
        </div>
      </section>
    </div>
  )
}
