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
    <div className="max-w-6xl mx-auto px-6 py-16">
      <Link to="/events" className="font-mono text-xs uppercase tracking-widest text-paper/50 hover:text-red">
        ← Back to Events
      </Link>
      <div className="font-mono text-xs uppercase tracking-widest text-paper/50 mt-6 mb-2">
        TEDxKLH Bachupally {event.edition} · {event.year}
      </div>
      <h1 className="font-display text-3xl md:text-4xl mb-3">{event.title}</h1>
      <div className="text-paper/60 mb-10">{event.date} · {event.venue}, {event.city}</div>

      <div className="flex gap-6 border-b border-paper/20 mb-12 font-mono text-xs uppercase tracking-widest overflow-x-auto">
        {TABS.map((t) => (
          <button
            key={t.key}
            onClick={() => navigate(t.path)}
            className={`pb-4 border-b-2 -mb-px whitespace-nowrap transition-colors ${
              t.key === active ? 'border-red text-red' : 'border-transparent text-paper/60 hover:text-paper'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {active === 'overview' && (
        <div className="grid md:grid-cols-2 gap-12">
          <Reveal>
            <h3 className="font-display text-xl mb-3">About the Edition</h3>
            <p className="text-paper/70">{event.description}</p>
          </Reveal>
          <Reveal className="grid grid-cols-2 gap-6">
            {[[event.year, 'Year'], ['01', 'Edition ID'], ['12', 'Speakers'], [event.guests, 'Guests']].map(([v, l]) => (
              <div key={l}>
                <div className="font-display text-2xl text-red">{v}</div>
                <div className="text-xs uppercase tracking-widest text-paper/60">{l}</div>
              </div>
            ))}
          </Reveal>
        </div>
      )}

      {active === 'speakers' && (
        <div className="grid md:grid-cols-3 gap-6">
          {speakers.map((s) => (
            <SpeakerCard key={s.slug} speaker={s} />
          ))}
        </div>
      )}

      {active === 'schedule' && (
        <div className="divide-y divide-paper/10 border-y border-paper/10">
          {schedule.map((item) => (
            <div key={item.time} className="py-4">
              <button
                onClick={() => item.slugs && setOpenSession(openSession === item.time ? null : item.time)}
                className="flex gap-6 w-full text-left items-center"
              >
                <div className="font-mono text-sm text-red w-16 shrink-0">{item.time}</div>
                <div className="text-paper/80 flex-1">{item.label}</div>
                {item.slugs && <span className="text-paper/50">{openSession === item.time ? '−' : '+'}</span>}
              </button>
              {item.slugs && openSession === item.time && (
                <div className="pl-[88px] mt-3 text-sm text-paper/60">
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
              className="aspect-square border border-paper/20 flex items-center justify-center text-center px-2 text-xs font-mono uppercase tracking-widest"
            >
              {tile}
            </div>
          ))}
        </div>
      )}

      {active === 'experience' && (
        <div className="grid md:grid-cols-3 gap-8">
          {experience.map((e) => (
            <Reveal key={e.title} className="border border-paper/20 p-6">
              <h3 className="font-display text-lg mb-2">{e.title}</h3>
              <p className="text-sm text-paper/70">{e.body}</p>
            </Reveal>
          ))}
        </div>
      )}
    </div>
  )
}
