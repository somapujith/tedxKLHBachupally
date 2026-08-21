import { NavLink } from 'react-router-dom'
import { isSuperAdmin } from './api'

// Fixed mobile bottom nav.
// Plain admin (gate duty, close to the event): Scan · Checked in — exactly the
// two views that role has. Superadmin: Dashboard · Scan · Registrations
// (· Activity · Admins). Flat bar, equal-width targets — the scanner reads as
// primary through a solid red chip instead of a floating raised circle.
// Hidden at md+ where the desktop top header takes over. Safe-area padding
// clears the iPhone home indicator.

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

function LogIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" className={ICON} aria-hidden>
      <path d="M12 8v4l2.5 2.5" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx="12" cy="12" r="8.5" />
    </svg>
  )
}

function SupportIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" className={ICON} aria-hidden>
      <path d="M20 15.5a8 8 0 1 0-3.2 3.2L21 20z" strokeLinejoin="round" />
      <line x1="9" y1="11" x2="15" y2="11" strokeLinecap="round" />
      <line x1="9" y1="14.5" x2="13" y2="14.5" strokeLinecap="round" />
    </svg>
  )
}

function CheckIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className={ICON} aria-hidden>
      <circle cx="12" cy="12" r="8.5" />
      <path d="m8.5 12.2 2.4 2.4 4.6-4.9" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

function TeamIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" className={ICON} aria-hidden>
      <circle cx="9" cy="8.5" r="3.2" />
      <path d="M3.5 19.5a5.5 5.5 0 0 1 11 0" strokeLinecap="round" />
      <path d="M16 6.2a3.2 3.2 0 0 1 0 6" strokeLinecap="round" />
      <path d="M17.5 14.6a5.5 5.5 0 0 1 3 4.9" strokeLinecap="round" />
    </svg>
  )
}

function Tab({ to, label, icon, accent = false }) {
  return (
    <NavLink
      to={to}
      end
      className="flex flex-1 flex-col items-center justify-center gap-1 rounded-xl py-2.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red/60"
    >
      {({ isActive }) => (
        <>
          <span
            className={[
              'flex h-9 w-9 items-center justify-center rounded-xl',
              'transition-[background-color,color,transform,box-shadow] duration-200',
              'active:scale-90 motion-reduce:transform-none motion-reduce:transition-none',
              accent
                ? 'bg-red text-white shadow-[0_1px_0_0_rgba(255,255,255,0.2)_inset,0_6px_16px_-6px_rgba(230,43,30,0.95)]'
                : isActive
                  ? 'bg-white/[0.12] text-paper shadow-[0_1px_0_0_rgba(255,255,255,0.08)_inset]'
                  : 'text-paper/45',
            ].join(' ')}
          >
            {icon}
          </span>
          <span
            className={[
              'text-[11px] font-medium transition-colors duration-200',
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
  // Five targets is the most this bar can hold legibly on a small phone, so the
  // superadmin labels are short ones and the max width grows with the count.
  const superAdmin = isSuperAdmin()

  if (!superAdmin) {
    // Exactly this role's two views. Both get the full-width treatment (no
    // squeezed three-plus-tab row) since there's nothing else to fit.
    return (
      <nav
        aria-label="Admin"
        className="fixed inset-x-0 bottom-0 z-50 border-t border-white/10 bg-ink/90 backdrop-blur-xl md:hidden"
        style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
      >
        <div className="mx-auto flex max-w-xs items-stretch px-2">
          <Tab to="/admin/scan" label="Scan" icon={<ScanIcon />} accent />
          <Tab to="/admin/checked-in" label="Checked in" icon={<CheckIcon />} />
        </div>
      </nav>
    )
  }

  return (
    <nav
      aria-label="Admin"
      className="fixed inset-x-0 bottom-0 z-50 border-t border-white/10 bg-ink/90 backdrop-blur-xl md:hidden"
      style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
    >
      <div className="mx-auto flex max-w-lg items-stretch px-2">
        <Tab to="/admin" label="Users" icon={<DashIcon />} />
        <Tab to="/admin/scan" label="Scan" icon={<ScanIcon />} accent />
        <Tab to="/admin/checked-in" label="Checked in" icon={<CheckIcon />} />
        {/* Five targets is this bar's legible ceiling on a small phone. */}
        <Tab to="/admin/activity" label="Activity" icon={<LogIcon />} />
        <Tab to="/admin/admins" label="Admins" icon={<TeamIcon />} />
      </div>
    </nav>
  )
}
