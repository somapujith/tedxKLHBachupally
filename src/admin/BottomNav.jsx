import { NavLink } from 'react-router-dom'

// Fixed mobile bottom nav: Dashboard · Scan · Registrations.
// Flat bar, three equal targets — the scanner reads as primary through a solid
// red chip instead of a floating raised circle. Hidden at md+ where the desktop
// top header takes over. Safe-area padding clears the iPhone home indicator.

const ICON = 'h-[22px] w-[22px]'

function DashIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" className={ICON} aria-hidden>
      <rect x="3" y="3" width="7" height="9" rx="1.5" />
      <rect x="14" y="3" width="7" height="5" rx="1.5" />
      <rect x="14" y="12" width="7" height="9" rx="1.5" />
      <rect x="3" y="16" width="7" height="5" rx="1.5" />
    </svg>
  )
}

function ListIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" className={ICON} aria-hidden>
      <line x1="8" y1="6" x2="20" y2="6" strokeLinecap="round" />
      <line x1="8" y1="12" x2="20" y2="12" strokeLinecap="round" />
      <line x1="8" y1="18" x2="20" y2="18" strokeLinecap="round" />
      <circle cx="4" cy="6" r="1.2" fill="currentColor" stroke="none" />
      <circle cx="4" cy="12" r="1.2" fill="currentColor" stroke="none" />
      <circle cx="4" cy="18" r="1.2" fill="currentColor" stroke="none" />
    </svg>
  )
}

function ScanIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className={ICON} aria-hidden>
      <path d="M4 8V5.5A1.5 1.5 0 0 1 5.5 4H8" strokeLinecap="round" />
      <path d="M20 8V5.5A1.5 1.5 0 0 0 18.5 4H16" strokeLinecap="round" />
      <path d="M4 16v2.5A1.5 1.5 0 0 0 5.5 20H8" strokeLinecap="round" />
      <path d="M20 16v2.5a1.5 1.5 0 0 1-1.5 1.5H16" strokeLinecap="round" />
      <line x1="4" y1="12" x2="20" y2="12" strokeLinecap="round" />
    </svg>
  )
}

function Tab({ to, label, icon, accent = false }) {
  return (
    <NavLink to={to} end className="flex flex-1 flex-col items-center justify-center gap-1 py-2.5">
      {({ isActive }) => (
        <>
          <span
            className={[
              'flex h-9 w-9 items-center justify-center rounded-xl transition-colors',
              accent ? 'bg-red text-white' : isActive ? 'bg-white/10 text-paper' : 'text-paper/45',
            ].join(' ')}
          >
            {icon}
          </span>
          <span
            className={[
              'text-[11px] font-medium transition-colors',
              isActive && !accent ? 'text-paper' : 'text-paper/45',
            ].join(' ')}
          >
            {label}
          </span>
        </>
      )}
    </NavLink>
  )
}

export default function BottomNav() {
  return (
    <nav
      aria-label="Admin"
      className="fixed inset-x-0 bottom-0 z-50 border-t border-white/10 bg-ink/90 backdrop-blur-xl md:hidden"
      style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
    >
      <div className="mx-auto flex max-w-md items-stretch px-2">
        <Tab to="/admin" label="Dashboard" icon={<DashIcon />} />
        <Tab to="/admin/scan" label="Scan" icon={<ScanIcon />} accent />
        <Tab to="/admin/registrations" label="Registrations" icon={<ListIcon />} />
      </div>
    </nav>
  )
}
