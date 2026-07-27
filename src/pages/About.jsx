import { Link } from 'react-router-dom'
import { aboutPage } from '../data/site'
import { Eyebrow, Reveal } from '../components/ui'
import { RedGlow } from '../components/texture'
import heroPoster from '../assets/images/about/tedx-hero-poster.jpg'
import tedStage from '../assets/images/about/ted-stage.webp'
import aboutHero from '../assets/images/about/about-hero.png'

function StatStrip({ stats }) {
  return (
    <div className="grid grid-cols-2 gap-px border-y border-paper/10 bg-paper/10 md:grid-cols-4">
      {stats.map((s) => (
        <div key={s.label} className="bg-ink p-5 transition-colors hover:bg-paper/[0.03] md:p-8">
          <div className="font-display text-3xl tabular-nums text-red md:text-5xl">{s.value}</div>
          <div className="mt-2 text-[11px] uppercase tracking-[0.2em] text-paper/45">{s.label}</div>
        </div>
      ))}
    </div>
  )
}

export default function About() {
  const { ted, chapter } = aboutPage

  return (
    <div className="relative overflow-hidden">
      {/* Full-bleed photo hero */}
      <section className="relative flex min-h-[calc(100vh-6rem)] items-center justify-center overflow-hidden">
        <img
          src={aboutHero}
          alt=""
          className="absolute inset-0 h-full w-full object-cover object-center"
        />
        <div className="absolute inset-0 bg-gradient-to-b from-ink/70 via-ink/55 to-ink" />
        <Reveal className="relative px-6 py-24 text-center md:py-32">
          <div className="mb-7 flex items-center justify-center gap-4">
            <span aria-hidden className="h-px w-10 bg-red md:w-16" />
            <Eyebrow>About us</Eyebrow>
            <span aria-hidden className="h-px w-10 bg-red md:w-16" />
          </div>
          <h1 className="mx-auto max-w-5xl font-display font-black leading-[0.98] tracking-tight drop-shadow-[0_2px_24px_rgba(0,0,0,0.8)]">
            <span className="block text-4xl md:text-7xl">TEDxKLH Bachupally</span>
            <span className="mt-3 block text-3xl md:mt-5 md:text-6xl">
              is a <span className="text-red">student-run</span> ideas community.
            </span>
          </h1>
          <p className="mx-auto mt-7 max-w-xl text-sm leading-relaxed text-paper/60 md:text-base">
            An independently organized TED event at KL University, Bachupally — built, curated and
            staged entirely by students.
          </p>
        </Reveal>
      </section>

      {/* About TED & TEDx — text left, TED stage right */}
      <section className="relative mx-auto max-w-6xl px-6 py-16 md:py-24">
        <RedGlow className="-left-40 top-10" size={480} />
        <div className="relative grid items-center gap-10 md:grid-cols-2 md:gap-16">
          <Reveal>
            <h2 className="font-display text-3xl tracking-tight md:text-5xl">{ted.heading}</h2>
            <div className="mt-6 space-y-5 text-base leading-relaxed text-paper/70 md:text-lg">
              {ted.paragraphs.map((p, i) => (
                <p key={i}>{p}</p>
              ))}
            </div>
          </Reveal>
          <Reveal className="order-first md:order-none">
            <figure className="overflow-hidden rounded-lg border border-paper/10">
              <img
                src={tedStage}
                alt="A speaker on the TED main stage, standing in the signature red dot"
                className="h-full w-full object-cover"
                loading="lazy"
              />
            </figure>
          </Reveal>
        </div>
        <Reveal className="mt-12 md:mt-16">
          <StatStrip stats={ted.stats} />
        </Reveal>
      </section>

      {/* Our chapter — audience image left, text right */}
      <section className="relative mx-auto max-w-6xl px-6 py-16 md:py-24">
        <RedGlow className="-right-40 top-20" size={480} />
        <div className="relative grid items-center gap-10 md:grid-cols-2 md:gap-16">
          <Reveal>
            <figure className="overflow-hidden rounded-lg border border-paper/10">
              <img
                src={heroPoster}
                alt="A speaker on a dark TEDx stage before a packed audience"
                className="h-full w-full object-cover"
                loading="lazy"
              />
            </figure>
          </Reveal>
          <Reveal>
            <Eyebrow className="mb-4">{chapter.label}</Eyebrow>
            <h2 className="font-display text-3xl leading-[1.08] tracking-tight md:text-4xl lg:text-5xl">
              {chapter.heading}
            </h2>
            <div className="mt-6 space-y-5 text-base leading-relaxed text-paper/70 md:text-lg">
              {chapter.paragraphs.map((p, i) => (
                <p key={i}>{p}</p>
              ))}
            </div>
          </Reveal>
        </div>
        <Reveal className="mt-12 md:mt-16">
          <StatStrip stats={chapter.stats} />
        </Reveal>

        {/* Handoff into the crew */}
        <div className="mt-12 flex flex-col items-start justify-between gap-6 sm:flex-row sm:items-center md:mt-16">
          <p className="max-w-md text-sm leading-relaxed text-paper/50">
            Every department — curation to production — is run by students.
          </p>
          <Link
            to="/team"
            className="group inline-flex min-h-[44px] items-center gap-2 rounded-full border border-red/50 px-6 font-mono text-[11px] uppercase tracking-[0.2em] text-red transition-colors hover:bg-red hover:text-paper focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-red"
          >
            Meet the crew
            <span aria-hidden className="transition-transform group-hover:translate-x-1">
              →
            </span>
          </Link>
        </div>
      </section>
    </div>
  )
}
