import { Link } from 'react-router-dom'
import { theme } from '../data/site'
import { Eyebrow, Reveal } from '../components/ui'
import { RedGlow } from '../components/texture'
// Theme key art: "Technology Evolves. Humanity Leads." over the KLH Bachupally campus
import themeHero from '../assets/images/about/theme-hero.png'

export default function Theme() {
  return (
    <div className="relative overflow-hidden">
      {/* Key-art hero — headline is baked into the artwork; capped so it fits without scroll */}
      <section className="relative overflow-hidden bg-ink">
        <img
          src={themeHero}
          alt="Technology Evolves. Humanity Leads. — TEDxKLH Bachupally"
          className="mx-auto block max-h-[calc(100vh-6rem)] w-full object-contain"
        />
        <div className="pointer-events-none absolute inset-x-0 bottom-0 h-20 bg-gradient-to-b from-transparent to-ink md:h-28" />
      </section>

      {/* Framing line under the key art */}
      <section className="relative px-6 pt-12 text-center md:pt-16">
        <Reveal>
          <div className="mb-5 flex items-center justify-center gap-4">
            <span aria-hidden className="h-px w-10 bg-red md:w-16" />
            <Eyebrow>{theme.eyebrow}</Eyebrow>
            <span aria-hidden className="h-px w-10 bg-red md:w-16" />
          </div>
          <p className="mx-auto max-w-xl text-sm leading-relaxed text-paper/60 md:text-base">
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
