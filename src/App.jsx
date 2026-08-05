import { lazy, Suspense, useEffect } from 'react'
import { Routes, Route, Outlet, useLocation } from 'react-router-dom'
import Layout from './components/Layout'
import { applySeo, applyNoindex } from './lib/seo'

// Public pages are lazy too, same reasoning as the admin pages below: each page's
// own weight (and anything it pulls in, like three.js on Home) should only ship
// to the route that actually needs it, not to every page via the entry chunk.
const Home = lazy(() => import('./pages/Home'))
const Speakers = lazy(() => import('./pages/Speakers'))
const Theme = lazy(() => import('./pages/Theme'))
const About = lazy(() => import('./pages/About'))
const Team = lazy(() => import('./pages/Team'))
const Blog = lazy(() => import('./pages/Blog'))
const Partners = lazy(() => import('./pages/Partners'))
const Sponsor = lazy(() => import('./pages/Sponsor'))
const Register = lazy(() => import('./pages/Register'))
const Contact = lazy(() => import('./pages/Contact'))
const NotFound = lazy(() => import('./pages/NotFound'))
// ClosedPages exports three named components from one module — each lazy()
// call needs a default export, so unwrap the named export into one.
const Volunteer = lazy(() => import('./pages/ClosedPages').then((m) => ({ default: m.Volunteer })))
const Nominate = lazy(() => import('./pages/ClosedPages').then((m) => ({ default: m.Nominate })))
const Schedule = lazy(() => import('./pages/ClosedPages').then((m) => ({ default: m.Schedule })))

// Admin pages are lazy so html5-qrcode & co. stay out of the public bundle.
const AdminLogin = lazy(() => import('./admin/AdminLogin'))
const AdminShell = lazy(() => import('./admin/AdminShell'))
const AdminDashboard = lazy(() => import('./admin/AdminDashboard'))
const AdminRegistrations = lazy(() => import('./admin/AdminRegistrations'))
const AdminScan = lazy(() => import('./admin/AdminScan'))
const AdminSupport = lazy(() => import('./admin/AdminSupport'))
// Superadmin-only screens. Lazy like the rest, so a gate admin who never opens
// them never downloads them.
const AdminActivity = lazy(() => import('./admin/AdminActivity'))
const AdminAdmins = lazy(() => import('./admin/AdminAdmins'))
const AdminPayments = lazy(() => import('./admin/AdminPayments'))

// Rewrites the document head on every navigation. A client-side route change
// does not reload the document, so without this every page after the first
// would keep the previous page's title, description and canonical — and
// Googlebot, which crawls each URL as a fresh load, would still be right to
// read them as duplicates of the entry page.
function Seo() {
  const { pathname } = useLocation()
  useEffect(() => {
    if (pathname.startsWith('/admin')) applyNoindex()
    else applySeo(pathname)
  }, [pathname])
  return null
}

// Public pages keep the site chrome (nav + footer); admin routes render bare.
// Only the routed page content suspends — Layout (nav/footer) still renders
// immediately on every navigation, so the fallback never has to reproduce it.
function PublicShell() {
  return (
    <Layout>
      <Suspense fallback={<div className="min-h-[60vh]" />}>
        <Outlet />
      </Suspense>
    </Layout>
  )
}

function AdminRoute({ page: Page }) {
  return (
    <Suspense fallback={<div className="min-h-screen bg-ink" />}>
      <Page />
    </Suspense>
  )
}

export default function App() {
  return (
    <>
      <Seo />
      <Routes>
      <Route path="/admin/login" element={<AdminRoute page={AdminLogin} />} />
      {/* Scanner renders bare (immersive full-screen, no bottom nav). */}
      <Route path="/admin/scan" element={<AdminRoute page={AdminScan} />} />
      {/* Tabbed screens share the mobile shell (top bar + bottom nav). */}
      <Route path="/admin" element={<AdminRoute page={AdminShell} />}>
        <Route index element={<AdminRoute page={AdminDashboard} />} />
        <Route path="registrations" element={<AdminRoute page={AdminRegistrations} />} />
        <Route path="support" element={<AdminRoute page={AdminSupport} />} />
        <Route path="activity" element={<AdminRoute page={AdminActivity} />} />
        <Route path="admins" element={<AdminRoute page={AdminAdmins} />} />
        <Route path="payments" element={<AdminRoute page={AdminPayments} />} />
      </Route>

      <Route element={<PublicShell />}>
        <Route path="/" element={<Home />} />
        <Route path="/speakers" element={<Speakers />} />
        <Route path="/theme" element={<Theme />} />
        <Route path="/about-tedxklh" element={<About />} />
        <Route path="/about-ted" element={<About />} />
        <Route path="/about-tedx" element={<About />} />
        <Route path="/team" element={<Team />} />
        <Route path="/blog" element={<Blog />} />
        <Route path="/partners" element={<Partners />} />
        <Route path="/register" element={<Register />} />
        <Route path="/contact" element={<Contact />} />
        <Route path="/volunteer" element={<Volunteer />} />
        <Route path="/schedule" element={<Schedule />} />
        <Route path="/sponsor" element={<Sponsor />} />
        <Route path="/nominate" element={<Nominate />} />
        <Route path="*" element={<NotFound />} />
      </Route>
      </Routes>
    </>
  )
}
