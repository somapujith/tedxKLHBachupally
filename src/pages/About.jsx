import { useLocation, useNavigate } from 'react-router-dom'
import { aboutTabs } from '../data/site'

const TABS = [
  { key: 'ted', label: 'About TED', path: '/about-ted' },
  { key: 'tedx', label: 'About TEDx', path: '/about-tedx' },
  { key: 'tedxklh', label: 'About TEDxKLH', path: '/about-tedxklh' },
]

export default function About() {
  const location = useLocation()
  const navigate = useNavigate()
  const active = TABS.find((t) => t.path === location.pathname)?.key || 'tedxklh'
  const data = aboutTabs[active]

  return (
    <div className="max-w-3xl mx-auto px-6 py-24">
      <div className="flex gap-6 border-b border-paper/20 mb-12 font-mono text-xs uppercase tracking-widest">
        {TABS.map((t) => (
          <button
            key={t.key}
            onClick={() => navigate(t.path)}
            className={`pb-4 border-b-2 -mb-px transition-colors ${
              t.key === active ? 'border-red text-red' : 'border-transparent text-paper/60 hover:text-paper'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      <div className="font-mono text-xs uppercase tracking-widest text-paper/50 mb-4">{data.eyebrow}</div>
      <h1 className="font-display text-4xl mb-8">{data.h1}</h1>

      {data.intro && <p className="text-paper/70 mb-6">{data.intro}</p>}
      {data.paragraphs?.map((p, i) => (
        <p key={i} className="text-paper/70 mb-6 leading-relaxed">
          {p}
        </p>
      ))}
      {data.body && <p className="text-paper/70 mb-6 leading-relaxed">{data.body}</p>}

      {data.stats && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-6 mt-10">
          {data.stats.map((s) => (
            <div key={s.label}>
              <div className="font-display text-2xl text-red">{s.value}</div>
              <div className="text-xs uppercase tracking-widest text-paper/60">{s.label}</div>
            </div>
          ))}
        </div>
      )}

      {data.social && (
        <div className="flex gap-6 mt-10 font-mono text-xs uppercase tracking-widest">
          {data.social.map((s) => (
            <a key={s.label} href={s.href} className="hover:text-red">
              {s.label}
            </a>
          ))}
        </div>
      )}
    </div>
  )
}
