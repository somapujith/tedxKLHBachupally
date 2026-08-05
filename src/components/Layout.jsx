import { lazy, Suspense, useEffect, useRef, useState } from 'react'
import { Link, NavLink, useLocation } from 'react-router-dom'
import Lenis from 'lenis'
import { nav, event } from '../data/site'
import { useBackendWarmup } from '../hooks/useBackendWarmup'
import { Button } from './ui'
import { GrainOverlay } from './texture'
import logo from '../assets/logo-white-tedx.svg'
import instagramIcon from '../assets/images/instagram.svg'

// Lazy so three.js (the whole cost of this component) only ever ships to a page
// that actually renders the background — never as part of Layout's own chunk,
// which wraps every public route.
const ColorBends = lazy(() => import('./ColorBends'))

// True when the OS asked for less motion, or the browser reports a metered /
// slow connection (Data Saver). Either way, downloading three.js and running a
// decorative shader background is a pure cost with no benefit to this user.
function shouldSkipWebglEffects() {
  const reduceMotion =
    typeof window !== 'undefined' &&
    window.matchMedia &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches
  const saveData =
    typeof navigator !== 'undefined' && navigator.connection && navigator.connection.saveData
  return Boolean(reduceMotion || saveData)
}

const instagramUrl = 'https://www.instagram.com/tedxklhbachupally?igsh=ZnljMmcydTZia3Fj'
const linkedinUrl = 'https://www.linkedin.com/company/tedxklhbachupally/about/?viewAsMember=true'

function isNavActive(to, pathname) {
  if (to === '/about-tedxklh') return pathname.startsWith('/about-')
  return pathname === to
}

// Reset scroll to the top on every route change. Uses Lenis when present so
// its internal scroll state resets in sync; falls back to native scroll.
function ScrollToTop({ lenisRef }) {
  const { pathname } = useLocation()
  useEffect(() => {
    if (lenisRef.current) {
      lenisRef.current.scrollTo(0, { immediate: true })
    } else {
      window.scrollTo({ top: 0, left: 0, behavior: 'instant' })
    }
  }, [pathname, lenisRef])
  return null
}

export default function Layout({ children }) {
  const [menuOpen, setMenuOpen] = useState(false)
  const location = useLocation()
  const lenisRef = useRef(null)

  // Poke the API on every public route change (and on a keep-alive tick) so the
  // Render instance is already booted by the time anyone reaches /register. The
  // register page still verifies before submitting — this only moves the cold
  // start off the checkout path and into the browsing time before it.
  useBackendWarmup()

  // Smooth momentum scrolling for the whole app. Respects reduced-motion.
  useEffect(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return

    const lenis = new Lenis({ duration: 1.1, smoothWheel: true })
    lenisRef.current = lenis

    let rafId
    const raf = (time) => {
      lenis.raf(time)
      rafId = requestAnimationFrame(raf)
    }
    rafId = requestAnimationFrame(raf)

    return () => {
      cancelAnimationFrame(rafId)
      lenis.destroy()
      lenisRef.current = null
    }
  }, [])

  useEffect(() => {
    setMenuOpen(false)
  }, [location.pathname])

  useEffect(() => {
    document.body.style.overflow = menuOpen ? 'hidden' : ''
    // Stop momentum scroll while the mobile menu locks the body.
    if (lenisRef.current) {
      if (menuOpen) lenisRef.current.stop()
      else lenisRef.current.start()
    }
    return () => {
      document.body.style.overflow = ''
    }
  }, [menuOpen])

  return (
    <div className="relative min-h-screen bg-ink text-paper flex flex-col">
      <ScrollToTop lenisRef={lenisRef} />
      <GrainOverlay />
      {location.pathname !== '/' && !shouldSkipWebglEffects() && (
        <div
          aria-hidden
          className="pointer-events-none fixed inset-0 z-0 opacity-30 [mask-image:linear-gradient(to_bottom,transparent_5%,black_55%)] [-webkit-mask-image:linear-gradient(to_bottom,transparent_5%,black_55%)]"
        >
          {/* Suspense fallback is empty: this div is a decorative overlay on top of
              the page's own background, so there is nothing to fill in while the
              chunk loads. */}
          <Suspense fallback={null}>
            <ColorBends
              colors={['#E62B1E', '#7a1410', '#2b0503']}
              rotation={30}
              speed={0.15}
              scale={1.5}
              frequency={1.4}
              warpStrength={1}
              mouseInfluence={0.15}
              parallax={0.3}
              noise={0.1}
              iterations={2}
              intensity={0.9}
              bandWidth={6}
              transparent
            />
          </Suspense>
        </div>
      )}
      <header className="sticky top-0 z-50 border-b border-paper/10 bg-ink/90 backdrop-blur-md">
        <div className="max-w-6xl mx-auto flex items-center justify-between px-6 py-4 md:py-5">
          <Link to="/" className="flex items-center gap-3 shrink-0" onClick={() => setMenuOpen(false)}>
            <img src={logo} alt="TEDxKLH Bachupally" className="h-11 md:h-12 w-auto" />
          </Link>

          <nav
            aria-label="Primary"
            className="hidden md:flex items-center gap-9 font-body text-[11px] font-medium uppercase tracking-[0.22em]"
          >
            {nav.map((item) => {
              const active = isNavActive(item.to, location.pathname)
              return (
                <NavLink
                  key={item.to}
                  to={item.to}
                  aria-current={active ? 'page' : undefined}
                  className={[
                    'relative py-1 no-underline transition-colors duration-200',
                    active ? 'text-paper' : 'text-paper/55 hover:text-paper',
                  ].join(' ')}
                >
                  {item.label}
                  {active && (
                    <span
                      aria-hidden
                      className="absolute -bottom-1 left-1/2 h-1 w-1 -translate-x-1/2 rounded-full bg-red"
                    />
                  )}
                </NavLink>
              )
            })}
          </nav>

          <div className="flex items-center gap-3">
            <Button
              to="/register"
              variant="outline"
              className="px-4 py-2 !font-body text-[11px] font-medium !tracking-[0.2em]"
            >
              Register
            </Button>
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
          <div className="flex flex-col font-body text-[11px] font-medium uppercase tracking-[0.2em]">
            {nav.map((item) => {
              const active = isNavActive(item.to, location.pathname)
              return (
                <Link
                  key={item.to}
                  to={item.to}
                  onClick={() => setMenuOpen(false)}
                  className={[
                    'flex items-center gap-2.5 px-6 py-4 border-t border-paper/10 transition-colors duration-200',
                    active ? 'text-paper' : 'text-paper/55 hover:text-paper',
                  ].join(' ')}
                >
                  {active && <span aria-hidden className="h-1 w-1 rounded-full bg-red" />}
                  {item.label}
                </Link>
              )
            })}
          </div>
        </nav>
      </header>

      <main className="relative z-10 flex-1">{children}</main>

      <footer className="border-t border-paper/20 mt-24 bg-ink">
        <div className="max-w-6xl mx-auto px-6 pt-16 pb-12 grid grid-cols-2 md:grid-cols-4 gap-10">
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
                className="opacity-80 transition-opacity duration-200 hover:opacity-100"
              >
                {/* Instagram's own gradient mark, so it cannot inherit the
                    footer's currentColor — hover shifts opacity instead. */}
                <img src={instagramIcon} alt="" aria-hidden="true" className="h-5 w-5" />
              </a>
              <a
                href={linkedinUrl}
                target="_blank"
                rel="noreferrer"
                aria-label="LinkedIn"
                className="text-paper/80 transition-colors duration-200 hover:text-paper"
              >
                <svg viewBox="0 0 24 24" aria-hidden="true" className="h-5 w-5" fill="currentColor">
                  <path d="M20.45 20.45h-3.55v-5.57c0-1.33-.02-3.03-1.85-3.03-1.85 0-2.14 1.45-2.14 2.94v5.66H9.36V9h3.41v1.56h.05c.47-.9 1.63-1.85 3.36-1.85 3.6 0 4.27 2.37 4.27 5.45v6.29zM5.34 7.43a2.06 2.06 0 1 1 0-4.12 2.06 2.06 0 0 1 0 4.12zM7.12 20.45H3.56V9h3.56v11.45z" />
                </svg>
              </a>
            </div>
          </div>
          <FooterCol
            title="Event"
            links={[
              { label: 'Register', to: '/register' },
              { label: 'Theme', to: '/theme' },
              { label: 'Schedule', to: '/schedule' },
              { label: 'Sponsor', to: '/sponsor' },
            ]}
          />
          <div>
            <div className="font-mono text-xs uppercase tracking-widest text-paper/60 mb-4">Contact</div>
            <address className="not-italic text-sm text-paper/70 space-y-1.5 leading-relaxed">
              <p>{event.venue}</p>
              <p>{event.city}</p>
              <p>
                <a href="mailto:tedxklhbachupally@klh.edu.in" className="hover:text-red transition-colors">
                  tedxklhbachupally@klh.edu.in
                </a>
              </p>
              <p>
                <Link to="/contact" className="hover:text-red transition-colors">
                  Contact us
                </Link>
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
