import { useEffect, useState } from 'react'
import { Link, NavLink, useLocation } from 'react-router-dom'
import { nav, event } from '../data/site'
import logo from '../assets/logo-white-tedx.svg'

const footerSocial = [
  { label: 'Instagram', href: 'https://www.instagram.com/tedxklhbachupally/' },
  { label: 'LinkedIn', href: 'https://linkedin.com/company/tedxklhbachupally' },
]

function linkClass({ isActive }) {
  return [
    'relative py-1 transition-colors duration-200',
    isActive ? 'text-red' : 'text-paper/70 hover:text-paper',
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
    <div className="min-h-screen bg-ink text-paper flex flex-col">
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
                {({ isActive }) => (
                  <>
                    {item.label}
                    <span
                      aria-hidden
                      className={[
                        'absolute left-0 -bottom-0.5 h-px w-full bg-red transition-opacity duration-200',
                        isActive || isNavActive(item.to, location.pathname) ? 'opacity-100' : 'opacity-0',
                      ].join(' ')}
                    />
                  </>
                )}
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
                    active ? 'text-red' : 'text-paper/70 hover:text-paper',
                  ].join(' ')}
                >
                  {item.label}
                </Link>
              )
            })}
          </div>
        </nav>
      </header>

      <main className="flex-1">{children}</main>

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
              {footerSocial.map((s) => (
                <a
                  key={s.label}
                  href={s.href}
                  target="_blank"
                  rel="noreferrer"
                  className="text-xs font-montserrat uppercase tracking-widest text-paper/50 hover:text-red transition-colors duration-200"
                >
                  {s.label}
                </a>
              ))}
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
