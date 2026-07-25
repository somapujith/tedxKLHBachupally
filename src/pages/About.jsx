import { Link, useLocation, useNavigate } from 'react-router-dom'
import { aboutTabs } from '../data/site'
import { Eyebrow } from '../components/ui'
import { RedGlow } from '../components/texture'

const TABS = [
  { key: 'ted', label: 'TED', path: '/about-ted' },
  { key: 'tedx', label: 'TEDx', path: '/about-tedx' },
  { key: 'tedxklh', label: 'TEDxKLH', path: '/about-tedxklh' },
]

// Drop any leading "01 / " numbering from the stored eyebrow strings.
const cleanEyebrow = (s) => s?.replace(/^\s*\d+\s*\/\s*/, '')

export default function About() {
  const location = useLocation()
  const navigate = useNavigate()
  const active = TABS.find((t) => t.path === location.pathname)?.key || 'tedxklh'
  const data = aboutTabs[active]

  return (
    <div className="relative overflow-hidden">
      <RedGlow className="left-1/2 -top-24 -translate-x-1/2" size={620} />
      <div className="relative mx-auto max-w-3xl px-6 py-24 md:py-32">
      <div className="relative flex gap-8 mb-16 font-mono text-[11px] uppercase tracking-[0.25em]">
        {TABS.map((t) => (
          <button
            key={t.key}
            onClick={() => navigate(t.path)}
            className={`pb-2 border-b transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-red ${
              t.key === active ? 'border-red text-red' : 'border-transparent text-paper/40 hover:text-paper'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      <Eyebrow className="mb-5">{cleanEyebrow(data.eyebrow)}</Eyebrow>
      <h1 className="font-display text-4xl md:text-6xl tracking-tight leading-[1.05] mb-10">{data.h1}</h1>

      <div className="space-y-6 text-lg text-paper/70 leading-relaxed max-w-2xl">
        {data.intro && <p>{data.intro}</p>}
        {data.paragraphs?.map((p, i) => (
          <p key={i}>{p}</p>
        ))}
        {data.body && <p>{data.body}</p>}
      </div>

      {data.stats && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-8 mt-16 pt-12 border-t border-paper/10">
          {data.stats.map((s) => (
            <div key={s.label}>
              <div className="font-display text-3xl text-red tabular-nums">{s.value}</div>
              <div className="text-[11px] uppercase tracking-[0.2em] text-paper/40 mt-1">{s.label}</div>
            </div>
          ))}
        </div>
      )}

      {data.social && (
        <div className="flex flex-wrap gap-6 mt-16 pt-12 border-t border-paper/10 font-mono text-[11px] uppercase tracking-[0.2em] text-paper/55">
          {data.social.map((s) => (
            <a
              key={s.label}
              href={s.href}
              className="hover:text-red transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-red"
            >
              {s.label}
            </a>
          ))}
        </div>
      )}

      {!data.stats && !data.social && (
        <div className="mt-16 pt-12 border-t border-paper/10">
          <Link
            to="/team"
            className="inline-flex items-center gap-2 font-mono text-[11px] uppercase tracking-[0.2em] text-red hover:underline focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-red"
          >
            Meet the crew <span aria-hidden>→</span>
          </Link>
        </div>
      )}
      </div>
    </div>
  )
}
