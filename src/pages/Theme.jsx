import { theme } from '../data/site'
import { Eyebrow, Reveal } from '../components/ui'
import { BinaryDrift, RedGlow } from '../components/texture'

export default function Theme() {
  return (
    <div>
      {/* Hero */}
      <section className="relative overflow-hidden border-b border-paper/10 px-6">
        <RedGlow className="-right-32 -top-24" size={520} />
        <BinaryDrift className="opacity-50" columns={12} />
        <div className="relative mx-auto max-w-3xl py-24 md:py-32">
          <Eyebrow className="mb-5">{theme.eyebrow}</Eyebrow>
          <h1 className="font-display text-4xl leading-[1.05] tracking-tight md:text-6xl">
            {theme.h1[0]} <span className="text-red">{theme.h1[1]}</span>
          </h1>
          <p className="mt-6 max-w-xl text-lg leading-relaxed text-paper/60">
            Every generation negotiates with its tools. Ours is the first asked to negotiate
            with something that answers back.
          </p>
        </div>
      </section>

      {/* Chapters */}
      <div className="mx-auto max-w-3xl px-6 py-20 md:py-28">
        <div className="space-y-16 md:space-y-24">
          {theme.chapters.map((c) => (
            <Reveal key={c.n}>
              <div className="flex items-baseline gap-4">
                <span className="font-mono text-xs tracking-[0.2em] text-red">{c.n}</span>
                <span aria-hidden className="h-px flex-1 bg-paper/10" />
              </div>
              <h2 className="mt-5 font-display text-2xl tracking-tight md:text-3xl">{c.title}</h2>
              <p className="mt-4 text-lg leading-relaxed text-paper/70">{c.body}</p>
            </Reveal>
          ))}
        </div>
      </div>
    </div>
  )
}
