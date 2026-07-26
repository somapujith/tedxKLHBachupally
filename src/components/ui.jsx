import { useEffect, useState } from 'react'
import { motion, useReducedMotion } from 'framer-motion'
import { Link } from 'react-router-dom'

// Clean, minimal eyebrow — quiet muted label, no numbering.
export function Eyebrow({ children, className = '' }) {
  return (
    <div className={`font-mono text-[11px] uppercase tracking-[0.25em] text-paper/55 ${className}`}>
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
      <Eyebrow className="mb-4">The red dot goes live in</Eyebrow>
      <div className="flex items-stretch gap-2 sm:gap-3">
        {units.map(([label, value], i) => (
          <div key={label} className="flex items-stretch">
            <div className="relative min-w-[54px] border border-paper/15 bg-paper/[0.03] px-3 py-3 text-center sm:min-w-[68px] sm:px-4">
              <span aria-hidden className="absolute left-0 top-0 h-px w-4 bg-red" />
              <span aria-hidden className="absolute right-0 bottom-0 h-px w-4 bg-red" />
              <div className="font-display text-3xl tabular-nums leading-none sm:text-4xl">
                {String(value).padStart(2, '0')}
              </div>
              <div className="mt-2 font-mono text-[9px] uppercase tracking-[0.2em] text-paper/45 sm:text-[10px]">
                {label}
              </div>
            </div>
            {i < units.length - 1 && (
              <span aria-hidden className="self-center px-0.5 font-display text-2xl text-red/60 sm:px-1">
                :
              </span>
            )}
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
        <span className="font-mono text-[11px] uppercase tracking-widest text-paper/55">{speaker.category}</span>
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

// Deterministic initials from a full name (max 2 chars).
function initials(name) {
  return name
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0])
    .join('')
    .toUpperCase()
}

// Textured team member card — portrait (photo or generated monogram) + name + dept.
// tedxkc treatment: grayscale->color on hover, binary corner, torn edge, red lift.
export function TeamCard({ member, index = 0 }) {
  const reduceMotion = useReducedMotion()
  return (
    <motion.article
      initial={reduceMotion ? false : { opacity: 0, y: 24 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.45, delay: (index % 8) * 0.05 }}
      className="group relative overflow-hidden border border-paper/10 bg-paper/[0.02] transition-all duration-300 hover:border-red/50 hover:-translate-y-1"
    >
      {/* Portrait */}
      <div className="relative aspect-square overflow-hidden bg-ink">
        {member.photo ? (
          <img
            src={member.photo}
            alt={member.name}
            loading="lazy"
            className="h-full w-full object-cover grayscale contrast-125 transition-all duration-500 group-hover:grayscale-0 group-hover:scale-105"
          />
        ) : (
          <div className="relative flex h-full w-full items-center justify-center bg-gradient-to-br from-ink to-[#171717]">
            <div
              aria-hidden
              className="pointer-events-none absolute inset-0 select-none overflow-hidden p-2 font-mono text-[9px] leading-3 tracking-widest text-red/[0.09]"
            >
              {Array.from({ length: 10 }).map((_, i) => (
                <div key={i}>
                  {(i * 3) % 2 ? '01001010' : '10110100'}
                  {(i * 5) % 2 ? '0110' : '1001'}
                </div>
              ))}
            </div>
            <span className="font-display text-5xl tracking-tight text-paper/15 transition-colors duration-500 group-hover:text-red/45">
              {initials(member.name)}
            </span>
          </div>
        )}
        <div aria-hidden className="pointer-events-none absolute inset-x-0 bottom-0 h-3">
          <svg viewBox="0 0 400 12" preserveAspectRatio="none" className="h-full w-full">
            <path d="M0 12 L0 6 Q40 2 80 7 T160 5 Q210 1 260 8 T360 4 Q380 9 400 5 L400 12 Z" fill="#0A0A0A" />
          </svg>
        </div>
      </div>

      {/* Body */}
      <div className="relative px-4 py-4">
        <div className="font-display text-base tracking-tight leading-tight">{member.name}</div>
        {member.role ? (
          <div className="mt-1 font-mono text-[10px] uppercase tracking-[0.2em] text-red">{member.role}</div>
        ) : (
          <div className="mt-1 font-mono text-[10px] uppercase tracking-[0.2em] text-paper/40">{member.dept}</div>
        )}
        {member.bio && <p className="mt-3 text-sm leading-relaxed text-paper/60">{member.bio}</p>}
        <div aria-hidden className="pointer-events-none absolute right-4 top-4 font-mono text-[10px] text-paper/15">
          {String(index + 1).padStart(2, '0')}
        </div>
      </div>
    </motion.article>
  )
}

export function Reveal({ children, className = '' }) {
  const reduceMotion = useReducedMotion()
  return (
    <motion.div
      initial={reduceMotion ? false : { opacity: 0, y: 24 }}
      whileInView={{ opacity: 1, y: 0 }}
      // amount:0 fires as soon as any part enters (or is already in) the viewport,
      // so above-the-fold blocks reveal on mount instead of waiting for a scroll.
      viewport={{ once: true, amount: 0, margin: '0px 0px -10% 0px' }}
      transition={{ duration: 0.5 }}
      className={className}
    >
      {children}
    </motion.div>
  )
}
