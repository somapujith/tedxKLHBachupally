import { theme } from '../data/site'
import { SectionLabel, Reveal } from '../components/ui'

export default function Theme() {
  return (
    <div className="max-w-3xl mx-auto px-6 py-24">
      <div className="font-mono text-xs uppercase tracking-widest text-paper/50 mb-6">{theme.eyebrow}</div>
      <h1 className="font-display text-4xl md:text-5xl mb-16">
        {theme.h1[0]} <span className="text-red">{theme.h1[1]}</span>
      </h1>
      <div className="space-y-20">
        {theme.chapters.map((c) => (
          <Reveal key={c.n}>
            <SectionLabel n={`Chapter (${c.n})`} label="" />
            <h2 className="font-display text-2xl md:text-3xl mb-4">{c.title}</h2>
            <p className="text-paper/70 leading-relaxed">{c.body}</p>
          </Reveal>
        ))}
      </div>
    </div>
  )
}
