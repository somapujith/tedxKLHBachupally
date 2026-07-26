import { useMemo } from 'react'
import { motion, useReducedMotion } from 'framer-motion'

// ── Shared textured design system ──────────────────────────────────────────
// tedxkc-inspired: film grain, binary drift, torn-paper edges, red glow.
// All decorative + aria-hidden. Text always stays crisp on top.

// Fixed film-grain overlay for the whole page. Pure SVG turbulence, no assets.
export function GrainOverlay() {
  return (
    <div
      aria-hidden
      className="pointer-events-none fixed inset-0 z-[1] opacity-[0.05] mix-blend-soft-light"
      style={{
        backgroundImage:
          "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='140' height='140'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E\")",
      }}
    />
  )
}

// Faint drifting columns of 0/1 behind a section. Red-tinted, reduced-motion safe.
export function BinaryDrift({ className = '', columns = 8 }) {
  const reduceMotion = useReducedMotion()
  const cols = useMemo(
    () =>
      Array.from({ length: columns }, (_, i) => {
        // Deterministic pseudo-stream per column (no Math.random for stability).
        const bits = Array.from({ length: 40 }, (_, j) => ((i * 7 + j * 13) % 3 === 0 ? '1' : '0')).join('')
        return { bits, dur: 22 + (i % 5) * 6, delay: (i % 4) * -5 }
      }),
    [columns],
  )
  return (
    <div aria-hidden className={`pointer-events-none absolute inset-0 overflow-hidden ${className}`}>
      <div className="flex h-full justify-between px-2">
        {cols.map((c, i) => (
          <motion.pre
            key={i}
            initial={false}
            animate={reduceMotion ? {} : { y: ['-30%', '0%'] }}
            transition={{ duration: c.dur, delay: c.delay, repeat: Infinity, ease: 'linear' }}
            className="font-mono text-[10px] leading-4 tracking-widest text-red/[0.07] select-none whitespace-pre"
          >
            {c.bits.split('').join('\n')}
          </motion.pre>
        ))}
      </div>
    </div>
  )
}

// Torn-paper divider. Place at top or bottom of a block. color = fill of the tear.
export function TornEdge({ position = 'bottom', className = '', color = '#0A0A0A' }) {
  const flip = position === 'top'
  return (
    <div
      aria-hidden
      className={`pointer-events-none absolute inset-x-0 ${flip ? 'top-0' : 'bottom-0'} h-4 ${className}`}
      style={{ transform: flip ? 'scaleY(-1)' : 'none' }}
    >
      <svg viewBox="0 0 1200 24" preserveAspectRatio="none" className="h-full w-full">
        <path
          d="M0 24 L0 10 Q40 4 80 12 T160 10 Q210 2 260 14 T360 8 Q420 18 480 6 T600 12 Q660 2 720 14 T840 8 Q900 18 960 6 T1080 12 Q1140 4 1200 10 L1200 24 Z"
          fill={color}
        />
      </svg>
    </div>
  )
}

// Soft radial red glow blob. Absolute-position it behind hero/card content.
export function RedGlow({ className = '', size = 480 }) {
  return (
    <div
      aria-hidden
      className={`pointer-events-none absolute rounded-full blur-[100px] ${className}`}
      style={{
        width: size,
        height: size,
        background:
          'radial-gradient(circle, rgba(230,43,30,0.22) 0%, rgba(230,43,30,0.1) 45%, rgba(230,43,30,0) 80%)',
      }}
    />
  )
}
