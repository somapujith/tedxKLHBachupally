import { Eyebrow, Button } from '../components/ui'

export default function NotFound() {
  return (
    <div className="max-w-2xl mx-auto px-6 py-32 md:py-40 text-center">
      <Eyebrow className="mb-5 flex justify-center">404 · Off the map</Eyebrow>
      <h1 className="font-display text-5xl md:text-6xl tracking-tight leading-[1.05] mb-6">There's no talk here.</h1>
      <p className="text-lg text-paper/70 leading-relaxed mb-12">
        This page doesn't exist — but five ideas worth spreading do.
      </p>
      <Button to="/" variant="outline" className="px-6 py-3 text-[11px] !tracking-[0.2em]">
        <span
          aria-hidden
          className="inline-block transition-transform duration-300 ease-out motion-reduce:transition-none group-hover/btn:-translate-x-1"
        >
          ←
        </span>{' '}
        Back to the stage
      </Button>
    </div>
  )
}
