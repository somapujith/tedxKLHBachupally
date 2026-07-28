import { useMemo } from 'react'
import { motion, useReducedMotion } from 'framer-motion'
import { team, teamDepartments, teamLeadership } from '../data/site'
import { Eyebrow, TeamCard } from '../components/ui'
import { BinaryDrift, RedGlow } from '../components/texture'

// Turn a department name into a stable URL/anchor slug.
function slugify(name) {
  return name
    .toLowerCase()
    .replace(/&/g, 'and')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

// Numberless section header — a red circle marker, the title, and a hairline rule.
// No counts, no zero-padded index; reads the same in any language.
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

// Featured, extra-wide leadership card for the single Organiser. Larger portrait,
// bigger type, a hairline red accent bar so it reads as the top of the masthead.
function FeaturedLeadCard({ member }) {
  const reduceMotion = useReducedMotion()
  return (
    <motion.article
      initial={reduceMotion ? false : { opacity: 0, y: 24 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, amount: 0.2 }}
      transition={{ duration: 0.5 }}
      className="group relative flex flex-col overflow-hidden border border-paper/10 bg-paper/[0.02] transition-all duration-300 hover:border-red/50 sm:flex-row"
    >
      <span aria-hidden className="absolute left-0 top-0 z-10 h-full w-1 bg-red/70" />
      <div className="relative aspect-square w-full shrink-0 overflow-hidden bg-ink sm:aspect-auto sm:w-64 md:w-80">
        {member.photo ? (
          <img
            src={member.photo}
            alt={member.name}
            loading="lazy"
            style={member.photoPos ? { objectPosition: member.photoPos } : undefined}
            className="h-full w-full object-cover grayscale contrast-125 transition-all duration-500 group-hover:scale-105 group-hover:grayscale-0"
          />
        ) : (
          <div className="flex h-full min-h-[16rem] w-full items-center justify-center bg-gradient-to-br from-ink to-[#171717]">
            <span className="font-display text-7xl tracking-tight text-paper/30 transition-colors duration-500 group-hover:text-red/45">
              {member.name.charAt(0).toUpperCase()}
            </span>
          </div>
        )}
      </div>
      <div className="flex flex-1 flex-col justify-center px-8 py-10 md:px-12">
        <div className="font-mono text-[11px] uppercase tracking-[0.25em] text-red">{member.role}</div>
        <div className="mt-3 font-display text-4xl leading-[1.05] tracking-tight md:text-6xl">
          {member.name}
        </div>
        <p className="mt-5 max-w-md text-sm leading-relaxed text-paper/55">
          Sets the direction of the event and carries the team from first idea to
          final applause.
        </p>
      </div>
    </motion.article>
  )
}

// Compact co-lead card for the two Co-organisers sharing one row.
function CoLeadCard({ member, index = 0 }) {
  const reduceMotion = useReducedMotion()
  return (
    <motion.article
      initial={reduceMotion ? false : { opacity: 0, y: 24 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, amount: 0.2 }}
      transition={{ duration: 0.45, delay: index * 0.06 }}
      className="group relative flex items-center gap-6 overflow-hidden border border-paper/10 bg-paper/[0.02] p-6 transition-all duration-300 hover:-translate-y-1 hover:border-red/50 md:gap-8 md:p-8"
    >
      <div className="relative h-32 w-32 shrink-0 overflow-hidden bg-ink sm:h-40 sm:w-40 md:h-44 md:w-44">
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
        <div className="mt-2 truncate font-display text-2xl tracking-tight md:text-3xl lg:text-4xl">
          {member.name}
        </div>
      </div>
    </motion.article>
  )
}

function TeamSection({ title, kicker, members, anchorId }) {
  // A lone member (e.g. Productions "GBS Team") shouldn't stretch a 4-col grid.
  // Cap the column count so a single card sits at a natural card width.
  const cols =
    members.length === 1
      ? 'grid-cols-1 sm:max-w-xs'
      : members.length === 2
        ? 'grid-cols-2 sm:max-w-md'
        : 'grid-cols-2 sm:grid-cols-3 lg:grid-cols-4'
  return (
    <section id={anchorId} className="mb-20 scroll-mt-28 last:mb-0">
      <SectionHeader title={title} kicker={kicker} />
      <div className={`grid gap-4 ${cols}`}>
        {members.map((member, i) => (
          <TeamCard key={`${title}-${member.name}`} member={member} index={i} />
        ))}
      </div>
    </section>
  )
}

export default function Team() {
  const organiser = teamLeadership.find((l) => /^organiser$/i.test(l.role))
  const coLeads = teamLeadership.filter((l) => l !== organiser)

  // Departments that actually have members, with anchor slugs. No counts.
  const activeDepartments = useMemo(
    () =>
      teamDepartments
        .map((dept) => ({
          dept,
          slug: slugify(dept),
          members: team.filter((m) => m.dept === dept),
        }))
        .filter((d) => d.members.length > 0),
    [],
  )

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

      {/* Leadership + departments */}
      <section className="px-6">
        <div className="mx-auto max-w-6xl py-16 md:py-24">
          {/* Leadership */}
          <div id="leadership" className="mb-24 scroll-mt-28">
            <SectionHeader title="Leadership" kicker="Who leads the room" />
            {organiser && <FeaturedLeadCard member={organiser} />}
            {coLeads.length > 0 && (
              <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
                {coLeads.map((lead, i) => (
                  <CoLeadCard key={lead.name} member={lead} index={i} />
                ))}
              </div>
            )}
          </div>

          {/* Departments */}
          {activeDepartments.map(({ dept, slug, members }) => (
            <TeamSection key={dept} title={dept} members={members} anchorId={slug} />
          ))}
        </div>
      </section>
    </div>
  )
}
