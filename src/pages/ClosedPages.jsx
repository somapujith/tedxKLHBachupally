import { volunteerRoles } from '../data/site'
import { SectionLabel, StatusBanner, Reveal } from '../components/ui'

export function Register() {
  return (
    <div className="max-w-2xl mx-auto px-6 py-24">
      <SectionLabel n="11" label="Register · Reserve a seat" />
      <h1 className="font-display text-4xl mb-4">Apply to attend.</h1>
      <p className="text-paper/70">
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
    <div className="max-w-3xl mx-auto px-6 py-24">
      <SectionLabel n="12" label="Volunteer · Join the crew" />
      <h1 className="font-display text-4xl mb-4">Build it with us.</h1>
      <p className="text-paper/70 mb-12">
        A TEDxKLH year is twelve months of work for one day on stage. You bring two evenings a week — we'll put your
        name in the credits, in the room, and on your résumé.
      </p>
      <div className="grid md:grid-cols-2 gap-6">
        {volunteerRoles.map((r) => (
          <Reveal key={r.title} className="border border-paper/20 p-5">
            <div className="font-display text-lg mb-2">{r.title}</div>
            <div className="text-sm text-paper/70">{r.body}</div>
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

export function Nominate() {
  return (
    <div className="max-w-2xl mx-auto px-6 py-24">
      <SectionLabel n="14" label="Nominate · Curate with us" />
      <h1 className="font-display text-4xl mb-4">Know someone who should speak?</h1>
      <p className="text-paper/70">
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
