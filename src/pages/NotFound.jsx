import { Link } from 'react-router-dom'
import { SectionLabel } from '../components/ui'

export default function NotFound() {
  return (
    <div className="max-w-2xl mx-auto px-6 py-32 text-center">
      <SectionLabel n="404" label="Off the map" />
      <h1 className="font-display text-5xl mb-4">There's no talk here.</h1>
      <p className="text-paper/70 mb-10">
        This page doesn't exist — but twelve ideas worth spreading do.
      </p>
      <Link
        to="/"
        className="inline-block border border-red px-6 py-3 font-mono text-xs uppercase tracking-widest hover:bg-red transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-red"
      >
        ← Back to the stage
      </Link>
    </div>
  )
}
