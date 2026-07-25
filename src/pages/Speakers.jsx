import { Eyebrow, Reveal } from '../components/ui'

const PLACEHOLDER_COUNT = 12

export default function Speakers() {
  return (
    <div className="max-w-5xl mx-auto px-6 py-24 md:py-32">
      <Eyebrow className="mb-5">Speakers</Eyebrow>
      <h1 className="font-display text-4xl md:text-6xl tracking-tight leading-[1.05] mb-6">
        Twelve voices.
      </h1>
      <p className="text-lg text-paper/70 leading-relaxed max-w-2xl mb-20">
        Our {PLACEHOLDER_COUNT} speakers for the 2026 edition are being finalized.
        Portraits and talks reveal soon.
      </p>

      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4 md:gap-6">
        {Array.from({ length: PLACEHOLDER_COUNT }, (_, i) => (
          <Reveal key={i}>
            <div className="group relative aspect-[3/4] overflow-hidden border border-paper/10 bg-paper/[0.03]">
              <div className="absolute inset-0 flex flex-col items-center justify-center gap-3">
                <svg
                  viewBox="0 0 24 24"
                  className="h-8 w-8 text-paper/30"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.5"
                  aria-hidden="true"
                >
                  <rect x="4" y="10.5" width="16" height="10.5" rx="1.5" />
                  <path d="M8 10.5V7a4 4 0 0 1 8 0v3.5" />
                  <circle cx="12" cy="15.5" r="1.25" fill="currentColor" stroke="none" />
                </svg>
                <span className="font-mono text-[11px] uppercase tracking-[0.2em] text-paper/40">
                  Speaker {String(i + 1).padStart(2, '0')}
                </span>
              </div>
            </div>
          </Reveal>
        ))}
      </div>
    </div>
  )
}
