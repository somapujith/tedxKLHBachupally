import { useEffect, useState } from 'react'
import { Link, NavLink, useLocation } from 'react-router-dom'
import { nav, event } from '../data/site'
import { GrainOverlay } from './texture'
import logo from '../assets/logo-white-tedx.svg'

const instagramUrl = 'https://www.instagram.com/tedxklhbachupally?igsh=ZnljMmcydTZia3Fj'

function linkClass({ isActive }) {
  return [
    'py-1 no-underline transition-colors duration-200',
    isActive ? 'text-red' : 'text-paper/70 hover:text-red/70',
  ].join(' ')
}

function isNavActive(to, pathname) {
  if (to === '/about-tedxklh') return pathname.startsWith('/about-')
  if (to === '/events') return pathname.startsWith('/events')
  return pathname === to
}

export default function Layout({ children }) {
  const [menuOpen, setMenuOpen] = useState(false)
  const location = useLocation()

  useEffect(() => {
    setMenuOpen(false)
  }, [location.pathname])

  useEffect(() => {
    document.body.style.overflow = menuOpen ? 'hidden' : ''
    return () => {
      document.body.style.overflow = ''
    }
  }, [menuOpen])

  return (
    <div className="relative min-h-screen bg-ink text-paper flex flex-col">
      <GrainOverlay />
      <header className="sticky top-0 z-50 border-b border-paper/15 bg-ink/90 backdrop-blur-md">
        <div className="max-w-6xl mx-auto flex items-center justify-between px-6 py-4 md:py-5">
          <Link to="/" className="flex items-center gap-3 shrink-0" onClick={() => setMenuOpen(false)}>
            <img src={logo} alt="TEDxKLH Bachupally" className="h-12 md:h-14 w-auto" />
          </Link>

          <nav
            aria-label="Primary"
            className="hidden md:flex items-center gap-10 font-montserrat text-[11px] font-medium uppercase tracking-[0.2em]"
          >
            {nav.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                className={({ isActive }) =>
                  linkClass({ isActive: isActive || isNavActive(item.to, location.pathname) })
                }
              >
                {item.label}
              </NavLink>
            ))}
          </nav>

          <div className="flex items-center gap-3">
            <Link
              to="/register"
              className="border border-red px-4 py-2 text-[11px] font-montserrat font-medium uppercase tracking-[0.2em] hover:bg-red transition-colors duration-200"
            >
              Register
            </Link>
            <button
              type="button"
              className="md:hidden relative h-10 w-10 flex items-center justify-center"
              aria-label={menuOpen ? 'Close menu' : 'Open menu'}
              aria-expanded={menuOpen}
              aria-controls="mobile-nav"
              onClick={() => setMenuOpen((open) => !open)}
            >
              <span className="sr-only">{menuOpen ? 'Close' : 'Menu'}</span>
              <span
                aria-hidden
                className={[
                  'absolute h-px w-5 bg-paper transition-transform duration-200',
                  menuOpen ? 'rotate-45' : '-translate-y-1.5',
                ].join(' ')}
              />
              <span
                aria-hidden
                className={[
                  'absolute h-px w-5 bg-paper transition-opacity duration-200',
                  menuOpen ? 'opacity-0' : 'opacity-100',
                ].join(' ')}
              />
              <span
                aria-hidden
                className={[
                  'absolute h-px w-5 bg-paper transition-transform duration-200',
                  menuOpen ? '-rotate-45' : 'translate-y-1.5',
                ].join(' ')}
              />
            </button>
          </div>
        </div>

        <nav
          id="mobile-nav"
          aria-label="Mobile"
          className={[
            'md:hidden overflow-hidden border-t border-paper/10 bg-ink transition-[max-height,opacity] duration-300 ease-out',
            menuOpen ? 'max-h-80 opacity-100' : 'max-h-0 opacity-0 border-t-0',
          ].join(' ')}
        >
          <div className="flex flex-col font-montserrat text-[11px] font-medium uppercase tracking-[0.2em]">
            {nav.map((item) => {
              const active = isNavActive(item.to, location.pathname)
              return (
                <Link
                  key={item.to}
                  to={item.to}
                  onClick={() => setMenuOpen(false)}
                  className={[
                    'px-6 py-4 border-t border-paper/10 transition-colors duration-200',
                    active ? 'text-red' : 'text-paper/70 hover:text-red/70',
                  ].join(' ')}
                >
                  {item.label}
                </Link>
              )
            })}
          </div>
        </nav>
      </header>

      <main className="relative z-10 flex-1">{children}</main>

      <footer className="border-t border-paper/20 mt-24 bg-ink">
        <div className="max-w-6xl mx-auto px-6 pt-16 pb-12 grid grid-cols-2 md:grid-cols-5 gap-10">
          <div className="col-span-2 md:col-span-2 pr-6">
            <Link to="/" className="inline-flex items-center mb-4">
              <img src={logo} alt="TEDxKLH Bachupally" className="h-10 w-auto" />
            </Link>
            <p className="text-sm text-paper/60 max-w-xs leading-relaxed">
              An independently organized TED event, licensed by TED, curated and produced by students of KL University, Bachupally.
            </p>
            <div className="flex items-center gap-4 mt-6">
              <a
                href={instagramUrl}
                target="_blank"
                rel="noreferrer"
                aria-label="Instagram"
                className="text-paper/50 hover:text-red transition-colors duration-200"
              >
                <svg viewBox="0 0 24 24" className="h-5 w-5" fill="currentColor" aria-hidden="true">
                  <path d="M12 2.2c3.2 0 3.6 0 4.85.07 1.17.05 2.16.25 2.91.53a5.9 5.9 0 0 1 2.13 1.39 5.9 5.9 0 0 1 1.39 2.13c.28.75.48 1.74.53 2.91.06 1.25.07 1.65.07 4.85s0 3.6-.07 4.85c-.05 1.17-.25 2.16-.53 2.91a5.9 5.9 0 0 1-1.39 2.13 5.9 5.9 0 0 1-2.13 1.39c-.75.28-1.74.48-2.91.53-1.25.06-1.65.07-4.85.07s-3.6 0-4.85-.07c-1.17-.05-2.16-.25-2.91-.53a5.9 5.9 0 0 1-2.13-1.39 5.9 5.9 0 0 1-1.39-2.13c-.28-.75-.48-1.74-.53-2.91C2.2 15.6 2.2 15.2 2.2 12s0-3.6.07-4.85c.05-1.17.25-2.16.53-2.91A5.9 5.9 0 0 1 4.19 2.11 5.9 5.9 0 0 1 6.32.72c.75-.28 1.74-.48 2.91-.53C10.4 0.13 10.8.12 12 .12zm0 1.98c-3.14 0-3.51 0-4.75.07-1 .04-1.7.2-2.2.4a3.9 3.9 0 0 0-1.44.94 3.9 3.9 0 0 0-.94 1.44c-.19.5-.35 1.2-.4 2.2C2.2 8.29 2.2 8.66 2.2 11.8s0 3.51.07 4.75c.05 1 .21 1.7.4 2.2.2.53.47.98.94 1.44.46.47.9.75 1.44.94.5.19 1.2.35 2.2.4 1.24.06 1.61.07 4.75.07s3.51 0 4.75-.07c1-.05 1.7-.21 2.2-.4.53-.2.98-.47 1.44-.94.47-.46.75-.9.94-1.44.19-.5.35-1.2.4-2.2.06-1.24.07-1.61.07-4.75s0-3.51-.07-4.75c-.05-1-.21-1.7-.4-2.2a3.9 3.9 0 0 0-.94-1.44 3.9 3.9 0 0 0-1.44-.94c-.5-.19-1.2-.35-2.2-.4C15.51 4.18 15.14 4.18 12 4.18z"/>
                  <path d="M12 6.86a5.14 5.14 0 1 0 0 10.28 5.14 5.14 0 0 0 0-10.28zm0 8.48a3.34 3.34 0 1 1 0-6.68 3.34 3.34 0 0 1 0 6.68zM17.4 6.6a1.2 1.2 0 1 1-2.4 0 1.2 1.2 0 0 1 2.4 0z"/>
                </svg>
              </a>
            </div>
          </div>
          <FooterCol
            title="Event"
            links={[
              { label: 'Theme', to: '/theme' },
              { label: 'Events', to: '/events' },
              { label: 'Speakers', to: '/events/1/speakers' },
              { label: 'Schedule', to: '/events/1/schedule' },
            ]}
          />
          <FooterCol
            title="Get Involved"
            links={[
              { label: 'Register', to: '/register' },
              { label: 'Volunteer', to: '/volunteer' },
              { label: 'Sponsor', to: '/sponsor' },
              { label: 'Nominate a Speaker', to: '/nominate' },
            ]}
          />
          <div>
            <div className="font-mono text-xs uppercase tracking-widest text-paper/60 mb-4">Contact</div>
            <address className="not-italic text-sm text-paper/70 space-y-1.5 leading-relaxed">
              <p>{event.venue}</p>
              <p>{event.city}</p>
              <p>
                <a href="mailto:hello@tedxklhbachupally.in" className="hover:text-red transition-colors">
                  hello@tedxklhbachupally.in
                </a>
              </p>
            </address>
          </div>
        </div>
        <div className="border-t border-paper/10">
          <div className="max-w-6xl mx-auto px-6 py-6 flex flex-col-reverse md:flex-row items-center justify-between gap-3 text-xs text-paper/45">
            <p>© {event.year} TEDxKLH Bachupally. All rights reserved.</p>
            <p className="text-center md:text-right">
              This independent TEDx event is operated under license from TED.
            </p>
          </div>
        </div>
      </footer>
    </div>
  )
}

function FooterCol({ title, links }) {
  return (
    <div>
      <div className="font-mono text-xs uppercase tracking-widest text-paper/60 mb-3">{title}</div>
      <ul className="space-y-2 text-sm">
        {links.map((l) => (
          <li key={l.to}>
            <Link to={l.to} className="hover:text-red transition-colors">
              {l.label}
            </Link>
          </li>
        ))}
      </ul>
    </div>
  )
}
