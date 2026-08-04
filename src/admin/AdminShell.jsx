import { useEffect } from 'react'
import { Link, NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom'
import { getAdminName, getToken, isSuperAdmin, logout } from './api'
import BottomNav from './BottomNav'

// Shared chrome for the tabbed admin screens (Dashboard, Registrations, and —
// for a superadmin — Activity and Admins). Top bar = identity + navigation only;
// the page title/description live in the content column so the bar stays one
// line tall on every device. The scanner and login screens render bare.

const PAGES = {
  '/admin': { title: 'Dashboard', description: 'Live registration and check-in numbers.' },
  '/admin/registrations': { title: 'Registrations', description: 'Search, filter and resend attendee passes.' },
  '/admin/support': { title: 'Support', description: 'Tickets raised by attendees. Call or email them, then mark it resolved.' },
  '/admin/activity': { title: 'Activity', description: 'Every admin action and every ticket email, newest first.' },
  '/admin/admins': { title: 'Admins', description: 'Accounts, roles and per-admin scan counts.' },
}

const BASE_TABS = [
  { to: '/admin', label: 'Dashboard' },
  { to: '/admin/registrations', label: 'Registrations' },
  { to: '/admin/support', label: 'Support' },
]

// Appended, not substituted: a superadmin keeps every gate-admin screen and
// gains two more.
const SUPER_TABS = [
  { to: '/admin/activity', label: 'Activity' },
  { to: '/admin/admins', label: 'Admins' },
]

export default function AdminShell() {
  const navigate = useNavigate()
  const { pathname } = useLocation()
  const page = PAGES[pathname] ?? { title: 'Admin', description: '' }
  const superAdmin = isSuperAdmin()
  const tabs = superAdmin ? [...BASE_TABS, ...SUPER_TABS] : BASE_TABS

  // Auth guard for every shell screen — bounce to login if the token is gone.
  useEffect(() => {
    if (!getToken()) navigate('/admin/login', { replace: true })
  }, [navigate, pathname])

  function onLogout() {
    if (!window.confirm('Sign out of the admin panel?')) return
    logout()
    navigate('/admin/login', { replace: true })
  }

  return (
    <div className="min-h-screen bg-ink font-body text-paper">
      <header className="sticky top-0 z-40 border-b border-white/10 bg-ink/80 backdrop-blur-xl">
        <div className="mx-auto flex h-14 max-w-6xl items-center justify-between gap-4 px-4 sm:px-6">
          <Link to="/admin" className="flex items-center gap-2.5 rounded-lg">
            <span aria-hidden className="h-2 w-2 rounded-full bg-red" />
            <span className="text-sm font-semibold tracking-tight">TEDxKLH</span>
            <span className="text-sm text-paper/35">Admin</span>
          </Link>

          <div className="flex items-center gap-2 sm:gap-3">
            {/* Desktop tabs; mobile uses the bottom nav instead. */}
            <nav className="hidden items-center gap-1 rounded-lg border border-white/10 bg-white/[0.03] p-1 md:flex">
              {tabs.map((tab) => (
                <NavLink
                  key={tab.to}
                  to={tab.to}
                  end
                  className={({ isActive }) =>
                    [
                      'rounded-md px-3 py-1.5 text-sm font-medium transition-colors',
                      isActive ? 'bg-white/10 text-paper' : 'text-paper/55 hover:text-paper',
                    ].join(' ')
                  }
                >
                  {tab.label}
                </NavLink>
              ))}
            </nav>

            <Link
              to="/admin/scan"
              className="hidden h-9 items-center rounded-lg bg-red px-4 text-sm font-medium text-white transition-colors hover:bg-red/90 md:inline-flex"
            >
              Scan passes
            </Link>

            <span className="hidden max-w-[10rem] items-center gap-2 truncate text-sm text-paper/45 sm:inline-flex">
              {getAdminName()}
              {superAdmin && (
                <span className="flex-none rounded border border-red/30 bg-red/10 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-[0.08em] text-red">
                  Super
                </span>
              )}
            </span>
            <button
              type="button"
              onClick={onLogout}
              className="rounded-lg px-2.5 py-1.5 text-sm text-paper/55 transition-colors hover:bg-red/10 hover:text-red"
            >
              Sign out
            </button>
          </div>
        </div>
      </header>

      {/* Bottom padding clears the fixed mobile nav; reduced at md+. */}
      <main className="mx-auto max-w-6xl px-4 pb-28 pt-7 sm:px-6 md:pb-16 md:pt-10">
        <div className="mb-6 md:mb-8">
          <h1 className="text-2xl font-semibold tracking-tight md:text-3xl">{page.title}</h1>
          {page.description && <p className="mt-1 text-sm text-paper/45">{page.description}</p>}
        </div>
        <Outlet />
      </main>

      <BottomNav />
    </div>
  )
}
