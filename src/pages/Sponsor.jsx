import { sponsorTiers } from '../data/site'
import { Eyebrow, Reveal } from '../components/ui'

export default function Sponsor() {
  return (
    <div className="max-w-5xl mx-auto px-6 py-24 md:py-32">
      <Eyebrow className="mb-5">Sponsor</Eyebrow>
      <h1 className="font-display text-4xl md:text-6xl tracking-tight leading-[1.05] mb-6">
        Put your name in the room.
      </h1>
      <p className="text-lg text-paper/70 leading-relaxed max-w-2xl mb-20">
        Three tiers. Real reach. Every sponsorship funds a student-run production that goes on to live on TED.com for
        years.
      </p>

      <div className="grid md:grid-cols-3 gap-x-12 gap-y-12 border-t border-paper/10">
        {sponsorTiers.map((t) => (
          <Reveal key={t.tier} className="pt-10">
            <div className="font-mono text-[11px] uppercase tracking-[0.2em] text-red mb-2">{t.tier}</div>
            <div className="text-sm text-paper/55 mb-6">{t.subtitle}</div>
            <div className="font-display text-3xl tracking-tight mb-8">{t.price}</div>
            <ul className="space-y-3 text-sm text-paper/70">
              {t.benefits.map((b) => (
                <li key={b} className="flex gap-3">
                  <span className="text-red" aria-hidden>—</span>
                  <span>{b}</span>
                </li>
              ))}
            </ul>
          </Reveal>
        ))}
      </div>
    </div>
  )
}
