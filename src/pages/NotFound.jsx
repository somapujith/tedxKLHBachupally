import { Link } from 'react-router-dom'
import { Eyebrow } from '../components/ui'

export default function NotFound() {
  return (
    <div className="max-w-2xl mx-auto px-6 py-32 md:py-40 text-center">
      <Eyebrow className="mb-5 flex justify-center">404 · Off the map</Eyebrow>
      <h1 className="font-display text-5xl md:text-6xl tracking-tight leading-[1.05] mb-6">There's no talk here.</h1>
      <p className="text-lg text-paper/70 leading-relaxed mb-12">
        This page doesn't exist — but twelve ideas worth spreading do.
      </p>
      <Link
        to="/"
        className="inline-flex items-center gap-2 border border-red px-6 py-3 font-mono text-[11px] uppercase tracking-[0.2em] text-red hover:bg-red hover:text-ink transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-red"
      >
        <span aria-hidden>←</span> Back to the stage
      </Link>
    </div>
  )
}
