import { useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { event, speakers, schedule, galleryTiles, experience } from '../data/site'
import { SpeakerCard, Reveal } from '../components/ui'

const TABS = [
  { key: 'overview', label: 'Overview', path: '/events/1' },
  { key: 'speakers', label: 'Speakers', path: '/events/1/speakers' },
  { key: 'schedule', label: 'Schedule', path: '/events/1/schedule' },
  { key: 'gallery', label: 'Gallery', path: '/events/1/gallery' },
  { key: 'experience', label: 'Experience', path: '/events/1/experience' },
]

export default function EventDetail() {
  const location = useLocation()
  const navigate = useNavigate()
  const active = TABS.find((t) => t.path === location.pathname)?.key || 'overview'
  const [openSession, setOpenSession] = useState(null)

  return (
    <div className="max-w-5xl mx-auto px-6 py-24 md:py-28">
      <Link
        to="/events"
        className="inline-flex items-center gap-2 font-mono text-[11px] uppercase tracking-[0.2em] text-paper/40 hover:text-red transition-colors"
      >
        <span aria-hidden>←</span> Back to editions
      </Link>

      <div className="font-mono text-[11px] uppercase tracking-[0.2em] text-paper/40 mt-8 mb-3">
        TEDxKLH Bachupally · {event.edition} · {event.year}
      </div>
      <h1 className="font-display text-3xl md:text-5xl tracking-tight leading-[1.05] mb-4">{event.title}</h1>
      <div className="text-[11px] uppercase tracking-[0.2em] text-paper/40 mb-12">
        {event.date} · {event.venue}, {event.city}
      </div>

      <div className="flex gap-5 md:gap-8 border-b border-paper/10 mb-16 font-mono text-[11px] uppercase tracking-[0.2em] overflow-x-auto [mask-image:linear-gradient(to_right,black_88%,transparent)] md:[mask-image:none]">
        {TABS.map((t) => (
          <button
            key={t.key}
            onClick={() => navigate(t.path)}
            className={`pb-4 border-b -mb-px whitespace-nowrap transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-red ${
              t.key === active ? 'border-red text-red' : 'border-transparent text-paper/40 hover:text-paper'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {active === 'overview' && (
        <div className="grid md:grid-cols-2 gap-16">
          <Reveal>
            <h3 className="font-display text-xl tracking-tight mb-4">About the edition</h3>
            <p className="text-lg text-paper/70 leading-relaxed">{event.description}</p>
          </Reveal>
          <Reveal className="grid grid-cols-2 gap-8 content-start">
            {[[event.year, 'Year'], ['01', 'Edition ID'], ['12', 'Speakers'], [event.guests, 'Guests']].map(([v, l]) => (
              <div key={l}>
                <div className="font-display text-3xl text-red tabular-nums">{v}</div>
                <div className="text-[11px] uppercase tracking-[0.2em] text-paper/40 mt-1">{l}</div>
              </div>
            ))}
          </Reveal>
        </div>
      )}

      {active === 'speakers' && (
        <div className="border-b border-paper/10">
          {speakers.map((s) => (
            <SpeakerCard key={s.slug} speaker={s} />
          ))}
        </div>
      )}

      {active === 'schedule' && (
        <div className="border-t border-paper/10">
          {schedule.map((item) => (
            <div key={item.time} className="border-b border-paper/10">
              <button
                onClick={() => item.slugs && setOpenSession(openSession === item.time ? null : item.time)}
                className="flex gap-6 w-full text-left items-center py-5 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-red"
              >
                <div className="font-mono text-sm text-red w-16 shrink-0 tabular-nums">{item.time}</div>
                <div className="text-paper/80 flex-1">{item.label}</div>
                {item.slugs && <span className="text-paper/40 font-mono">{openSession === item.time ? '−' : '+'}</span>}
              </button>
              {item.slugs && openSession === item.time && (
                <div className="pl-[88px] pb-5 -mt-1 text-sm text-paper/50">
                  Featuring:{' '}
                  {item.slugs.map((slug) => speakers.find((s) => s.slug === slug)?.name).join(' · ')}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {active === 'gallery' && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {galleryTiles.map((tile) => (
            <div
              key={tile}
              className="aspect-square border border-paper/10 flex items-center justify-center text-center px-2 text-[11px] font-mono uppercase tracking-[0.2em] text-paper/40 hover:border-paper/40 hover:text-paper/70 transition-colors"
            >
              {tile}
            </div>
          ))}
        </div>
      )}

      {active === 'experience' && (
        <div className="grid md:grid-cols-3 gap-10">
          {experience.map((e) => (
            <Reveal key={e.title}>
              <h3 className="font-display text-xl tracking-tight mb-3 pt-6 border-t border-paper/10">{e.title}</h3>
              <p className="text-paper/70 leading-relaxed">{e.body}</p>
            </Reveal>
          ))}
        </div>
      )}
    </div>
  )
}
