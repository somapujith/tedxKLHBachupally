import { useEffect } from 'react'
import { Link, NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom'
import { getAdminName, getToken, isSuperAdmin, logout } from './api'
import BottomNav from './BottomNav'

// Shared chrome for the tabbed admin screens. A plain admin gets exactly one
// tab here, Checked in (plus the Scan button, a bare route outside this
// shell); a superadmin gets the full set. Top bar = identity + navigation
// only; the page title/description live in the content column so the bar
// stays one line tall on every device. The scanner and login screens render
// bare.

const PAGES = {
  '/admin': { title: 'Total users', description: 'Every verified attendee — name, email, phone and their uploaded image.' },
  '/admin/checked-in': { title: 'Checked in', description: 'Live gate roster — updates as every admin scans.' },
  '/admin/activity': { title: 'Activity', description: 'Every admin action and every ticket email, newest first.' },
  '/admin/admins': { title: 'Admins', description: 'Accounts, roles and per-admin scan counts.' },
}

// `short` is used between md and xl, where a superadmin's tabs would
// otherwise overrun the row; the full label returns at xl.
const BASE_TABS = [
  { to: '/admin', label: 'Total users' },
  { to: '/admin/checked-in', label: 'Checked in' },
]

// Appended, not substituted: a superadmin keeps every gate-admin screen and
// gains two more.
const SUPER_TABS = [
  { to: '/admin/activity', label: 'Activity' },
  { to: '/admin/admins', label: 'Admins' },
]

// A plain admin's entire shell surface, close to the event: the scanner
// (bare route, reached via the header/bottom-nav button) plus this one tab.
// Dashboard, Registrations, Support and every superadmin screen are gone —
// not just off the nav, but redirected away below, so a bookmarked or typed
// URL can't land a gate admin somewhere this panel no longer offers them.
const GATE_ADMIN_TABS = [{ to: '/admin/checked-in', label: 'Checked in' }]
const GATE_ADMIN_PATH = '/admin/checked-in'

export default function AdminShell() {
  const navigate = useNavigate()
  const { pathname } = useLocation()
  const page = PAGES[pathname] ?? { title: 'Admin', description: '' }
  const superAdmin = isSuperAdmin()
  const tabs = superAdmin ? [...BASE_TABS, ...SUPER_TABS] : GATE_ADMIN_TABS

  // Auth guard for every shell screen — bounce to login if the token is gone.
  // A plain admin is further confined to the checked-in view: everything else
  // under /admin is a superadmin screen right now, and letting a gate admin
  // sit on a stale Dashboard/Registrations tab (reachable only by typing the
  // URL, since the nav no longer offers it) is the "not properly designed"
  // failure mode this restriction exists to close.
  useEffect(() => {
    if (!getToken()) {
      navigate('/admin/login', { replace: true })
      return
    }
    if (!superAdmin && pathname !== GATE_ADMIN_PATH) {
      navigate(GATE_ADMIN_PATH, { replace: true })
    }
  }, [navigate, pathname, superAdmin])

  function onLogout() {
    if (!window.confirm('Sign out of the admin panel?')) return
    logout()
    navigate('/admin/login', { replace: true })
  }

  return (
    <div className="min-h-screen bg-ink font-body text-paper">
      {/* Ambient wash. Keeps the page off flat #0A0A0A without adding a colour
          the content has to compete with. */}
      <div
        aria-hidden
        className="pointer-events-none fixed inset-0 z-0 bg-[radial-gradient(60rem_32rem_at_50%_-8rem,rgba(230,43,30,0.10),transparent_70%)]"
      />

      <header className="sticky top-0 z-40 border-b border-white/[0.08] bg-ink/75 backdrop-blur-xl">
        <div className="relative mx-auto flex h-16 max-w-6xl items-center justify-between gap-3 px-4 sm:px-6 lg:gap-5">
          <Link
            to="/admin"
            className="flex flex-none items-center gap-2.5 rounded-lg transition-opacity hover:opacity-80"
          >
            <span aria-hidden className="h-2 w-2 rounded-full bg-red shadow-[0_0_12px_2px_rgba(230,43,30,0.55)]" />
            <span className="text-sm font-semibold tracking-tight">TEDxKLH</span>
            {/* "Admin" is redundant next to the tab bar and is the first thing
                sacrificed when the superadmin tab count crowds the row. */}
            <span className="hidden text-sm text-paper/35 sm:inline md:hidden xl:inline">Admin</span>
          </Link>

          {/* Desktop tabs; mobile uses the bottom nav instead. Kept in normal
              flow (not absolutely centred) because the tab count varies by role
              — a centred bar overlaps the Scan button once the superadmin tabs
              appear. A superadmin has six tabs, which cannot fit beside the
              Scan button and account box on a 1280px laptop, so the row scrolls
              and fades at its right edge instead of hard-clipping the last tab. */}
          <nav
            className={[
              'hidden min-w-0 items-center gap-1 overflow-x-auto rounded-xl border border-white/10 bg-black/25 p-1 md:flex',
              '[scrollbar-width:none] [&::-webkit-scrollbar]:hidden',
            ].join(' ')}
            // Inline rather than an arbitrary Tailwind class: the calc() inside
            // a mask-image value does not survive Tailwind's class parser, so
            // the fade silently never applied and the last tab hard-clipped.
            style={{
              maskImage: 'linear-gradient(to right, black calc(100% - 1.5rem), transparent)',
              WebkitMaskImage: 'linear-gradient(to right, black calc(100% - 1.5rem), transparent)',
            }}
          >
            {tabs.map((tab) => (
              <NavLink
                key={tab.to}
                to={tab.to}
                end
                className={({ isActive }) =>
                  [
                    'whitespace-nowrap rounded-lg px-2.5 py-1.5 text-sm font-medium lg:px-3.5',
                    'transition-[background-color,color,box-shadow] duration-150',
                    isActive
                      ? 'bg-white/[0.12] text-paper shadow-[0_1px_0_0_rgba(255,255,255,0.08)_inset]'
                      : 'text-paper/55 hover:bg-white/[0.05] hover:text-paper',
                  ].join(' ')
                }
              >
                {tab.short ? (
                  <>
                    <span className="xl:hidden">{tab.short}</span>
                    <span className="hidden xl:inline">{tab.label}</span>
                  </>
                ) : (
                  tab.label
                )}
              </NavLink>
            ))}
          </nav>

          <div className="flex flex-none items-center gap-2 sm:gap-3">
            <Link
              to="/admin/scan"
              className={[
                'hidden h-9 items-center gap-2 rounded-lg bg-red px-4 text-sm font-medium text-white md:inline-flex',
                'shadow-[0_1px_0_0_rgba(255,255,255,0.18)_inset,0_6px_16px_-8px_rgba(230,43,30,0.9)]',
                'transition-[background-color,box-shadow,transform] duration-150 hover:bg-[#f2382b] active:scale-[0.97]',
                'motion-reduce:transform-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red/60 focus-visible:ring-offset-2 focus-visible:ring-offset-ink',
              ].join(' ')}
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" className="h-4 w-4" aria-hidden>
                <path d="M4 8V5.5A1.5 1.5 0 0 1 5.5 4H8M20 8V5.5A1.5 1.5 0 0 0 18.5 4H16M4 16v2.5A1.5 1.5 0 0 0 5.5 20H8M20 16v2.5a1.5 1.5 0 0 1-1.5 1.5H16M4 12h16" strokeLinecap="round" />
              </svg>
              Scan passes
            </Link>

            {/* Account cluster: avatar + name + role, boxed so identity and the
                sign-out control read as one group rather than loose text. */}
            <div className="hidden items-center gap-2 rounded-lg border border-white/[0.08] bg-white/[0.03] py-1 pl-1 pr-1 sm:flex">
              <span
                aria-hidden
                className="flex h-7 w-7 flex-none items-center justify-center rounded-md bg-white/[0.08] text-[11px] font-semibold uppercase text-paper/70"
              >
                {getAdminName().trim().charAt(0) || 'A'}
              </span>
              {/* Name drops below xl; the avatar initial still identifies the
                  session, and the tab bar needs the width more. */}
              <span className="hidden max-w-[8rem] truncate text-sm text-paper/70 xl:inline">{getAdminName()}</span>
              {superAdmin && (
                <span className="flex-none rounded border border-red/30 bg-red/10 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-[0.08em] text-red">
                  Super
                </span>
              )}
              <span aria-hidden className="h-5 w-px bg-white/10" />
              <button
                type="button"
                onClick={onLogout}
                className="rounded-md px-2 py-1 text-sm text-paper/55 transition-colors hover:bg-red/10 hover:text-red focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red/60"
              >
                Sign out
              </button>
            </div>

            {/* Phones: the account box is hidden, so sign-out still needs a target. */}
            <button
              type="button"
              onClick={onLogout}
              aria-label="Sign out"
              className="rounded-lg px-2.5 py-1.5 text-sm text-paper/55 transition-colors hover:bg-red/10 hover:text-red sm:hidden"
            >
              Sign out
            </button>
          </div>
        </div>
      </header>

      {/* Bottom padding clears the fixed mobile nav; reduced at md+. */}
      <main className="relative z-10 mx-auto max-w-6xl px-4 pb-28 pt-7 sm:px-6 md:pb-16 md:pt-10">
        <div className="mb-6 md:mb-8">
          <h1 className="text-[26px] font-semibold leading-tight tracking-tight md:text-[32px]">{page.title}</h1>
          {page.description && (
            <p className="mt-1.5 max-w-2xl text-sm leading-relaxed text-paper/45">{page.description}</p>
          )}
        </div>
        <Outlet />
      </main>

      <BottomNav />
    </div>
  )
}
