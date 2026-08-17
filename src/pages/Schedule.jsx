import { Link } from 'react-router-dom'
import { event, schedule, speakers, isRevealed } from '../data/site'
import { Eyebrow, Reveal, Button, PortraitPlaceholder } from '../components/ui'
import { BinaryDrift, RedGlow } from '../components/texture'

// ── Time helpers ───────────────────────────────────────────────────────────
// Every row in `schedule` carries a human range ("10:00 AM – 10:20 AM"). The
// page needs those as numbers in three places — total runtime, each block's
// span, and the proportional day-shape bar — so parsing lives here once and
// every derived figure on the page reads off the data instead of a constant
// somebody has to remember to update.

const DASH = /\s*[–—-]\s*/

function toMinutes(label) {
  const m = String(label).trim().match(/^(\d{1,2}):(\d{2})\s*(AM|PM)$/i)
  if (!m) return null
  const hour = Number(m[1]) % 12 + (/pm/i.test(m[3]) ? 12 : 0)
  return hour * 60 + Number(m[2])
}

// "10:00 AM – 10:20 AM" -> { start: 600, end: 620, startLabel, endLabel }
function parseRange(time) {
  const [startLabel = '', endLabel = ''] = String(time).split(DASH)
  return { start: toMinutes(startLabel), end: toMinutes(endLabel), startLabel, endLabel }
}

function spanOf(rows) {
  const first = parseRange(rows[0].time)
  const last = parseRange(rows[rows.length - 1].time)
  return {
    startLabel: first.startLabel,
    endLabel: last.endLabel,
    minutes: first.start != null && last.end != null ? last.end - first.start : null,
  }
}

// 390 -> "6.5", 360 -> "6". Trailing ".0" reads like a spec sheet, not a day.
function formatHours(minutes) {
  if (minutes == null) return '—'
  return String(Number((minutes / 60).toFixed(1)))
}

// ── Kind vocabulary ────────────────────────────────────────────────────────
// Everything that isn't a talk is a "program note": it gets the muted, dashed,
// unnumbered treatment so the eye can separate stage time from room time in a
// single pass down the page.

const NOTE_LABEL = {
  ceremony: 'Ceremony',
  interaction: 'Open floor',
  break: 'Break',
  performance: 'Performance',
  valedictory: 'Closing',
}

const SHAPE_COLOR = {
  talk: 'bg-red/75 hover:bg-red',
  ceremony: 'bg-paper/50',
  valedictory: 'bg-paper/50',
  interaction: 'bg-paper/28',
  performance: 'bg-paper/28',
  break: 'bg-paper/15',
}

const SHAPE_LEGEND = [
  ['bg-red/75', 'Talk'],
  ['bg-paper/50', 'Ceremony'],
  ['bg-paper/28', 'Interlude'],
  ['bg-paper/15', 'Break'],
]

const cx = (...parts) => parts.filter(Boolean).join(' ')

// Headline voice spells small counts out ("One day. Twelve ideas.") while the
// stat strip keeps them as numerals. Still derived from the data — the word is
// looked up, never typed — and any count past the table falls back to digits.
const NUMBER_WORDS = [
  'Zero', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine',
  'Ten', 'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen',
  'Seventeen', 'Eighteen', 'Nineteen', 'Twenty',
]

const inWords = (n) => NUMBER_WORDS[n] ?? String(n)

// ── Grouping ───────────────────────────────────────────────────────────────
// The day already has a natural spine: a run of talks, a midday pause built
// around the lunch break, then a second run of talks. Rather than hard-coding
// index ranges (which silently rot the first time a row is inserted), the
// midday block is discovered from the data — find the break, then grow
// outwards across every adjacent non-talk row. What's left on either side is
// the morning and the afternoon.
function buildGroups(rows) {
  const breakIdx = rows.findIndex((r) => r.kind === 'break')
  if (breakIdx === -1) return [{ key: 'programme', label: 'Running order', rows }]

  let start = breakIdx
  while (start > 0 && rows[start - 1].kind !== 'talk' && rows[start - 1].kind !== 'ceremony') {
    start -= 1
  }
  let end = breakIdx
  while (end < rows.length - 1 && rows[end + 1].kind !== 'talk') end += 1

  return [
    { key: 'morning', label: 'Morning session', rows: rows.slice(0, start) },
    { key: 'midday', label: 'Midday interval', rows: rows.slice(start, end + 1) },
    { key: 'afternoon', label: 'Afternoon session', rows: rows.slice(end + 1) },
  ].filter((g) => g.rows.length > 0)
}

// ── Day at a glance ────────────────────────────────────────────────────────

function StatStrip({ stats }) {
  return (
    <div className="grid grid-cols-2 gap-px border-y border-paper/10 bg-paper/10 md:grid-cols-4">
      {stats.map(([value, label]) => (
        <div
          key={label}
          className="bg-ink p-5 md:p-8"
        >
          <div className="font-display text-3xl leading-none tabular-nums text-red md:text-5xl">
            {value}
          </div>
          <div className="mt-3 font-mono text-[10px] uppercase tracking-[0.2em] text-paper/60 md:text-[11px]">
            {label}
          </div>
        </div>
      ))}
    </div>
  )
}

// A single proportional bar of the whole day — every row sized by its real
// duration. It answers "what shape is this day?" before a single name is read:
// a dense red morning, one wide grey trough at lunch, a shorter red afternoon.
function DayShape({ rows }) {
  const { startLabel, endLabel } = spanOf(rows)
  return (
    <div className="mt-12">
      <div className="font-mono text-[10px] uppercase tracking-[0.2em] text-paper/50">
        The shape of the day
      </div>

      <div aria-hidden className="mt-3 flex h-2.5 w-full gap-px md:h-3">
        {rows.map((row, i) => {
          const { start, end } = parseRange(row.time)
          const minutes = start != null && end != null ? end - start : 10
          return (
            <div
              key={`${row.time}-${i}`}
              title={`${row.time} — ${row.kind === 'talk' ? row.name : row.title}`}
              style={{ flexGrow: minutes }}
              className={cx(
                'h-full basis-0 transition-colors duration-300',
                SHAPE_COLOR[row.kind] ?? 'bg-paper/20',
              )}
            />
          )
        })}
      </div>

      <div className="mt-3 flex items-center justify-between font-mono text-[10px] uppercase tracking-[0.2em] text-paper/50">
        <span>{startLabel}</span>
        <span>{endLabel}</span>
      </div>

      <div className="mt-5 flex flex-wrap items-center gap-x-6 gap-y-2">
        {SHAPE_LEGEND.map(([swatch, label]) => (
          <span key={label} className="flex items-center gap-2">
            <span aria-hidden className={cx('inline-block h-2 w-4', swatch)} />
            <span className="font-mono text-[10px] uppercase tracking-[0.2em] text-paper/55">
              {label}
            </span>
          </span>
        ))}
      </div>
    </div>
  )
}

// ── Program rows ───────────────────────────────────────────────────────────

// The timeline rail's marker for one row. Filled red for a talk, hollow for a
// program note — the same talk/not-a-talk distinction the cards themselves
// make, restated at 6px so it still reads when the page is skimmed.
function RailDot({ solid }) {
  return (
    <div aria-hidden className="hidden w-10 shrink-0 justify-center pt-6 md:flex">
      <span
        className={cx(
          'mt-px inline-block h-1.5 w-1.5 rounded-full',
          solid ? 'bg-red' : 'border border-paper/30 bg-ink',
        )}
      />
    </div>
  )
}

// Numbered talk card. Links to /speakers/:slug only when the roster actually
// holds that speaker *and* they've been revealed — two names on the printed
// program have no roster entry yet, and an unrevealed profile would 404 the
// visitor into a page Speakers.jsx is deliberately still hiding.
function TalkRow({ item, speaker }) {
  const linked = Boolean(speaker)
  const Wrapper = linked ? Link : 'div'
  const wrapperProps = linked ? { to: `/speakers/${item.slug}` } : {}
  const portraitName = item.name.replace(/^Dr\.?\s+/i, '')

  return (
    <Wrapper
      {...wrapperProps}
      className={cx(
        'group relative block flex-1 overflow-hidden border border-paper/10 bg-paper/[0.015]',
        'transition-colors duration-300',
        linked && 'hover:border-red/50 hover:bg-paper/[0.035] focus-visible:outline-none focus-visible:border-red',
      )}
    >
      <div className="flex items-start gap-4 p-4 sm:gap-5 sm:p-5 md:gap-6 md:p-6">
        {/* Talk number */}
        <div className="w-8 shrink-0 pt-0.5 md:w-12">
          <span className="font-display text-2xl leading-none tabular-nums text-red/80 transition-colors duration-300 group-hover:text-red md:text-4xl">
            {String(item.n).padStart(2, '0')}
          </span>
        </div>

        {/* Portrait — monogram until real headshots land, same fallback as the
            roster grid. Desktop only: on mobile the number carries the rhythm. */}
        <div className="relative hidden h-16 w-16 shrink-0 overflow-hidden border border-paper/10 md:block">
          {speaker?.photo ? (
            <img
              src={speaker.photo}
              alt=""
              loading="lazy"
              style={speaker.photoPos ? { objectPosition: speaker.photoPos } : undefined}
              className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
            />
          ) : (
            <PortraitPlaceholder name={portraitName} size="text-lg" />
          )}
        </div>

        {/* Time, name, role */}
        <div className="min-w-0 flex-1">
          <div className="font-mono text-[10px] uppercase tracking-[0.18em] text-paper/60 sm:text-[11px]">
            {item.time}
          </div>
          <h3 className="mt-2 font-display text-lg leading-tight tracking-tight md:text-2xl">
            {item.name}
          </h3>
          <p className="mt-1 text-sm leading-snug text-paper/60">{item.role}</p>
        </div>

        {/* Affordance — always on, not just sm+, so a touch visitor gets the
            same "this goes somewhere" / "this doesn't" signal a mouse user
            gets from the border-color hover, which never fires on touch. */}
        <div className="flex shrink-0 items-center self-center pl-2">
          {linked ? (
            <span className="flex items-center gap-1 font-mono text-[10px] uppercase tracking-[0.2em] text-paper/60 transition-colors duration-300 group-hover:text-red group-focus-visible:text-red">
              <span className="hidden sm:inline">Profile</span>
              <span
                aria-hidden
                className="inline-block transition-transform duration-300 ease-out motion-reduce:transition-none group-hover:translate-x-1 group-focus-visible:translate-x-1"
              >
                →
              </span>
            </span>
          ) : (
            <span className="font-mono text-[10px] uppercase tracking-[0.2em] text-paper/40">
              <span className="hidden sm:inline">Profile soon</span>
              <span aria-hidden className="sm:hidden">—</span>
            </span>
          )}
        </div>
      </div>

      {linked && (
        <span
          aria-hidden
          className="absolute inset-x-0 bottom-0 h-0.5 w-full origin-left scale-x-0 bg-red transition-transform duration-300 ease-out motion-reduce:transition-none group-hover:scale-x-100 group-focus-visible:scale-x-100"
        />
      )}
    </Wrapper>
  )
}

// Ceremony / break / performance / interaction / valedictory. Dashed border,
// tinted fill, no number, full width of the block — a bar the eye reads as
// "the day changes gear here", never as another speaker.
function NoteRow({ item }) {
  return (
    <div className="relative flex-1 border border-dashed border-paper/15 bg-paper/[0.04] p-4 sm:p-5 md:p-6">
      <div className="flex flex-col gap-2 md:flex-row md:gap-6">
        <div className="font-mono text-[10px] uppercase tracking-[0.18em] text-paper/60 sm:text-[11px] md:w-44 md:shrink-0 md:pt-1">
          {item.time}
        </div>

        <div className="min-w-0 flex-1">
          <div className="font-mono text-[10px] uppercase tracking-[0.22em] text-red/75">
            {NOTE_LABEL[item.kind] ?? 'Programme'}
          </div>
          <h3 className="mt-1.5 font-display text-lg leading-tight tracking-tight md:text-xl">
            {item.title}
          </h3>

          {item.people?.length > 0 && (
            <ul className="mt-4 grid gap-4 border-t border-paper/10 pt-4 sm:grid-cols-2 lg:grid-cols-3">
              {item.people.map((person) => (
                <li key={person.name}>
                  <div className="font-display text-base leading-tight tracking-tight">
                    {person.name}
                  </div>
                  <div className="mt-1 text-xs leading-snug text-paper/55">{person.role}</div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  )
}

// One block of the day: a labelled header, then its rows hung off a vertical
// rail. Reveal sits on the row (card + rail marker together) rather than on
// every line inside it — same pacing as the roster grid on /speakers.
function ScheduleGroup({ group, speakerFor }) {
  const { startLabel, endLabel } = spanOf(group.rows)
  const talkCount = group.rows.filter((r) => r.kind === 'talk').length
  const headingId = `schedule-group-${group.key}`

  return (
    <section className="relative" aria-labelledby={headingId}>
      <div className="mb-6 flex flex-wrap items-baseline justify-between gap-x-6 gap-y-2 border-b border-paper/10 pb-4">
        {/* Eyebrow carries the visual label; the h2 gives assistive tech a real
            outline (h1 -> h2 x3 -> talk names) instead of one flat list of h3s
            with no section landmarks between them. */}
        <h2 id={headingId} className="sr-only">
          {group.label}
        </h2>
        <Eyebrow aria-hidden className="flex items-center gap-2">
          <span aria-hidden className="inline-block h-1.5 w-1.5 rounded-full bg-red" />
          {group.label}
        </Eyebrow>
        <div className="font-mono text-[10px] uppercase tracking-[0.2em] text-paper/50 sm:text-[11px]">
          {startLabel} – {endLabel}
          {talkCount > 0 && ` · ${talkCount} ${talkCount === 1 ? 'talk' : 'talks'}`}
        </div>
      </div>

      <div className="relative">
        {/* Timeline rail — desktop only; on mobile the cards stack tight enough
            that a rail would just be a line beside a line. */}
        <span
          aria-hidden
          className="absolute bottom-6 left-5 top-6 hidden w-px bg-gradient-to-b from-red/40 via-paper/12 to-paper/5 md:block"
        />

        <div className="relative space-y-3 md:space-y-4">
          {group.rows.map((row, i) => (
            <Reveal key={`${row.time}-${i}`} className="flex items-stretch">
              <RailDot solid={row.kind === 'talk'} />
              {row.kind === 'talk' ? (
                <TalkRow item={row} speaker={speakerFor(row.slug)} />
              ) : (
                <NoteRow item={row} />
              )}
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  )
}

// ── Page ───────────────────────────────────────────────────────────────────

export default function Schedule() {
  const talks = schedule.filter((r) => r.kind === 'talk')
  const interludes = schedule.filter((r) =>
    ['break', 'performance', 'interaction'].includes(r.kind),
  )
  const day = spanOf(schedule)
  const groups = buildGroups(schedule)

  // Only revealed roster entries produce a link. Everything else — the two
  // program names with no roster entry, plus anyone still behind their reveal
  // date — renders as plain text on the card.
  const speakerFor = (slug) => {
    if (!slug) return null
    const match = speakers.find((s) => s.slug === slug)
    return match && isRevealed(match) ? match : null
  }

  const stats = [
    [String(talks.length), 'Talks on stage'],
    ['01', 'Stage'],
    [formatHours(day.minutes), 'Hours, doors to close'],
    [String(interludes.length).padStart(2, '0'), 'Breaks & interludes'],
  ]

  return (
    <div>
      {/* Hero */}
      <section className="relative overflow-hidden border-b border-paper/10 px-6">
        <RedGlow className="-left-40 -top-40" size={560} />
        <BinaryDrift className="opacity-70" columns={10} />
        <div className="relative mx-auto max-w-6xl py-24 md:py-32">
          <Eyebrow className="mb-5">Running order · {event.edition}</Eyebrow>
          <h1 className="mb-6 max-w-4xl font-display text-4xl leading-[1.05] tracking-tight md:text-7xl">
            One day. <span className="text-red">{inWords(talks.length)} ideas.</span>
          </h1>
          <p className="max-w-2xl text-lg leading-relaxed text-paper/70">
            {event.date} · {event.time} · {event.venue}, {event.city}. The day opens at{' '}
            {day.startLabel} — {talks.length} talks, {interludes.length} interludes and one
            red circle, in the order they'll actually happen.
          </p>
        </div>
      </section>

      {/* Day at a glance */}
      <section className="px-6 py-16 md:py-20">
        <div className="mx-auto max-w-6xl">
          <Reveal>
            <Eyebrow className="mb-8 flex items-center gap-2">
              <span aria-hidden className="inline-block h-1.5 w-1.5 rounded-full bg-red" />
              The day at a glance
            </Eyebrow>
            <StatStrip stats={stats} />
            <DayShape rows={schedule} />
          </Reveal>
        </div>
      </section>

      {/* Programme */}
      <section className="px-6 pb-16 md:pb-24">
        <div className="mx-auto max-w-6xl space-y-16 md:space-y-24">
          {groups.map((group) => (
            <ScheduleGroup key={group.key} group={group} speakerFor={speakerFor} />
          ))}

          <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-paper/50 sm:text-[11px]">
            {event.timeNote} · Running order is subject to change
          </p>
        </div>
      </section>

      {/* Handoff — the running order into the room */}
      <section className="px-6 pb-24 md:pb-32">
        <Reveal className="relative mx-auto max-w-6xl overflow-hidden rounded-lg border border-paper/10 p-8 md:p-12">
          <RedGlow className="-right-24 -top-24" size={360} />
          <div className="relative flex flex-col items-start justify-between gap-6 sm:flex-row sm:items-center">
            <div>
              <p className="font-display text-2xl tracking-tight md:text-3xl">
                The day runs once. <span className="text-red">Be in the room.</span>
              </p>
              <p className="mt-2 max-w-md text-sm leading-relaxed text-paper/70 md:text-base">
                {event.date} · {event.time} · {event.venue}, {event.city}.
              </p>
            </div>
            <Button to="/register" variant="primary">
              Book your seat →
            </Button>
          </div>
        </Reveal>
      </section>
    </div>
  )
}
