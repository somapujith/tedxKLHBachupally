import { useEffect, useState } from 'react'
import { motion, useReducedMotion } from 'framer-motion'
import { Eyebrow } from './ui'
import { RedGlow, BinaryDrift } from './texture'

// Shown while the backend is booting and the user's checkout is on hold. The job
// of this screen is honesty plus momentum: say something true about what is
// happening, put a number on the wait, and make the number visibly move.

const HOLDING_LINES = [
  'Holding your place in line — nobody can take this seat while you wait.',
  'Seats for Edition 01 are limited and curated. Yours is being reserved now.',
  'Confirming live seat availability with the box office.',
  'Almost through. Your details are saved and ready to submit.',
]

const READY_LINE = 'Backend is live. Opening secure payment.'

// A pace slow enough to read a full sentence, quick enough that the screen never
// feels frozen.
const ROTATE_MS = 5_000

function formatClock(totalSeconds) {
  const safe = Math.max(0, totalSeconds)
  const minutes = Math.floor(safe / 60)
  const seconds = safe % 60
  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`
}

/**
 * Full-screen queue gate.
 *
 * @param {number}  secondsLeft Countdown remaining on the current wait block.
 * @param {number}  elapsedMs   Time since the queue opened.
 * @param {number}  totalMs     Length of the current wait block, for the progress bar.
 * @param {boolean} ready       Backend answered; we are finishing the countdown.
 * @param {boolean} extended    The wait ran past its first block and was extended.
 */
export default function QueueOverlay({
  secondsLeft = 0,
  elapsedMs = 0,
  totalMs = 1,
  ready = false,
  extended = false,
}) {
  const reduceMotion = useReducedMotion()
  const [lineIndex, setLineIndex] = useState(0)

  useEffect(() => {
    const id = setInterval(() => setLineIndex((i) => (i + 1) % HOLDING_LINES.length), ROTATE_MS)
    return () => clearInterval(id)
  }, [])

  // The overlay covers the form; letting the page scroll underneath it would just
  // move content the user cannot reach.
  useEffect(() => {
    const previous = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = previous
    }
  }, [])

  const progress = Math.min(100, Math.max(0, (elapsedMs / totalMs) * 100))
  const message = ready ? READY_LINE : HOLDING_LINES[lineIndex]

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="queue-title"
      className="fixed inset-0 z-[100] flex items-center justify-center overflow-hidden bg-ink/95 px-6 backdrop-blur-md"
    >
      <BinaryDrift className="opacity-60" columns={10} />
      <RedGlow className="left-1/2 top-1/4 -translate-x-1/2" size={620} />

      <motion.div
        initial={reduceMotion ? false : { opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className="relative w-full max-w-lg text-center"
      >
        <Eyebrow className="mb-5">{ready ? 'You’re through' : 'Seat queue'}</Eyebrow>

        <h2
          id="queue-title"
          className="mb-6 font-display text-3xl leading-[1.08] tracking-tight md:text-5xl"
        >
          {ready ? 'Your seat is being secured.' : 'You’re in the queue.'}
        </h2>

        {/* The clock. tabular-nums so the layout does not jitter every second. */}
        <div className="font-display text-6xl leading-none tabular-nums tracking-tight text-paper md:text-7xl">
          {formatClock(secondsLeft)}
        </div>
        <div className="mt-3 font-mono text-[10px] uppercase tracking-[0.28em] text-paper/40">
          {ready ? 'Finishing up' : 'Estimated wait'}
        </div>

        <div className="mt-8 h-px w-full overflow-hidden bg-paper/10">
          <motion.div
            className="h-full bg-red"
            initial={false}
            animate={{ width: `${progress}%` }}
            transition={reduceMotion ? { duration: 0 } : { duration: 0.25, ease: 'linear' }}
          />
        </div>

        {/* aria-live so a screen reader hears the status change without the
            countdown digits being announced thirty times. */}
        <p aria-live="polite" className="mx-auto mt-8 max-w-md text-base leading-relaxed text-paper/70">
          {message}
        </p>

        {extended && !ready && (
          <p className="mt-4 font-mono text-[10px] uppercase tracking-[0.2em] text-red/80">
            Heavy demand — extending your hold
          </p>
        )}

        <p className="mt-10 text-xs leading-relaxed text-paper/40">
          Keep this tab open. Closing it drops your place in line, and nothing has been charged
          yet.
        </p>
      </motion.div>
    </div>
  )
}
