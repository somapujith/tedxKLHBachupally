import { useEffect, useState } from 'react'
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion'
import { useNavigate } from 'react-router-dom'

const COUNT_FROM = 10
const FADE_MS = 900

// Bare full-screen launch sequence: press the button, watch ten seconds fall
// past you, then the black lifts and the home page is underneath.
export default function Launch() {
  const navigate = useNavigate()
  const reduce = useReducedMotion()
  // 'idle' -> 'counting' -> 'exiting'
  const [phase, setPhase] = useState('idle')
  const [count, setCount] = useState(COUNT_FROM)

  // Tick once a second while counting. At zero we hand off to the fade-out.
  useEffect(() => {
    if (phase !== 'counting') return
    const id = setInterval(() => {
      setCount((c) => {
        if (c <= 1) {
          setPhase('exiting')
          return 0
        }
        return c - 1
      })
    }, 1000)
    return () => clearInterval(id)
  }, [phase])

  // The overlay fades to transparent, then we land on Home.
  useEffect(() => {
    if (phase !== 'exiting') return
    const id = setTimeout(() => navigate('/'), reduce ? 0 : FADE_MS)
    return () => clearTimeout(id)
  }, [phase, navigate, reduce])

  const start = () => {
    setCount(COUNT_FROM)
    setPhase('counting')
  }

  return (
    <motion.main
      className="fixed inset-0 z-50 flex items-center justify-center overflow-hidden bg-ink text-paper"
      animate={{ opacity: phase === 'exiting' ? 0 : 1 }}
      transition={{ duration: reduce ? 0 : FADE_MS / 1000, ease: 'easeInOut' }}
    >
      <AnimatePresence mode="wait">
        {phase === 'idle' ? (
          <motion.button
            key="button"
            type="button"
            onClick={start}
            exit={{ opacity: 0, scale: 0.94, filter: 'blur(8px)' }}
            transition={{ duration: reduce ? 0 : 0.4, ease: 'easeIn' }}
            className="group rounded-full border border-paper/25 px-14 py-5 font-display text-lg uppercase tracking-[0.35em] transition-colors duration-300 hover:border-red hover:bg-red hover:text-paper focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red focus-visible:ring-offset-4 focus-visible:ring-offset-ink md:text-xl"
          >
            Launch
          </motion.button>
        ) : (
          <Countdown key="countdown" count={count} reduce={reduce} />
        )}
      </AnimatePresence>
    </motion.main>
  )
}

// One digit at a time. Each falls in from above out of a blur, lands sharp in
// the centre, then keeps falling and blurs back out as the next one arrives.
function Countdown({ count, reduce }) {
  const shown = count > 0 ? count : 1
  // Two-digit numbers get a smaller face so "10" doesn't run off the edges
  // once the 1.35x entry scale is applied.
  const size =
    String(shown).length > 1
      ? 'text-[18vw] md:text-[12vw]'
      : 'text-[28vw] md:text-[18vw]'
  return (
    <div
      className="relative flex h-full w-full items-center justify-center"
      role="timer"
      aria-live="assertive"
      aria-atomic="true"
    >
      {reduce ? (
        <span className={`font-display leading-none tabular-nums ${size}`}>{shown}</span>
      ) : (
        <AnimatePresence mode="popLayout">
          <motion.span
            key={shown}
            className={`absolute font-display leading-none tabular-nums ${size}`}
            initial={{ y: '-70vh', opacity: 0, filter: 'blur(24px)', scale: 1.35 }}
            animate={{ y: 0, opacity: 1, filter: 'blur(0px)', scale: 1 }}
            exit={{ y: '70vh', opacity: 0, filter: 'blur(24px)', scale: 0.75 }}
            transition={{ duration: 0.55, ease: [0.22, 1, 0.36, 1] }}
          >
            {shown}
          </motion.span>
        </AnimatePresence>
      )}
    </div>
  )
}
