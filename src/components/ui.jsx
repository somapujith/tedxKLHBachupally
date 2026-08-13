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
      <Eyebrow className="mb-5">The red circle goes live in</Eyebrow>
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

export function StatusBanner({ title, body }) {
  return (
    <div className="border border-red/50 p-8 mt-10">
      <div className="font-mono text-xs text-red uppercase tracking-widest mb-2">{title}</div>
      <p className="text-paper/70">{body}</p>
    </div>
  )
}

// Shared "no photo yet" fill: a monogram over a faint binary-code texture.
// Team, Speakers and SpeakerDetail all render this for `photo: null`, so a
// person reads the same "placeholder, not broken image" language everywhere
// instead of three pages inventing three different treatments.
export function PortraitPlaceholder({ name, size = 'text-5xl' }) {
  return (
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
      <span className={`relative font-display ${size} tracking-tight text-paper/30 transition-colors duration-500 group-hover:text-red/45`}>
        {initials(name)}
      </span>
    </div>
  )
}

// Deterministic initials from a full name (max 2 chars).
export function initials(name) {
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
// Brand marks for the per-member social links. Both are single-path glyphs
// drawn on a 24-box and filled with currentColor, so they pick up the card's
// text colour and its hover transition instead of needing their own assets.
const SOCIAL_ICONS = {
  linkedin: {
    label: 'LinkedIn',
    path: 'M20.45 20.45h-3.55v-5.57c0-1.33-.02-3.03-1.85-3.03-1.85 0-2.14 1.45-2.14 2.94v5.66H9.36V9h3.41v1.56h.05c.47-.9 1.63-1.85 3.36-1.85 3.6 0 4.27 2.37 4.27 5.45v6.29zM5.34 7.43a2.06 2.06 0 1 1 0-4.12 2.06 2.06 0 0 1 0 4.12zM7.12 20.45H3.56V9h3.56v11.45z',
  },
  github: {
    label: 'GitHub',
    path: 'M12 .3a12 12 0 0 0-3.79 23.4c.6.1.82-.26.82-.58l-.01-2.04c-3.34.72-4.04-1.61-4.04-1.61-.55-1.39-1.34-1.76-1.34-1.76-1.09-.75.08-.73.08-.73 1.2.08 1.84 1.24 1.84 1.24 1.07 1.83 2.81 1.3 3.5 1 .1-.78.42-1.31.76-1.61-2.67-.3-5.47-1.33-5.47-5.93 0-1.31.47-2.38 1.24-3.22-.13-.3-.54-1.52.11-3.18 0 0 1.01-.32 3.3 1.23a11.5 11.5 0 0 1 6.003 0c2.29-1.55 3.3-1.23 3.3-1.23.65 1.66.24 2.88.12 3.18.77.84 1.23 1.91 1.23 3.22 0 4.61-2.8 5.62-5.48 5.92.43.37.82 1.1.82 2.22l-.01 3.29c0 .32.21.69.82.57A12 12 0 0 0 12 .3z',
  },
}

// Small icon row under the name. Renders only the platforms present on the
// member, so a member with no socials adds no markup and no empty gap.
function SocialLinks({ socials, name }) {
  const entries = Object.entries(socials).filter(([platform, url]) => url && SOCIAL_ICONS[platform])
  if (entries.length === 0) return null
  return (
    <div className="mt-3 flex items-center gap-3">
      {entries.map(([platform, url]) => {
        const icon = SOCIAL_ICONS[platform]
        return (
          <a
            key={platform}
            href={url}
            target="_blank"
            rel="noreferrer"
            aria-label={`${name} on ${icon.label}`}
            className="text-paper/50 transition-colors duration-200 hover:text-red focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-red"
          >
            <svg viewBox="0 0 24 24" aria-hidden="true" className="h-[18px] w-[18px]" fill="currentColor">
              <path d={icon.path} />
            </svg>
          </a>
        )
      })}
    </div>
  )
}

export function TeamCard({ member, index = 0, showIndex = false }) {
  const reduceMotion = useReducedMotion()
  return (
    <motion.article
      initial={reduceMotion ? false : { opacity: 0, y: 24 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.45, delay: (index % 8) * 0.05 }}
      className="group relative overflow-hidden border border-paper/10 bg-paper/[0.02] transition-all duration-300 hover:border-red/50 hover:-translate-y-1"
    >
      {/* Portrait — taller than the old square, so the frame carries more of
          the card's weight now that the grid runs 3-wide instead of 4. */}
      <div className="relative aspect-[4/5] overflow-hidden bg-ink">
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
            <span className="font-display text-6xl tracking-tight text-paper/30 transition-colors duration-500 group-hover:text-red/45">
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
      <div className="relative px-5 py-5">
        <div className="font-display text-lg tracking-tight leading-tight md:text-xl">{member.name}</div>
        {member.role && (
          <div className="mt-1.5 font-mono text-[10px] uppercase tracking-[0.2em] text-red">{member.role}</div>
        )}
        {member.bio && <p className="mt-3 text-sm leading-relaxed text-paper/60">{member.bio}</p>}
        {member.socials && <SocialLinks socials={member.socials} name={member.name} />}
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
