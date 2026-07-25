import { theme } from '../data/site'
import { Eyebrow, Reveal } from '../components/ui'

export default function Theme() {
  return (
    <div className="max-w-3xl mx-auto px-6 py-24 md:py-32">
      <Eyebrow className="mb-5">{theme.eyebrow}</Eyebrow>
      <h1 className="font-display text-4xl md:text-6xl tracking-tight leading-[1.05] mb-20">
        {theme.h1[0]} <span className="text-red">{theme.h1[1]}</span>
      </h1>

      <div className="space-y-16 md:space-y-24">
        {theme.chapters.map((c) => (
          <Reveal key={c.n}>
            <Eyebrow className="mb-4">Chapter {c.n}</Eyebrow>
            <h2 className="font-display text-2xl md:text-3xl tracking-tight mb-4">{c.title}</h2>
            <p className="text-lg text-paper/70 leading-relaxed">{c.body}</p>
          </Reveal>
        ))}
      </div>
    </div>
  )
}
