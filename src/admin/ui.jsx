// Admin-only UI primitives.
//
// The public site is loud on purpose (heavy display type, wide mono tracking,
// hard edges). The admin panel is a tool: it is read at a gate, on a phone, in
// a hurry. So it gets its own quiet system — one radius, one border colour, one
// label style, one focus ring — instead of ad-hoc class strings per screen.
//
// Tokens (keep every admin screen inside these):
//   surface   gradient white/[0.05]->[0.02]  border-white/10  rounded-2xl
//   control   h-8 / h-10           rounded-lg           text-sm
//   label     text-[11px] uppercase tracking-[0.08em] text-paper/45
//   numbers   tabular-nums font-semibold tracking-tight
//   accent    red for the active/primary state only — never decoration
//
//   spacing   4px grid. Section rhythm is gap-4 (mobile) / gap-5 (md+);
//             card padding is p-5 (mobile) / p-6 (md+) via Card's `pad` prop.
//   radius    2xl for cards/panels, lg for controls, md for inner chips.
//             One step down per nesting level — never mix arbitrary radii.
//   elevation cards carry a soft ambient shadow + a 1px top inner highlight,
//             so a surface reads as lifted rather than as a flat outline.

const FOCUS =
  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red/60 focus-visible:ring-offset-2 focus-visible:ring-offset-ink'

// Shared surface treatment. The subtle gradient + inset top highlight is what
// stops these from reading as plain bordered rectangles on a near-black page.
export const SURFACE =
  'rounded-2xl border border-white/10 bg-gradient-to-b from-white/[0.055] to-white/[0.02] shadow-[0_1px_0_0_rgba(255,255,255,0.06)_inset,0_8px_24px_-12px_rgba(0,0,0,0.9)]'

const CARD_PAD = {
  none: '',
  sm: 'p-4',
  md: 'p-5 md:p-6',
  lg: 'p-6 md:p-7',
}

// `pad` defaults to md so a Card can never render content flush against its own
// border — the old default of no padding was silently producing unstyled-looking
// panels wherever a caller forgot to pass one.
export function Card({ className = '', pad = 'md', interactive = false, children }) {
  return (
    <div
      className={[
        SURFACE,
        CARD_PAD[pad] ?? CARD_PAD.md,
        interactive &&
          'transition-[transform,box-shadow,border-color] duration-200 hover:-translate-y-0.5 hover:border-white/20 hover:shadow-[0_1px_0_0_rgba(255,255,255,0.08)_inset,0_16px_32px_-16px_rgba(0,0,0,0.95)] motion-reduce:transform-none motion-reduce:transition-none',
        className,
      ]
        .filter(Boolean)
        .join(' ')}
    >
      {children}
    </div>
  )
}

// Panel header: title on the left, optional count/action on the right, with a
// hairline rule so the heading is visibly attached to the content it labels.
export function CardHeader({ title, meta, className = '' }) {
  return (
    <div className={`mb-4 flex items-center justify-between gap-4 border-b border-white/[0.07] pb-3 ${className}`}>
      <h2 className="text-[13px] font-semibold tracking-tight text-paper">{title}</h2>
      {meta != null && <span className="flex-none text-xs tabular-nums text-paper/45">{meta}</span>}
    </div>
  )
}

// Small muted caption used above values, lists and form fields.
export function Label({ children, className = '' }) {
  return (
    <div className={`text-[11px] font-medium uppercase tracking-[0.08em] text-paper/45 ${className}`}>
      {children}
    </div>
  )
}

// Four rungs of hierarchy. `primary` is the only red one and there should be at
// most one per view — red here means "this is the committing action", so using
// it for decoration or for every filter chip destroys the signal.
const BUTTON_VARIANTS = {
  primary:
    'border border-red/50 bg-red text-white shadow-[0_1px_0_0_rgba(255,255,255,0.18)_inset,0_6px_16px_-8px_rgba(230,43,30,0.9)] hover:bg-[#f2382b] hover:shadow-[0_1px_0_0_rgba(255,255,255,0.22)_inset,0_10px_22px_-8px_rgba(230,43,30,1)]',
  subtle:
    'border border-white/10 bg-white/[0.05] text-paper/85 hover:border-white/20 hover:bg-white/[0.09] hover:text-paper',
  ghost: 'border border-transparent text-paper/60 hover:bg-white/[0.07] hover:text-paper',
  danger: 'border border-transparent text-paper/60 hover:bg-red/12 hover:text-red',
}

const BUTTON_SIZES = {
  sm: 'h-8 gap-1.5 px-3 text-[12px]',
  md: 'h-10 gap-2 px-4 text-sm',
  lg: 'h-12 gap-2 px-5 text-sm',
}

export function Button({ variant = 'subtle', size = 'md', className = '', type = 'button', ...rest }) {
  return (
    <button
      type={type}
      className={[
        'inline-flex select-none items-center justify-center rounded-lg font-medium',
        'transition-[background-color,border-color,color,box-shadow,transform] duration-150',
        'active:scale-[0.97] motion-reduce:transform-none motion-reduce:transition-none',
        'disabled:pointer-events-none disabled:opacity-40',
        BUTTON_SIZES[size],
        BUTTON_VARIANTS[variant],
        FOCUS,
        className,
      ].join(' ')}
      {...rest}
    />
  )
}

// Segmented control shared by the Registrations and Support filter rows. Both
// screens had this hand-rolled and slightly divergent; one component keeps the
// active state, radius and hit target identical across them.
export function SegmentedControl({ options, value, onChange, ariaLabel }) {
  return (
    <div
      role="group"
      aria-label={ariaLabel}
      className="inline-flex items-center gap-1 rounded-xl border border-white/10 bg-black/20 p-1"
    >
      {options.map((option) => {
        const active = value === option.key
        return (
          <button
            key={option.key}
            type="button"
            onClick={() => onChange(option.key)}
            aria-pressed={active}
            className={[
              'inline-flex items-center whitespace-nowrap rounded-lg px-3 py-1.5 text-sm font-medium',
              'transition-[background-color,color,box-shadow] duration-150',
              active
                ? 'bg-white/[0.12] text-paper shadow-[0_1px_0_0_rgba(255,255,255,0.08)_inset]'
                : 'text-paper/55 hover:bg-white/[0.05] hover:text-paper',
              FOCUS,
            ].join(' ')}
          >
            {option.label}
            {option.count > 0 && (
              <span
                className={[
                  'ml-2 rounded-full px-1.5 py-0.5 text-[10px] font-semibold tabular-nums',
                  active ? 'bg-red text-white' : 'bg-white/10 text-paper/70',
                ].join(' ')}
              >
                {option.count}
              </span>
            )}
          </button>
        )
      })}
    </div>
  )
}

export function Input({ className = '', ...rest }) {
  return (
    <input
      className={[
        'h-10 w-full rounded-lg border border-white/10 bg-black/25 px-3 text-sm text-paper',
        'transition-[border-color,background-color,box-shadow] duration-150',
        'placeholder:text-paper/35 hover:border-white/20 focus:border-red/60 focus:bg-black/40',
        FOCUS,
        className,
      ].join(' ')}
      {...rest}
    />
  )
}

export function Field({ id, label, hint, children }) {
  return (
    <div className="space-y-1.5">
      <label htmlFor={id} className="block text-[11px] font-medium uppercase tracking-[0.08em] text-paper/45">
        {label}
      </label>
      {children}
      {hint && <p className="text-xs text-paper/40">{hint}</p>}
    </div>
  )
}

const STATUS_TONES = {
  paid: { dot: 'bg-emerald-400', text: 'text-emerald-300', ring: 'border-emerald-400/25 bg-emerald-400/10' },
  checked_in: { dot: 'bg-sky-400', text: 'text-sky-300', ring: 'border-sky-400/25 bg-sky-400/10' },
  pending: { dot: 'bg-amber-400', text: 'text-amber-300', ring: 'border-amber-400/25 bg-amber-400/10' },
  default: { dot: 'bg-paper/40', text: 'text-paper/60', ring: 'border-white/10 bg-white/[0.04]' },
}

// Dot + word. Reads faster than an all-caps outlined chip and stops the three
// status colours from fighting the brand red.
export function StatusBadge({ status }) {
  const tone = STATUS_TONES[status] ?? STATUS_TONES.default
  return (
    <span
      className={`inline-flex flex-none items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-medium capitalize ${tone.ring} ${tone.text}`}
    >
      <span aria-hidden className={`h-1.5 w-1.5 rounded-full ${tone.dot}`} />
      {String(status ?? '').replace('_', ' ') || 'unknown'}
    </span>
  )
}

export function Alert({ children, tone = 'error' }) {
  const tones = {
    error: 'border-red/30 bg-red/[0.09] text-red',
    warn: 'border-amber-400/30 bg-amber-400/10 text-amber-200',
    success: 'border-emerald-400/30 bg-emerald-400/10 text-emerald-300',
  }
  return (
    <div
      role="alert"
      className={`flex items-start gap-2.5 rounded-xl border px-4 py-3 text-sm ${tones[tone] ?? tones.error}`}
    >
      <span aria-hidden className="mt-[3px] flex-none">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-4 w-4">
          <circle cx="12" cy="12" r="9" />
          {tone === 'success' ? (
            <path d="m8.5 12.2 2.4 2.4 4.6-4.9" strokeLinecap="round" strokeLinejoin="round" />
          ) : (
            <>
              <path d="M12 7.75v5" strokeLinecap="round" />
              <circle cx="12" cy="16" r="0.9" fill="currentColor" stroke="none" />
            </>
          )}
        </svg>
      </span>
      <span className="min-w-0">{children}</span>
    </div>
  )
}

// A real empty state: framed glyph, one clear line, optional secondary hint.
// The previous version was a single muted sentence, which made any empty panel
// read as an unstyled box rather than as a deliberate "nothing here yet".
export function EmptyState({ children, hint, icon, tone = 'neutral', className = '' }) {
  const tones = {
    neutral: 'border-white/10 bg-white/[0.04] text-paper/40',
    good: 'border-emerald-400/25 bg-emerald-400/10 text-emerald-300/80',
  }
  return (
    <div className={`flex flex-col items-center justify-center px-6 py-12 text-center ${className}`}>
      <div className={`mb-3 flex h-11 w-11 items-center justify-center rounded-xl border ${tones[tone] ?? tones.neutral}`}>
        {icon ?? <InboxIcon />}
      </div>
      <p className="text-sm font-medium text-paper/65">{children}</p>
      {hint && <p className="mt-1 max-w-xs text-xs leading-relaxed text-paper/35">{hint}</p>}
    </div>
  )
}

export function InboxIcon({ className = 'h-5 w-5' }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" className={className} aria-hidden>
      <path d="M3 13h4l1.5 3h7L17 13h4" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M5.5 5h13l2.5 8v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4z" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

export function CheckCircleIcon({ className = 'h-5 w-5' }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" className={className} aria-hidden>
      <circle cx="12" cy="12" r="9" />
      <path d="m8.5 12.2 2.4 2.4 4.6-4.9" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

// Horizontal proportion bar used by the dashboard breakdowns. Value + share are
// labelled explicitly because an unlabelled bar leaves the reader guessing what
// the length is relative to.
export function BarRow({ label, value, max, total }) {
  const count = Number(value) || 0
  const width = max > 0 ? Math.max(2, (count / max) * 100) : 0
  const share = total > 0 ? Math.round((count / total) * 100) : null
  return (
    <li className="group">
      <div className="mb-1.5 flex items-baseline justify-between gap-4 text-sm">
        <span className="truncate capitalize text-paper/80">{label}</span>
        <span className="flex-none tabular-nums text-paper/50">
          <span className="font-medium text-paper/80">{count}</span>
          {share != null && <span className="ml-1.5 text-xs text-paper/35">{share}%</span>}
        </span>
      </div>
      <div className="h-1.5 w-full overflow-hidden rounded-full bg-white/[0.07]">
        <div
          className="h-full rounded-full bg-gradient-to-r from-red/60 to-red transition-[width] duration-700 ease-out motion-reduce:transition-none"
          style={{ width: `${width}%` }}
        />
      </div>
    </li>
  )
}

// Toolbar row shared by Dashboard and Registrations: left = context line,
// right = last-refreshed stamp + refresh control.
export function RefreshBar({ left, refreshedAt, loading, onRefresh }) {
  return (
    <div className="flex items-center justify-between gap-4 rounded-xl border border-white/[0.07] bg-white/[0.02] px-3 py-2">
      <span className="flex min-w-0 items-center gap-2 text-xs text-paper/45">
        {/* Live pulse: a quiet, always-present signal that the numbers refresh
            themselves, so the count beside it is trusted as current. */}
        <span aria-hidden className="relative flex h-1.5 w-1.5 flex-none">
          {loading && (
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400/70 motion-reduce:hidden" />
          )}
          <span
            className={`relative inline-flex h-1.5 w-1.5 rounded-full ${loading ? 'bg-emerald-400' : 'bg-emerald-400/50'}`}
          />
        </span>
        <span className="truncate">{left}</span>
      </span>
      <div className="flex flex-none items-center gap-3">
        {refreshedAt && (
          <span className="hidden text-xs tabular-nums text-paper/30 sm:inline">
            Updated {refreshedAt.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}
          </span>
        )}
        <Button size="sm" onClick={onRefresh} disabled={loading}>
          <RefreshIcon className={`h-3.5 w-3.5 ${loading ? 'animate-spin motion-reduce:animate-none' : ''}`} />
          {loading ? 'Loading' : 'Refresh'}
        </Button>
      </div>
    </div>
  )
}

export function RefreshIcon({ className = 'h-3.5 w-3.5' }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className={className} aria-hidden>
      <path d="M20 11a8 8 0 1 0-2.3 6" strokeLinecap="round" />
      <path d="M20 4v7h-7" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

export function SearchIcon({ className = 'h-4 w-4' }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className={className} aria-hidden>
      <circle cx="11" cy="11" r="7" />
      <line x1="16.5" y1="16.5" x2="21" y2="21" strokeLinecap="round" />
    </svg>
  )
}
