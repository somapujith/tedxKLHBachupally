import { Eyebrow, StatusBanner } from '../components/ui'

export default function Speakers() {
  return (
    <div className="max-w-2xl mx-auto px-6 py-24 md:py-32">
      <Eyebrow className="mb-5">Speakers · 2026 edition</Eyebrow>
      <h1 className="font-display text-4xl md:text-6xl tracking-tight leading-[1.05] mb-6">Revealing soon.</h1>
      <p className="text-lg text-paper/70 leading-relaxed">
        We announce speakers one silhouette at a time. Check back soon — or claim a seat and find out in the room.
      </p>
      <StatusBanner title="Revealing Soon" body="The 2026 speaker lineup has not been announced yet." />
    </div>
  )
}
