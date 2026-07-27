import { useEffect } from 'react'
import { Link, Outlet, useLocation, useNavigate } from 'react-router-dom'
import { Eyebrow } from '../components/ui'
import { getAdminName, getToken, logout } from './api'
import BottomNav from './BottomNav'

// Shared chrome for the tabbed admin screens (Dashboard, Registrations).
// Renders a compact top bar (admin name + logout) and the mobile BottomNav.
// The scanner and login screens render bare, outside this shell.

const TITLES = {
  '/admin': 'Dashboard',
  '/admin/registrations': 'Registrations',
}

export default function AdminShell() {
  const navigate = useNavigate()
  const { pathname } = useLocation()

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
    <div className="min-h-screen bg-ink text-paper">
      <header className="sticky top-0 z-40 border-b border-paper/15 bg-ink/90 backdrop-blur-md">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-5 py-3.5 md:px-6 md:py-4">
          <div>
            <Eyebrow>TEDxKLH · Admin</Eyebrow>
            <div className="mt-0.5 font-display text-lg tracking-tight md:text-xl">
              {TITLES[pathname] ?? 'Admin'}
            </div>
          </div>

          <div className="flex items-center gap-4 md:gap-5">
            {/* Desktop-only tab links; mobile uses the bottom nav instead. */}
            <nav className="hidden items-center gap-5 md:flex">
              <Link to="/admin" className="font-mono text-[11px] uppercase tracking-[0.2em] text-paper/60 hover:text-paper">
                Dashboard
              </Link>
              <Link to="/admin/registrations" className="font-mono text-[11px] uppercase tracking-[0.2em] text-paper/60 hover:text-paper">
                Registrations
              </Link>
              <Link
                to="/admin/scan"
                className="border border-red px-4 py-2 font-mono text-[11px] uppercase tracking-[0.2em] text-red transition-colors hover:bg-red hover:text-ink"
              >
                Gate scanner
              </Link>
            </nav>

            <span className="hidden font-mono text-[11px] uppercase tracking-[0.2em] text-paper/55 sm:inline">
              {getAdminName()}
            </span>
            <button
              type="button"
              onClick={onLogout}
              aria-label="Sign out"
              className="font-mono text-[11px] uppercase tracking-[0.2em] text-paper/55 transition-colors hover:text-red"
            >
              Logout
            </button>
          </div>
        </div>
      </header>

      {/* Bottom padding clears the fixed mobile nav; removed at md+. */}
      <main className="mx-auto max-w-6xl px-5 pb-28 pt-6 md:px-6 md:pb-16 md:pt-10">
        <Outlet />
      </main>

      <BottomNav />
    </div>
  )
}
