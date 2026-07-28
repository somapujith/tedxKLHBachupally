import { useRef } from 'react'
import { Link } from 'react-router-dom'
import { event, theme } from '../data/site'
import { Countdown, Reveal, Section, Eyebrow, Button } from '../components/ui'
import { BinaryDrift, TornEdge } from '../components/texture'
import LiquidEther from '../components/LiquidEther'
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
  ['01', 'Stage, one day'],
  ['18', 'Minutes per idea'],
  ['100%', 'Student-run'],
]

// A short, bespoke creed — reads as one falling sentence, ending in red.
const manifesto = [
  'No panels.',
  'No slides read aloud.',
  'No idea older than the person telling it.',
  'Eighteen minutes, one red circle, a city that listens.',
]

export default function Home() {
  const closingBoxRef = useRef(null)
  return (
    <div>
      {/* ── HERO ───────────────────────────────────────────────── */}
      <section className="relative flex min-h-[88vh] items-center overflow-hidden">
        <img src={heroImage} alt="" className="absolute inset-0 h-full w-full object-cover" />
        <div className="absolute inset-0 bg-gradient-to-r from-ink via-ink/75 to-ink/10" />
        <BinaryDrift className="opacity-60" columns={12} />
        <div className="relative z-10 w-full px-6 md:px-12 lg:px-20">
          <div className="max-w-xl">
            <h1 className="font-display text-5xl leading-[0.95] md:text-7xl">
              Technology <span className="text-red">Evolves.</span>
              <br />
              Humanity <span className="text-red">Leads.</span>
            </h1>
            <p className="mt-6 max-w-md text-paper/70">
              Twelve ideas. One stage. A single day, staged and recorded for the world — built
              by students, attended by a city.
            </p>
            <div className="mt-6 space-y-1 font-body text-xs uppercase tracking-widest text-paper/60">
              <div>{event.date} · {event.time}</div>
              <div>{event.venue} · {event.city}</div>
            </div>
            <Button to="/register" variant="outline" className="mt-8 px-6 py-3">
              Reserve a seat →
            </Button>
            <div className="mt-10">
              <Countdown target={event.isoDate} />
            </div>
          </div>
        </div>
        <TornEdge position="bottom" />
      </section>

      {/* ── STATEMENT + STATS ──────────────────────────────────── */}
      {/* Lead statement carries the whole "what is this" job — no separate footnote block. */}
      <Section divider={false}>
        <Reveal>
          <Eyebrow>What we do</Eyebrow>
          <h2 className="mt-5 max-w-4xl font-display text-3xl leading-[1.1] tracking-tight md:text-5xl">
            We find twelve people worth listening to, and give each of them eighteen minutes
            to change how a room thinks.
          </h2>
          <p className="mt-6 max-w-2xl text-lg leading-relaxed text-paper/60">
            Engineers, poets, surgeons, builders, dissenters — curated onto one red circle, in
            front of a city that came to listen. TEDxKLH is independently organized under
            license from TED, and run end to end by students of KL University, Bachupally.
          </p>

          <div className="mt-14 grid grid-cols-2 gap-x-10 gap-y-8 sm:flex sm:flex-wrap sm:gap-x-16">
            {stats.map(([value, label]) => (
              <div key={label}>
                <div className="font-display text-4xl leading-none text-red">{value}</div>
                <div className="mt-3 font-mono text-[11px] uppercase tracking-widest text-paper/50">{label}</div>
              </div>
            ))}
          </div>
        </Reveal>
      </Section>

      {/* ── MANIFESTO ──────────────────────────────────────────── */}
      {/* A visual beat, not a bordered box — binary drift on ink sets it apart. */}
      <section className="relative overflow-hidden">
        <BinaryDrift className="opacity-40" columns={14} />
        <div className="relative mx-auto max-w-5xl px-6 py-24 md:py-32">
          <Eyebrow className="mb-8">What a TEDxKLH stage refuses to be</Eyebrow>
          <div className="space-y-3">
            {manifesto.map((line, i) => (
              <Reveal key={i}>
                <p
                  className={[
                    'font-display leading-[1.05] tracking-tight',
                    i === manifesto.length - 1
                      ? 'mt-6 text-3xl text-red md:text-5xl'
                      : 'text-2xl text-paper/85 md:text-4xl',
                  ].join(' ')}
                >
                  {line}
                </p>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* ── THEME → SPEAKERS ───────────────────────────────────── */}
      {/* Theme and speakers read as one idea: here's the question, here's who answers it. */}
      <Section>
        <Reveal>
          <Eyebrow>{theme.eyebrow}</Eyebrow>
          <h2 className="mt-5 font-display text-4xl leading-[1.05] md:text-5xl">
            {theme.h1[0]} <span className="text-red">{theme.h1[1]}</span>
          </h2>
          <p className="mt-6 max-w-xl text-lg leading-relaxed text-paper/60">
            Every generation negotiates with its tools. Ours is the first negotiating with
            intelligence itself — and this year&rsquo;s twelve talks are our attempt at an answer.
          </p>
          <div className="mt-8">
            <ReadMore to="/theme">Read the full theme</ReadMore>
          </div>
        </Reveal>
      </Section>

      {/* ── CLOSING: FINAL CALL ────────────────────────────────── */}
      {/* Reads top-down as one beat: label → statement → terms → CTA → trust footer. */}
      <section className="relative overflow-hidden px-6 text-center">
        <div className="absolute inset-0" aria-hidden="true">
          <LiquidEther
            colors={['#e62b1e', '#ff6f61', '#7a0f0a']}
            mouseForce={10}
            cursorSize={75}
            resolution={0.5}
            isBounce={true}
            obstacleRef={closingBoxRef}
            autoDemo={true}
            autoSpeed={0.5}
            autoIntensity={2.2}
            takeoverDuration={0.25}
            autoResumeDelay={3000}
            autoRampDuration={0.6}
          />
        </div>
        <div className="relative mx-auto max-w-5xl py-24 md:py-32">
          <div
            ref={closingBoxRef}
            className="mx-auto max-w-2xl rounded-2xl border border-paper/15 bg-ink px-8 py-16 md:px-14"
          >
            <h2 className="mt-6 font-display text-5xl leading-[1.02] md:text-6xl">
              Be in the room.
            </h2>
            <p className="mx-auto mt-6 max-w-md text-lg leading-relaxed text-paper/60">
              Every seat is curated. Apply once — we confirm within seven days,
              and your seat is held the moment you do.
            </p>

            <Button to="/register" variant="primary" className="mt-10">
              Reserve a seat →
            </Button>
          </div>
        </div>
      </section>
    </div>
  )
}
