import { partners } from '../data/site'
import { Eyebrow, Reveal } from '../components/ui'

export default function Partners() {
  return (
    <div className="max-w-4xl mx-auto px-6 py-24 md:py-32">
      <Eyebrow className="mb-5">Partners</Eyebrow>
      <h1 className="font-display text-4xl md:text-6xl tracking-tight leading-[1.05] mb-6">
        The companies in the room.
      </h1>
      <p className="text-lg text-paper/70 leading-relaxed max-w-2xl mb-20">
        We're grateful to our partners and sponsors — their support makes TEDxKLH Bachupally possible.
      </p>

      <div className="mb-4 font-mono text-[11px] uppercase tracking-[0.2em] text-paper/40">Presenting partner</div>
      <Reveal className="border-t border-b border-red/40 py-8 mb-20 font-display text-3xl tracking-tight text-red">
        {partners.presenting.name}
      </Reveal>

      <div className="mb-6 font-mono text-[11px] uppercase tracking-[0.2em] text-paper/40">Supporting partners</div>
      <div className="grid grid-cols-2 md:grid-cols-3 border-t border-l border-paper/10">
        {partners.supporting.map((name) => (
          <Reveal
            key={name}
            className="border-b border-r border-paper/10 p-6 font-display text-lg tracking-tight text-paper/80 hover:text-paper transition-colors"
          >
            {name}
          </Reveal>
        ))}
      </div>
    </div>
  )
}
