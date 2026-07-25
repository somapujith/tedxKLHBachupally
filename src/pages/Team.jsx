import { team } from '../data/site'
import { Eyebrow, Reveal } from '../components/ui'

export default function Team() {
  return (
    <div className="max-w-5xl mx-auto px-6 py-24 md:py-32">
      <Eyebrow className="mb-5">Team</Eyebrow>
      <h1 className="font-display text-4xl md:text-6xl tracking-tight leading-[1.05] mb-6">The crew.</h1>
      <p className="text-lg text-paper/70 leading-relaxed max-w-2xl mb-20">
        A volunteer crew of {team.length} students runs every TEDxKLH Bachupally — from curation to lighting design
        to the after-party playlist.
      </p>

      <div className="border-t border-paper/10">
        {team.map((member) => (
          <Reveal
            key={member.name}
            className="grid md:grid-cols-[1fr_2fr] gap-2 md:gap-10 py-8 border-b border-paper/10"
          >
            <div>
              <div className="font-display text-xl tracking-tight">{member.name}</div>
              <div className="text-[11px] uppercase tracking-[0.2em] text-red mt-1">{member.role}</div>
            </div>
            <p className="text-paper/70 leading-relaxed">{member.bio}</p>
          </Reveal>
        ))}
      </div>
    </div>
  )
}
