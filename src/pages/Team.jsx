import { useMemo, useState } from 'react'
import { motion, useReducedMotion } from 'framer-motion'
import { team, teamDepartments, teamLeadership } from '../data/site'
import { Eyebrow, TeamCard } from '../components/ui'
import { BinaryDrift, RedGlow } from '../components/texture'

// Turn a department name into a stable tab key.
function slugify(name) {
  return name
    .toLowerCase()
    .replace(/&/g, 'and')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

// Numberless section header — a red circle marker, the title, and a hairline rule.
function SectionHeader({ title, kicker }) {
  return (
    <div className="mb-8">
      {kicker && (
        <Eyebrow className="mb-3 flex items-center gap-2">
          <span aria-hidden className="inline-block h-1.5 w-1.5 rounded-full bg-red" />
          {kicker}
        </Eyebrow>
      )}
      <div className="flex items-baseline gap-4">
        <h2 className="font-display text-2xl tracking-tight md:text-3xl">{title}</h2>
        <div aria-hidden className="h-px flex-1 bg-paper/10" />
      </div>
    </div>
  )
}

// Numbered domain tabs — "01 Leadership", "02 Hospitality", etc. One domain
// on screen at a time, not every department stacked and scrolled through:
// browsing the team becomes a choice ("who's on Marketing?") instead of a
// long scroll past departments you didn't come for.
function DomainTabs({ tabs, active, onChange }) {
  return (
    <div className="-mx-6 overflow-x-auto px-6 sm:mx-0 sm:overflow-visible sm:px-0">
      <div role="tablist" aria-label="Team domain" className="flex gap-1 border-b border-paper/10">
        {tabs.map((tab, i) => {
          const isActive = active === tab.key
          return (
            <button
              key={tab.key}
              role="tab"
              aria-selected={isActive}
              onClick={() => onChange(tab.key)}
              className={`group relative flex shrink-0 items-center gap-2.5 whitespace-nowrap px-4 py-3.5 font-mono text-[11px] uppercase tracking-[0.2em] transition-colors duration-300 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-red md:px-5 ${
                isActive ? 'text-paper' : 'text-paper/45 hover:text-paper/80'
              }`}
            >
              <span className={isActive ? 'text-red' : 'text-paper/25'}>{String(i + 1).padStart(2, '0')}</span>
              {tab.label}
              <span
                aria-hidden
                className={`absolute inset-x-0 -bottom-px h-0.5 origin-left bg-red transition-transform duration-300 ${
                  isActive ? 'scale-x-100' : 'scale-x-0'
                }`}
              />
            </button>
          )
        })}
      </div>
    </div>
  )
}

// One rank per role, highest first: Principal > Organiser > Co-organiser >
// Curator > Head of Department. Anything unrecognized sorts to the end,
// keeping its relative order, rather than disappearing or crashing.
const ROLE_RANK = [/^principal$/i, /^organiser$/i, /^co-organiser$/i, /^curator$/i, /head of department/i]
function rankOf(role) {
  const i = ROLE_RANK.findIndex((re) => re.test(role))
  return i === -1 ? ROLE_RANK.length : i
}

// One card style for every leadership member — no featured/oversized
// treatment for any single role. Same portrait size across the board; rank
// is communicated by the role label and by sort order, not by image size.
function LeadCard({ member, index = 0 }) {
  const reduceMotion = useReducedMotion()
  return (
    <motion.article
      initial={reduceMotion ? false : { opacity: 0, y: 24 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.45, delay: index * 0.06 }}
      className="group relative flex items-center gap-6 overflow-hidden border border-paper/10 bg-paper/[0.02] p-6 transition-all duration-300 hover:-translate-y-1 hover:border-red/50 md:gap-8 md:p-8"
    >
      <div className="relative h-36 w-36 shrink-0 overflow-hidden bg-ink sm:h-44 sm:w-44 md:h-52 md:w-52">
        {member.photo ? (
          <img
            src={member.photo}
            alt={member.name}
            loading="lazy"
            style={member.photoPos ? { objectPosition: member.photoPos } : undefined}
            className="h-full w-full object-cover grayscale contrast-125 transition-all duration-500 group-hover:scale-105 group-hover:grayscale-0"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-ink to-[#171717]">
            <span className="font-display text-5xl tracking-tight text-paper/30 transition-colors duration-500 group-hover:text-red/45">
              {member.name.charAt(0).toUpperCase()}
            </span>
          </div>
        )}
      </div>
      <div className="min-w-0">
        <div className="font-mono text-[11px] uppercase tracking-[0.25em] text-red">{member.role}</div>
        <div className="mt-2 break-words font-display text-2xl leading-tight tracking-tight md:text-3xl">
          {member.name}
        </div>
      </div>
    </motion.article>
  )
}

// Department roster grid. Capped at 3 columns (was 4) — trading a column for
// a visibly bigger portrait per card, since the frame is the point now.
// Same column tiers regardless of headcount: a small department (e.g.
// Productions, 2 people) previously got its container width-capped to
// sm:max-w-md, shrinking those cards well below a bigger department's — a
// team of 2 isn't a smaller team, just a shorter row.
function TeamGrid({ members }) {
  return (
    <div className="grid grid-cols-2 gap-5 sm:grid-cols-3 md:gap-6">
      {members.map((member, i) => (
        <TeamCard key={member.name} member={member} index={i} />
      ))}
    </div>
  )
}

export default function Team() {
  const leadership = useMemo(
    () => [...teamLeadership].sort((a, b) => rankOf(a.role) - rankOf(b.role)),
    [],
  )

  // Departments that actually have members. No counts.
  const activeDepartments = useMemo(
    () =>
      teamDepartments
        .map((dept) => ({
          dept,
          key: slugify(dept),
          members: team.filter((m) => m.dept === dept),
        }))
        .filter((d) => d.members.length > 0),
    [],
  )

  const tabs = useMemo(
    () => [{ key: 'leadership', label: 'Leadership' }, ...activeDepartments.map((d) => ({ key: d.key, label: d.dept }))],
    [activeDepartments],
  )

  const [active, setActive] = useState('leadership')
  const activeDept = activeDepartments.find((d) => d.key === active)

  return (
    <div>
      {/* Hero */}
      <section className="relative overflow-hidden border-b border-paper/10 px-6">
        <RedGlow className="-left-40 -top-40" size={560} />
        <BinaryDrift className="opacity-70" columns={10} />
        <div className="relative mx-auto max-w-6xl py-24 md:py-32">
          <Eyebrow className="mb-5">The People · TEDxKLH Bachupally</Eyebrow>
          <h1 className="mb-6 max-w-4xl font-display text-4xl leading-[1.05] tracking-tight md:text-7xl">
            One team. <span className="text-red">One stage.</span>
          </h1>
          <p className="max-w-2xl text-lg leading-relaxed text-paper/70">
            TEDxKLH Bachupally is an independently organized TEDx event, run by a
            student-led team who give their time so that ideas can be heard. From
            first welcome to final applause, everyone here is a volunteer.
          </p>
        </div>
      </section>

      {/* Domain-tabbed roster */}
      <section className="px-6">
        <div className="mx-auto max-w-6xl py-16 md:py-24">
          <SectionHeader title="The team" kicker="Browse by domain" />
          <DomainTabs tabs={tabs} active={active} onChange={setActive} />

          <div className="mt-10 md:mt-12">
            {active === 'leadership' ? (
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                {leadership.map((lead, i) => (
                  <LeadCard key={lead.name} member={lead} index={i} />
                ))}
              </div>
            ) : (
              activeDept && <TeamGrid members={activeDept.members} />
            )}
          </div>
        </div>
      </section>
    </div>
  )
}
