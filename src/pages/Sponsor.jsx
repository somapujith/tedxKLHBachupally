import { sponsorTiers } from '../data/site'
import { SectionLabel, Reveal } from '../components/ui'

export default function Sponsor() {
  return (
    <div className="max-w-5xl mx-auto px-6 py-24">
      <SectionLabel n="13" label="Sponsor · Be in the credits" />
      <h1 className="font-display text-4xl mb-6">Put your name in the room.</h1>
      <p className="text-paper/70 max-w-xl mb-16">
        Three tiers. Real reach. Every sponsorship funds a student-run production that goes on to live on TED.com for
        years.
      </p>
      <div className="grid md:grid-cols-3 gap-6">
        {sponsorTiers.map((t) => (
          <Reveal key={t.tier} className="border border-paper/20 p-6 flex flex-col">
            <div className="font-mono text-xs uppercase tracking-widest text-red mb-2">{t.tier}</div>
            <div className="text-sm text-paper/60 mb-4">{t.subtitle}</div>
            <div className="font-display text-3xl mb-6">{t.price}</div>
            <ul className="space-y-2 text-sm text-paper/70 flex-1">
              {t.benefits.map((b) => (
                <li key={b}>· {b}</li>
              ))}
            </ul>
          </Reveal>
        ))}
      </div>
    </div>
  )
}
