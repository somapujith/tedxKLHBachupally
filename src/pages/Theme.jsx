import { Link } from 'react-router-dom'
import { theme } from '../data/site'
import { Eyebrow, Reveal } from '../components/ui'
import { BinaryDrift, RedGlow } from '../components/texture'
// Giant red TEDx letters against a chalkboard wall of ideas
import themeHero from '../assets/images/about/theme-hero.jpg'

export default function Theme() {
  return (
    <div className="relative overflow-hidden">
      {/* Full-bleed photo hero */}
      <section className="relative flex min-h-[420px] items-center justify-center overflow-hidden md:min-h-[560px]">
        <img
          src={themeHero}
          alt="Giant red TEDx letters on a chalkboard wall covered in hand-drawn ideas"
          className="absolute inset-0 h-full w-full object-cover object-center"
        />
        <div className="absolute inset-0 bg-ink/30" />
        <div className="absolute inset-x-0 bottom-0 h-24 bg-gradient-to-b from-transparent to-ink md:h-32" />
        <BinaryDrift className="opacity-40" columns={12} />
        <Reveal className="relative px-6 py-24 text-center md:py-32">
          <div className="mb-7 flex items-center justify-center gap-4">
            <span aria-hidden className="h-px w-10 bg-red md:w-16" />
            <Eyebrow>{theme.eyebrow}</Eyebrow>
            <span aria-hidden className="h-px w-10 bg-red md:w-16" />
          </div>
          <h1 className="mx-auto max-w-5xl font-display font-black leading-[0.98] tracking-tight drop-shadow-[0_2px_24px_rgba(0,0,0,0.8)]">
            <span className="block text-4xl md:text-7xl">{theme.h1[0]}</span>
            <span className="mt-3 block text-4xl text-red md:mt-5 md:text-7xl">{theme.h1[1]}</span>
          </h1>
          <p className="mx-auto mt-7 max-w-xl text-sm leading-relaxed text-paper/60 md:text-base">
            Every generation negotiates with its tools. Ours is the first asked to negotiate with
            something that answers back.
          </p>
        </Reveal>
      </section>

      {/* Chapters — oversized numerals, editorial rows */}
      <section className="relative mx-auto max-w-5xl px-6 py-16 md:py-24">
        <RedGlow className="-left-40 top-1/3" size={520} />
        <div className="relative space-y-14 md:space-y-20">
          {theme.chapters.map((c, i) => (
            <Reveal key={c.n}>
              <article className="grid gap-4 border-t border-paper/10 pt-8 md:grid-cols-[auto,1fr] md:gap-12 md:pt-10">
                <div className="flex items-baseline gap-4 md:w-36 md:flex-col md:gap-2">
                  <span aria-hidden className="font-display text-5xl font-black leading-none text-red md:text-7xl">
                    0{i + 1}
                  </span>
                  <span className="font-mono text-[11px] tracking-[0.2em] text-paper/35">{c.n}</span>
                </div>
                <div>
                  <h2 className="font-display text-2xl leading-tight tracking-tight md:text-4xl">
                    {c.title}
                  </h2>
                  <p className="mt-4 max-w-2xl text-base leading-relaxed text-paper/70 md:text-lg">
                    {c.body}
                  </p>
                </div>
              </article>
            </Reveal>
          ))}
        </div>

        {/* Handoff — theme into the event */}
        <Reveal>
          <div className="relative mt-16 overflow-hidden rounded-lg border border-paper/10 p-8 md:mt-24 md:p-12">
            <RedGlow className="-right-24 -top-24" size={360} />
            <div className="relative flex flex-col items-start justify-between gap-6 sm:flex-row sm:items-center">
              <div>
                <h2 className="font-display text-2xl tracking-tight md:text-3xl">
                  One stage. One question. <span className="text-red">One day.</span>
                </h2>
                <p className="mt-2 max-w-md text-sm leading-relaxed text-paper/60 md:text-base">
                  Watch the answer take shape live at KL University, Bachupally.
                </p>
              </div>
              <Link
                to="/register"
                className="group inline-flex min-h-[44px] items-center gap-2 rounded-full border border-red/50 px-6 font-mono text-[11px] uppercase tracking-[0.2em] text-red transition-colors hover:bg-red hover:text-paper focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-red"
              >
                Book your seat
                <span aria-hidden className="transition-transform group-hover:translate-x-1">
                  →
                </span>
              </Link>
            </div>
          </div>
        </Reveal>
      </section>
    </div>
  )
}
