import { motion } from 'framer-motion'
import { Eyebrow } from '../components/ui'
import { BinaryDrift, RedGlow } from '../components/texture'

const PLACEHOLDER_COUNT = 12

export default function Speakers() {
  return (
    <div>
      {/* Hero */}
      <section className="relative overflow-hidden border-b border-paper/10 px-6">
        <RedGlow className="-left-32 -top-24" size={520} />
        <BinaryDrift className="opacity-50" columns={12} />
        <div className="relative mx-auto max-w-5xl py-24 md:py-32">
          <Eyebrow className="mb-5">Speakers · 2026 edition</Eyebrow>
          <h1 className="font-display text-4xl leading-[1.05] tracking-tight md:text-6xl">
            Twelve voices, <span className="text-red">still under wraps.</span>
          </h1>
          <p className="mt-6 max-w-2xl text-lg leading-relaxed text-paper/70">
            We announce speakers one silhouette at a time. The lineup below fills in as each
            name is locked — check back, or claim a seat and find out in the room.
          </p>
        </div>
      </section>

      {/* Silhouette grid */}
      <div className="mx-auto max-w-5xl px-6 py-16 md:py-24">
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:gap-6 lg:grid-cols-4">
          {Array.from({ length: PLACEHOLDER_COUNT }, (_, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4, delay: (i % 8) * 0.05 }}
              className="group relative aspect-[3/4] overflow-hidden border border-paper/10 bg-gradient-to-br from-ink to-[#161616] transition-colors duration-300 hover:border-red/40"
            >
              {/* binary corner */}
              <div
                aria-hidden
                className="pointer-events-none absolute inset-0 select-none overflow-hidden p-2 font-mono text-[9px] leading-3 tracking-widest text-red/[0.08]"
              >
                {Array.from({ length: 12 }).map((_, j) => (
                  <div key={j}>{(i + j) % 2 ? '01101001' : '10010110'}</div>
                ))}
              </div>
              {/* silhouette bust */}
              <svg
                viewBox="0 0 24 24"
                className="absolute inset-0 m-auto h-14 w-14 text-paper/12 transition-colors duration-500 group-hover:text-red/30"
                fill="currentColor"
                aria-hidden="true"
              >
                <circle cx="12" cy="8" r="4" />
                <path d="M4 21c0-4.4 3.6-7 8-7s8 2.6 8 7z" />
              </svg>
              <div className="absolute inset-x-0 bottom-0 border-t border-paper/10 bg-ink/60 px-3 py-2 backdrop-blur-sm">
                <span className="font-mono text-[10px] uppercase tracking-[0.2em] text-paper/45">
                  Speaker {String(i + 1).padStart(2, '0')}
                </span>
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </div>
  )
}
