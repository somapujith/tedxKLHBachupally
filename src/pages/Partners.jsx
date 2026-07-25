import { partners } from '../data/site'
import { SectionLabel, Reveal } from '../components/ui'

export default function Partners() {
  return (
    <div className="max-w-4xl mx-auto px-6 py-24">
      <SectionLabel n="09" label="Partners · Made possible by" />
      <h1 className="font-display text-4xl mb-6">The companies in the room.</h1>
      <p className="text-paper/70 max-w-xl mb-16">
        We're grateful to our partners and sponsors — their support makes TEDxKLH Bachupally possible.
      </p>

      <div className="mb-4 text-xs uppercase tracking-widest text-paper/50">Presenting partner</div>
      <Reveal className="border border-red/50 p-8 mb-16 font-display text-2xl">{partners.presenting.name}</Reveal>

      <div className="mb-4 text-xs uppercase tracking-widest text-paper/50">Supporting partners</div>
      <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
        {partners.supporting.map((name) => (
          <Reveal key={name} className="border border-paper/20 p-6 font-display text-lg">
            {name}
          </Reveal>
        ))}
      </div>
    </div>
  )
}
