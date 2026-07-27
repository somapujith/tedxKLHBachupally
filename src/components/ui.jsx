import { useEffect, useState } from 'react'
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion'
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

// One digit slot. When the character changes, the old glyph rolls up and out
// while the new one falls in from the top — a smooth mechanical odometer.
function FallingDigit({ char, reduce }) {
  return (
    <span className="relative inline-block h-[1em] w-[0.62em] overflow-hidden text-center align-baseline tabular-nums">
      {reduce ? (
        <span className="absolute inset-0">{char}</span>
      ) : (
        <AnimatePresence initial={false} mode="popLayout">
          <motion.span
            key={char}
            className="absolute inset-0"
            initial={{ y: '-105%', opacity: 0 }}
            animate={{ y: '0%', opacity: 1 }}
            exit={{ y: '105%', opacity: 0 }}
            transition={{ type: 'spring', stiffness: 320, damping: 30, mass: 0.7 }}
          >
            {char}
          </motion.span>
        </AnimatePresence>
      )}
    </span>
  )
}

// A two-digit unit (days/hrs/min/sec). Only the digits that actually change
// animate, so seconds tick every beat while minutes roll only on carry.
function CountUnit({ label, value, reduce }) {
  const digits = String(value).padStart(2, '0').split('')
  return (
    <div className="text-center">
      <div className="flex justify-center font-display text-4xl leading-none text-paper sm:text-5xl">
        {digits.map((d, i) => (
          <FallingDigit key={i} char={d} reduce={reduce} />
        ))}
      </div>
      <div className="mt-3 font-mono text-[9px] uppercase tracking-[0.28em] text-paper/40 sm:text-[10px]">
        {label}
      </div>
    </div>
  )
}

export function Countdown({ target }) {
  const reduce = useReducedMotion()
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
      <Eyebrow className="mb-5">The red dot goes live in</Eyebrow>
      <div className="flex items-start gap-4 sm:gap-6">
        {units.map(([label, value], i) => (
          <div key={label} className="flex items-start gap-4 sm:gap-6">
            <CountUnit label={label} value={value} reduce={reduce} />
            {i < units.length - 1 && (
              <span
                aria-hidden
                className="pt-1 font-display text-3xl leading-none text-red/45 sm:text-4xl"
              >
                :
              </span>
            )}
          </div>
        ))}
      </div>
      <div aria-hidden className="mt-5 h-px w-full max-w-[19rem] bg-gradient-to-r from-red/60 via-paper/10 to-transparent" />
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
export function TeamCard({ member, index = 0, showIndex = false }) {
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
            style={member.photoPos ? { objectPosition: member.photoPos } : undefined}
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
            <span className="font-display text-5xl tracking-tight text-paper/30 transition-colors duration-500 group-hover:text-red/45">
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
        {showIndex && (
          <div aria-hidden className="pointer-events-none absolute right-4 top-4 font-mono text-[10px] text-paper/15">
            {String(index + 1).padStart(2, '0')}
          </div>
        )}
      </div>
    </motion.article>
  )
}

// Shared CTA button. Sharp corners, mono uppercase label, brand red.
// Hover = a red panel sweeps in from the left (outline) / a darker sheen sweeps
// across (primary), plus the trailing arrow nudges right. Sweep is a transform on
// a pseudo-layer so it stays GPU-cheap and is fully disabled under reduced motion.
//
// Props:
//   variant   'primary' (red solid) | 'outline' (red border, transparent)  — default 'primary'
//   to        when given, renders a react-router <Link>; otherwise a <button>
//   type      forwarded to <button> (e.g. 'submit'); ignored for links
//   className appended last so callers can tweak width/margins
//   ...rest   forwarded (onClick, disabled, aria-*, etc.)
export function Button({
  variant = 'primary',
  to,
  type,
  className = '',
  children,
  ...rest
}) {
  const base =
    'group/btn relative inline-flex items-center justify-center gap-2 overflow-hidden ' +
    'px-8 py-4 font-mono text-xs uppercase tracking-widest ' +
    'transition-colors duration-300 ease-out ' +
    'focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-red focus-visible:ring-offset-2 focus-visible:ring-offset-ink ' +
    'disabled:cursor-not-allowed disabled:opacity-40 disabled:pointer-events-none'

  // motion-reduce fallbacks give a plain color hover, since the animated sweep
  // layer is hidden under prefers-reduced-motion (see the sweep span below).
  const variants = {
    primary: 'border border-red bg-red text-paper motion-reduce:hover:bg-red/90',
    outline:
      'border border-red bg-transparent text-red hover:text-ink motion-reduce:hover:bg-red',
  }

  // The sweep layer: sits behind the label, scales in from the left on hover.
  // primary -> a subtle ink sheen; outline -> a solid red fill.
  const sweep =
    variant === 'primary'
      ? 'bg-ink/25'
      : 'bg-red'

  const cls = `${base} ${variants[variant]} ${className}`.trim()

  const content = (
    <>
      <span
        aria-hidden
        className={`absolute inset-0 -z-0 origin-left scale-x-0 transition-transform duration-300 ease-out motion-reduce:transition-none motion-reduce:hidden group-hover/btn:scale-x-100 ${sweep}`}
      />
      <span className="relative z-10 flex items-center gap-2">
        {typeof children === 'string' && children.includes('→') ? (
          <ButtonLabel>{children}</ButtonLabel>
        ) : (
          children
        )}
      </span>
    </>
  )

  if (to) {
    return (
      <Link to={to} className={cls} {...rest}>
        {content}
      </Link>
    )
  }
  return (
    <button type={type ?? 'button'} className={cls} {...rest}>
      {content}
    </button>
  )
}

// Splits a trailing "→" out of the label so the arrow can nudge on hover
// independently, without a translate on the whole text block.
function ButtonLabel({ children }) {
  const text = children.replace(/\s*→\s*$/, '')
  return (
    <>
      <span>{text}</span>
      <span
        aria-hidden
        className="inline-block transition-transform duration-300 ease-out motion-reduce:transition-none group-hover/btn:translate-x-1"
      >
        →
      </span>
    </>
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
