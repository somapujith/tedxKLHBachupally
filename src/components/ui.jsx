import { useEffect, useState } from 'react'
import { motion, useReducedMotion } from 'framer-motion'
import { Link } from 'react-router-dom'

// Clean, minimal eyebrow — quiet muted label, no numbering.
export function Eyebrow({ children, className = '' }) {
  return (
    <div className={`font-mono text-[11px] uppercase tracking-[0.25em] text-paper/40 ${className}`}>
      {children}
    </div>
  )
}

// Consistent vertical rhythm + centered content column for every section.
export function Section({ children, className = '', divider = true }) {
  return (
    <section
      className={`px-6 ${divider ? 'border-t border-paper/10' : ''} ${className}`}
    >
      <div className="max-w-5xl mx-auto py-24 md:py-32">{children}</div>
    </section>
  )
}

// Backward-compatible: renders only the clean label, number is ignored.
export function SectionLabel({ label }) {
  return <Eyebrow className="mb-4">{label}</Eyebrow>
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
      <Eyebrow className="mb-3">Countdown to stage</Eyebrow>
      <div className="flex gap-8">
        {units.map(([label, value]) => (
          <div key={label}>
            <div className="font-display text-4xl tabular-nums">{String(value).padStart(2, '0')}</div>
            <div className="text-[11px] uppercase tracking-widest text-paper/50 mt-1">{label}</div>
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
      className="group block py-6 border-t border-paper/10 hover:border-paper/40 transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-red"
    >
      <div className="flex items-baseline justify-between mb-3">
        <span className="font-display text-xl group-hover:text-red transition-colors">{speaker.name}</span>
        <span className="font-mono text-[11px] uppercase tracking-widest text-paper/40">{speaker.category}</span>
      </div>
      <div className="text-sm text-paper/50 mb-1">{speaker.role}</div>
      <div className="text-sm text-paper/80">&ldquo;{speaker.talk}&rdquo;</div>
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
