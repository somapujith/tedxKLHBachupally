import { team } from '../data/site'
import { SectionLabel, Reveal } from '../components/ui'

export default function Team() {
  return (
    <div className="max-w-6xl mx-auto px-6 py-24">
      <SectionLabel n="10" label="Team · Who's behind it" />
      <h1 className="font-display text-4xl mb-4">The crew.</h1>
      <p className="text-paper/70 max-w-xl mb-16">
        A volunteer crew of {team.length} students runs every TEDxKLH Bachupally — from curation to lighting design
        to the after-party playlist.
      </p>
      <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-8">
        {team.map((member) => (
          <Reveal key={member.name} className="border border-paper/20 p-5">
            <div className="font-display text-lg mb-1">{member.name}</div>
            <div className="text-xs uppercase tracking-widest text-red mb-3">{member.role}</div>
            <p className="text-sm text-paper/70">{member.bio}</p>
          </Reveal>
        ))}
      </div>
    </div>
  )
}
