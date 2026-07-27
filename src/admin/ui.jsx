// Admin-only UI primitives.
//
// The public site is loud on purpose (heavy display type, wide mono tracking,
// hard edges). The admin panel is a tool: it is read at a gate, on a phone, in
// a hurry. So it gets its own quiet system — one radius, one border colour, one
// label style, one focus ring — instead of ad-hoc class strings per screen.
//
// Tokens (keep every admin screen inside these):
//   surface   bg-white/[0.03]      border-white/10      rounded-xl
//   control   h-8 / h-10           rounded-lg           text-sm
//   label     text-[11px] uppercase tracking-[0.08em] text-paper/45
//   numbers   tabular-nums font-semibold tracking-tight
//   accent    red for the active/primary state only — never decoration

const FOCUS =
  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red/60 focus-visible:ring-offset-2 focus-visible:ring-offset-ink'

export function Card({ className = '', children }) {
  return <div className={`rounded-xl border border-white/10 bg-white/[0.03] ${className}`}>{children}</div>
}

// Small muted caption used above values, lists and form fields.
export function Label({ children, className = '' }) {
  return (
    <div className={`text-[11px] font-medium uppercase tracking-[0.08em] text-paper/45 ${className}`}>
      {children}
    </div>
  )
}

const BUTTON_VARIANTS = {
  primary: 'border border-transparent bg-red text-white hover:bg-red/90',
  subtle: 'border border-white/10 bg-white/[0.04] text-paper/80 hover:bg-white/[0.08] hover:text-paper',
  ghost: 'border border-transparent text-paper/60 hover:bg-white/[0.06] hover:text-paper',
  danger: 'border border-transparent text-paper/60 hover:bg-red/10 hover:text-red',
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
        'inline-flex items-center justify-center rounded-lg font-medium transition-colors',
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

export function Input({ className = '', ...rest }) {
  return (
    <input
      className={[
        'h-10 w-full rounded-lg border border-white/10 bg-white/[0.03] px-3 text-sm text-paper',
        'transition-colors placeholder:text-paper/35 hover:border-white/20 focus:border-red/60',
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
    error: 'border-red/30 bg-red/10 text-red',
    warn: 'border-amber-400/30 bg-amber-400/10 text-amber-200',
  }
  return (
    <div role="alert" className={`rounded-lg border px-4 py-3 text-sm ${tones[tone]}`}>
      {children}
    </div>
  )
}

export function EmptyState({ children }) {
  return <p className="py-12 text-center text-sm text-paper/40">{children}</p>
}

// Toolbar row shared by Dashboard and Registrations: left = context line,
// right = last-refreshed stamp + refresh control.
export function RefreshBar({ left, refreshedAt, loading, onRefresh }) {
  return (
    <div className="flex items-center justify-between gap-4">
      <span className="text-xs text-paper/40">{left}</span>
      <div className="flex items-center gap-3">
        {refreshedAt && (
          <span className="hidden text-xs tabular-nums text-paper/30 sm:inline">
            Updated {refreshedAt.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}
          </span>
        )}
        <Button size="sm" onClick={onRefresh} disabled={loading}>
          <RefreshIcon />
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
