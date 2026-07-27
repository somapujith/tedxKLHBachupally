import { useEffect } from 'react'
import { Link, NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom'
import { getAdminName, getToken, logout } from './api'
import BottomNav from './BottomNav'

// Shared chrome for the tabbed admin screens (Dashboard, Registrations).
// Top bar = identity + navigation only; the page title/description live in the
// content column so the bar stays one line tall on every device.
// The scanner and login screens render bare, outside this shell.

const PAGES = {
  '/admin': { title: 'Dashboard', description: 'Live registration and check-in numbers.' },
  '/admin/registrations': { title: 'Registrations', description: 'Search, filter and resend attendee passes.' },
}

const TABS = [
  { to: '/admin', label: 'Dashboard' },
  { to: '/admin/registrations', label: 'Registrations' },
]

export default function AdminShell() {
  const navigate = useNavigate()
  const { pathname } = useLocation()
  const page = PAGES[pathname] ?? { title: 'Admin', description: '' }

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
              {TABS.map((tab) => (
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

            <span className="hidden max-w-[10rem] truncate text-sm text-paper/45 sm:inline">{getAdminName()}</span>
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
