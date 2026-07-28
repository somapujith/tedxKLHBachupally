import { volunteerRoles } from '../data/site'
import { Eyebrow, StatusBanner, Reveal } from '../components/ui'

export function Register() {
  return (
    <div className="max-w-2xl mx-auto px-6 py-24 md:py-32">
      <Eyebrow className="mb-5">Register</Eyebrow>
      <h1 className="font-display text-4xl md:text-6xl tracking-tight leading-[1.05] mb-6">Apply to attend.</h1>
      <p className="text-lg text-paper/70 leading-relaxed">
        We curate every room. Tell us who you are and why you'd come — confirmations roll out within seven days.
      </p>
      <StatusBanner
        title="Registrations Closed"
        body="Ticket registration is currently paused. Please check back later or subscribe to our newsletter for announcements."
      />
    </div>
  )
}

export function Volunteer() {
  return (
    <div className="max-w-3xl mx-auto px-6 py-24 md:py-32">
      <Eyebrow className="mb-5">Volunteer</Eyebrow>
      <h1 className="font-display text-4xl md:text-6xl tracking-tight leading-[1.05] mb-6">Build it with us.</h1>
      <p className="text-lg text-paper/70 leading-relaxed max-w-2xl mb-16">
        A TEDxKLH year is twelve months of work for one day on stage. You bring two evenings a week — we'll put your
        name in the credits, in the room, and on your résumé.
      </p>
      <div className="grid md:grid-cols-2 border-t border-l border-paper/10">
        {volunteerRoles.map((r) => (
          <Reveal key={r.title} className="border-b border-r border-paper/10 p-6">
            <div className="font-display text-lg tracking-tight mb-2">{r.title}</div>
            <div className="text-sm text-paper/70 leading-relaxed">{r.body}</div>
          </Reveal>
        ))}
      </div>
      <StatusBanner
        title="Applications Closed"
        body="We are not accepting volunteer applications at this time. Keep an eye on our social handles for future opportunities."
      />
    </div>
  )
}

export function Schedule() {
  return (
    <div className="max-w-2xl mx-auto px-6 py-24 md:py-32">
      <Eyebrow className="mb-5">Schedule</Eyebrow>
      <h1 className="font-display text-4xl md:text-6xl tracking-tight leading-[1.05] mb-6">Coming soon.</h1>
      <p className="text-lg text-paper/70 leading-relaxed">
        We're finalising the day's line-up. Check back soon for the full schedule.
      </p>
      <StatusBanner title="Coming Soon" body="The schedule for this event has not been published yet." />
    </div>
  )
}

export function Nominate() {
  return (
    <div className="max-w-2xl mx-auto px-6 py-24 md:py-32">
      <Eyebrow className="mb-5">Nominate</Eyebrow>
      <h1 className="font-display text-4xl md:text-6xl tracking-tight leading-[1.05] mb-6">
        Know someone who should speak?
      </h1>
      <p className="text-lg text-paper/70 leading-relaxed">
        Curation opens in February. Self-nominations welcome — but the best speakers, in our experience, never
        nominate themselves.
      </p>
      <StatusBanner
        title="Nominations Paused"
        body="Our curation team is busy working with the selected line-up. Speaker nomination is currently paused."
      />
    </div>
  )
}
