import { Link, useLocation, useNavigate } from 'react-router-dom'
import { aboutTabs } from '../data/site'
import { Eyebrow } from '../components/ui'
import { RedGlow } from '../components/texture'

const TABS = [
  { key: 'ted', label: 'TED', path: '/about-ted', tag: 'The mothership' },
  { key: 'tedx', label: 'TEDx', path: '/about-tedx', tag: 'Independently organized' },
  { key: 'tedxklh', label: 'TEDxKLH', path: '/about-tedxklh', tag: 'Our chapter' },
]

// Drop any leading "01 / " numbering from the stored eyebrow strings.
const cleanEyebrow = (s) => s?.replace(/^\s*\d+\s*\/\s*/, '')

export default function About() {
  const location = useLocation()
  const navigate = useNavigate()
  const activeIndex = Math.max(
    0,
    TABS.findIndex((t) => t.path === location.pathname),
  )
  const active = TABS[activeIndex]?.key || 'tedxklh'
  const data = aboutTabs[active]
  const paras = [data.intro, ...(data.paragraphs || []), data.body].filter(Boolean)
  const [lead, ...rest] = paras

  return (
    <div className="relative overflow-hidden">
      <RedGlow className="left-1/2 -top-24 -translate-x-1/2" size={620} />

      <div className="relative mx-auto max-w-5xl px-6 py-24 md:py-32">
        {/* Relationship chain — shows how each chapter nests inside the last */}
        <nav className="mb-14 flex flex-wrap items-center gap-x-3 gap-y-2 font-mono text-[11px] uppercase tracking-[0.25em]">
          {TABS.map((t, i) => {
            const isActive = t.key === active
            const isPast = i < activeIndex
            return (
              <span key={t.key} className="flex items-center gap-3">
                {i > 0 && (
                  <span aria-hidden className={isActive || isPast ? 'text-red' : 'text-paper/25'}>
                    →
                  </span>
                )}
                <button
                  onClick={() => navigate(t.path)}
                  aria-current={isActive ? 'page' : undefined}
                  className={`rounded-full px-4 py-2 transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-red ${
                    isActive
                      ? 'bg-red text-paper'
                      : isPast
                        ? 'border border-red/40 text-red hover:bg-red/10'
                        : 'border border-paper/15 text-paper/45 hover:border-paper/40 hover:text-paper'
                  }`}
                >
                  {t.label}
                </button>
              </span>
            )
          })}
        </nav>

        {/* Editorial hero — oversized index + eyebrow left, headline right */}
        <header className="grid gap-8 border-b border-paper/10 pb-14 md:grid-cols-[auto,1fr] md:gap-14">
          <div className="flex items-start gap-4 md:flex-col md:gap-3">
            <span className="font-display text-6xl leading-none text-red md:text-7xl">
              0{activeIndex + 1}
            </span>
            <Eyebrow className="mt-2 md:mt-0">{cleanEyebrow(data.eyebrow)}</Eyebrow>
          </div>
          <h1 className="font-display text-4xl leading-[1.02] tracking-tight md:text-6xl">
            {data.h1}
          </h1>
        </header>

        {/* Lead paragraph gets weight; the rest reads as a comfortable column */}
        <div className="mt-14 grid gap-10 md:grid-cols-[1.15fr,0.85fr] md:gap-16">
          {lead && (
            <p className="font-display text-2xl leading-snug text-paper md:text-3xl">
              {lead}
            </p>
          )}
          <div className="space-y-5 text-lg leading-relaxed text-paper/70">
            {rest.map((p, i) => (
              <p key={i}>{p}</p>
            ))}
          </div>
        </div>

        {data.stats && (
          <div className="mt-16 grid grid-cols-2 gap-px overflow-hidden rounded-lg border border-paper/10 bg-paper/10 md:grid-cols-4">
            {data.stats.map((s) => (
              <div key={s.label} className="bg-ink p-6 md:p-8">
                <div className="font-display text-4xl tabular-nums text-red md:text-5xl">
                  {s.value}
                </div>
                <div className="mt-2 text-[11px] uppercase tracking-[0.2em] text-paper/45">
                  {s.label}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Footer row — social links, or the CTA into the crew */}
        <div className="mt-16 flex flex-wrap items-center justify-between gap-6 border-t border-paper/10 pt-12">
          {data.social ? (
            <div className="flex flex-wrap gap-6 font-mono text-[11px] uppercase tracking-[0.2em] text-paper/55">
              {data.social.map((s) => (
                <a
                  key={s.label}
                  href={s.href}
                  className="transition-colors hover:text-red focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-red"
                >
                  {s.label}
                </a>
              ))}
            </div>
          ) : (
            <p className="max-w-md text-sm leading-relaxed text-paper/50">
              A fully student-curated event — curated, produced and staged by the people below.
            </p>
          )}

          <Link
            to="/team"
            className="group inline-flex items-center gap-2 font-mono text-[11px] uppercase tracking-[0.2em] text-red focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-red"
          >
            Meet the crew
            <span aria-hidden className="transition-transform group-hover:translate-x-1">
              →
            </span>
          </Link>
        </div>
      </div>
    </div>
  )
}
