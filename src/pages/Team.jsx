import { useMemo, useState } from 'react'
import { team, teamDepartments } from '../data/site'
import { Eyebrow, TeamCard } from '../components/ui'
import { BinaryDrift, RedGlow } from '../components/texture'

const ALL = 'All'

export default function Team() {
  const [active, setActive] = useState(ALL)

  const filters = useMemo(() => [ALL, ...teamDepartments], [])
  const visible = useMemo(
    () => (active === ALL ? team : team.filter((m) => m.dept === active)),
    [active],
  )

  return (
    <div>
      {/* Hero */}
      <section className="relative overflow-hidden border-b border-paper/10 px-6">
        <RedGlow className="-left-40 -top-40" size={560} />
        <BinaryDrift className="opacity-70" columns={10} />
        <div className="relative mx-auto max-w-6xl py-24 md:py-32">
          <Eyebrow className="mb-5">Team · The crew behind the red dot</Eyebrow>
          <h1 className="mb-6 max-w-4xl font-display text-4xl leading-[1.05] tracking-tight md:text-7xl">
            {team.length} students. <span className="text-red">One stage.</span>
          </h1>
          <p className="max-w-2xl text-lg leading-relaxed text-paper/70">
            Every TEDxKLH Bachupally is run entirely by a volunteer crew — from hospitality and
            sponsorship to marketing, production, and the web you&rsquo;re reading this on.
          </p>

          {/* Department stat strip */}
          <div className="mt-12 grid grid-cols-2 gap-px overflow-hidden border border-paper/10 bg-paper/10 sm:grid-cols-3 lg:grid-cols-5">
            {teamDepartments.map((d) => (
              <div key={d} className="bg-ink px-4 py-5">
                <div className="font-display text-2xl tabular-nums">
                  {String(team.filter((m) => m.dept === d).length).padStart(2, '0')}
                </div>
                <div className="mt-1 font-mono text-[10px] uppercase tracking-[0.18em] text-paper/50">{d}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Filter + grid */}
      <section className="px-6">
        <div className="mx-auto max-w-6xl py-16 md:py-24">
          <div className="mb-10 flex flex-wrap gap-2">
            {filters.map((f) => {
              const on = f === active
              return (
                <button
                  key={f}
                  type="button"
                  onClick={() => setActive(f)}
                  aria-pressed={on}
                  className={[
                    'border px-4 py-2 font-mono text-[11px] uppercase tracking-[0.18em] transition-colors duration-200',
                    on
                      ? 'border-red bg-red text-ink'
                      : 'border-paper/15 text-paper/60 hover:border-red/50 hover:text-red',
                  ].join(' ')}
                >
                  {f}
                </button>
              )
            })}
          </div>

          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
            {visible.map((member, i) => (
              <TeamCard key={`${member.dept}-${member.name}`} member={member} index={i} />
            ))}
          </div>

          <p className="mt-10 font-mono text-[11px] uppercase tracking-[0.18em] text-paper/40">
            Showing {visible.length} {visible.length === 1 ? 'member' : 'members'}
            {active !== ALL && ` · ${active}`}
          </p>
        </div>
      </section>
    </div>
  )
}
