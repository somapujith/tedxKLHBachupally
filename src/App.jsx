import { lazy, Suspense } from 'react'
import { Routes, Route, Outlet } from 'react-router-dom'
import Layout from './components/Layout'
import Home from './pages/Home'
import Speakers from './pages/Speakers'
import Theme from './pages/Theme'
import About from './pages/About'
import Team from './pages/Team'
import Blog from './pages/Blog'
import Partners from './pages/Partners'
import Sponsor from './pages/Sponsor'
import Register from './pages/Register'
import Contact from './pages/Contact'
import { Volunteer, Nominate, Schedule } from './pages/ClosedPages'
import NotFound from './pages/NotFound'

// Admin pages are lazy so html5-qrcode & co. stay out of the public bundle.
const AdminLogin = lazy(() => import('./admin/AdminLogin'))
const AdminShell = lazy(() => import('./admin/AdminShell'))
const AdminDashboard = lazy(() => import('./admin/AdminDashboard'))
const AdminRegistrations = lazy(() => import('./admin/AdminRegistrations'))
const AdminScan = lazy(() => import('./admin/AdminScan'))
// Superadmin-only screens. Lazy like the rest, so a gate admin who never opens
// them never downloads them.
const AdminActivity = lazy(() => import('./admin/AdminActivity'))
const AdminAdmins = lazy(() => import('./admin/AdminAdmins'))

// Public pages keep the site chrome (nav + footer); admin routes render bare.
function PublicShell() {
  return (
    <Layout>
      <Outlet />
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
    <Routes>
      <Route path="/admin/login" element={<AdminRoute page={AdminLogin} />} />
      {/* Scanner renders bare (immersive full-screen, no bottom nav). */}
      <Route path="/admin/scan" element={<AdminRoute page={AdminScan} />} />
      {/* Tabbed screens share the mobile shell (top bar + bottom nav). */}
      <Route path="/admin" element={<AdminRoute page={AdminShell} />}>
        <Route index element={<AdminRoute page={AdminDashboard} />} />
        <Route path="registrations" element={<AdminRoute page={AdminRegistrations} />} />
        <Route path="activity" element={<AdminRoute page={AdminActivity} />} />
        <Route path="admins" element={<AdminRoute page={AdminAdmins} />} />
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
  )
}
