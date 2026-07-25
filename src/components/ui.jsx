import { useEffect, useState } from 'react'
import { motion, useReducedMotion } from 'framer-motion'
import { Link } from 'react-router-dom'

export function SectionLabel({ n, label }) {
  return (
    <div className="section-number mb-4">
      {n} — {label}
    </div>
  )
}

function timeLeft(target) {
  const diff = Math.max(0, new Date(target).getTime() - Date.now())
  const s = Math.floor(diff / 1000)
  return {
    days: Math.floor(s / 86400),
    hrs: Math.floor((s % 86400) / 3600),
    min: Math.floor((s % 3600) / 60),
    sec: s % 60,
  }
}

export function Countdown({ target }) {
  const [t, setT] = useState(() => timeLeft(target))
  useEffect(() => {
    const id = setInterval(() => setT(timeLeft(target)), 1000)
    return () => clearInterval(id)
  }, [target])
  const units = [
    ['Days', t.days],
    ['Hrs', t.hrs],
    ['Min', t.min],
    ['Sec', t.sec],
  ]
  return (
    <div>
      <div className="section-number mb-2">Countdown to stage</div>
      <div className="flex gap-6">
        {units.map(([label, value]) => (
          <div key={label}>
            <div className="font-display text-3xl">{String(value).padStart(2, '0')}</div>
            <div className="text-xs uppercase tracking-widest text-paper/60">{label}</div>
          </div>
        ))}
      </div>
    </div>
  )
}

export function SpeakerCard({ speaker }) {
  return (
    <Link
      to={`/events/1/speakers/${speaker.slug}`}
      className="group block border border-paper/20 p-5 hover:border-red transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-red"
    >
      <div className="font-mono text-xs text-red mb-3">{String(speaker.n).padStart(2, '0')}</div>
      <div className="font-display text-lg mb-1 group-hover:text-red transition-colors">{speaker.name}</div>
      <div className="text-sm text-paper/60 mb-2">{speaker.role}</div>
      <div className="text-sm italic">&ldquo;{speaker.talk}&rdquo;</div>
    </Link>
  )
}

export function StatusBanner({ title, body }) {
  return (
    <div className="border border-red/50 p-8 mt-10">
      <div className="font-mono text-xs text-red uppercase tracking-widest mb-2">{title}</div>
      <p className="text-paper/70">{body}</p>
    </div>
  )
}

export function Reveal({ children, className = '' }) {
  const reduceMotion = useReducedMotion()
  return (
    <motion.div
      initial={reduceMotion ? false : { opacity: 0, y: 24 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: '-80px' }}
      transition={{ duration: 0.5 }}
      className={className}
    >
      {children}
    </motion.div>
  )
}
