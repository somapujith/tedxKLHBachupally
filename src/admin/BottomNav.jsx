import { Link, NavLink } from 'react-router-dom'

// Fixed mobile bottom nav: Dashboard (left) · SCAN (raised center) · Registrations (right).
// Hidden at md+ where the desktop top header takes over. Safe-area padding keeps
// the bar clear of the iPhone home indicator.

const ICON = 'h-5 w-5'

function DashIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" className={ICON} aria-hidden>
      <rect x="3" y="3" width="7" height="9" />
      <rect x="14" y="3" width="7" height="5" />
      <rect x="14" y="12" width="7" height="9" />
      <rect x="3" y="16" width="7" height="5" />
    </svg>
  )
}

function ListIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" className={ICON} aria-hidden>
      <line x1="8" y1="6" x2="21" y2="6" />
      <line x1="8" y1="12" x2="21" y2="12" />
      <line x1="8" y1="18" x2="21" y2="18" />
      <circle cx="3.5" cy="6" r="1" />
      <circle cx="3.5" cy="12" r="1" />
      <circle cx="3.5" cy="18" r="1" />
    </svg>
  )
}

function ScanIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-7 w-7" aria-hidden>
      <path d="M4 8V5a1 1 0 0 1 1-1h3" />
      <path d="M20 8V5a1 1 0 0 0-1-1h-3" />
      <path d="M4 16v3a1 1 0 0 0 1 1h3" />
      <path d="M20 16v3a1 1 0 0 1-1 1h-3" />
      <line x1="3" y1="12" x2="21" y2="12" />
    </svg>
  )
}

function Tab({ to, label, icon }) {
  return (
    <NavLink
      to={to}
      end
      className={({ isActive }) =>
        [
          'flex flex-1 flex-col items-center justify-center gap-1 py-2 font-mono text-[9px] uppercase tracking-[0.15em] transition-colors',
          isActive ? 'text-red' : 'text-paper/50 hover:text-paper/80',
        ].join(' ')
      }
    >
      {icon}
      <span>{label}</span>
    </NavLink>
  )
}

export default function BottomNav() {
  return (
    <nav
      aria-label="Admin"
      className="fixed inset-x-0 bottom-0 z-50 border-t border-paper/15 bg-ink/95 backdrop-blur-md md:hidden"
      style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
    >
      <div className="relative mx-auto flex max-w-md items-stretch">
        <Tab to="/admin" label="Dashboard" icon={<DashIcon />} />

        {/* Raised center SCAN — one-tap access from any shell screen. */}
        <div className="flex w-24 flex-none items-start justify-center">
          <Link
            to="/admin/scan"
            aria-label="Scan passes"
            className="-mt-6 flex h-16 w-16 flex-col items-center justify-center gap-0.5 rounded-full border-4 border-ink bg-red text-paper shadow-lg shadow-red/30 transition-transform active:scale-95"
          >
            <ScanIcon />
            <span className="font-mono text-[8px] uppercase tracking-[0.2em]">Scan</span>
          </Link>
        </div>

        <Tab to="/admin/registrations" label="Registrations" icon={<ListIcon />} />
      </div>
    </nav>
  )
}
