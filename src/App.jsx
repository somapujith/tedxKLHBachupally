import { lazy, Suspense } from 'react'
import { Routes, Route, Outlet } from 'react-router-dom'
import Layout from './components/Layout'
import Home from './pages/Home'
import Events from './pages/Events'
import EventDetail from './pages/EventDetail'
import SpeakerDetail from './pages/SpeakerDetail'
import Speakers from './pages/Speakers'
import Theme from './pages/Theme'
import About from './pages/About'
import Team from './pages/Team'
import Blog from './pages/Blog'
import Partners from './pages/Partners'
import Sponsor from './pages/Sponsor'
import Register from './pages/Register'
import Contact from './pages/Contact'
import { Volunteer, Nominate } from './pages/ClosedPages'
import NotFound from './pages/NotFound'

// Admin pages are lazy so html5-qrcode & co. stay out of the public bundle.
const AdminLogin = lazy(() => import('./admin/AdminLogin'))
const AdminDashboard = lazy(() => import('./admin/AdminDashboard'))
const AdminScan = lazy(() => import('./admin/AdminScan'))

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
      <Route path="/admin" element={<AdminRoute page={AdminDashboard} />} />
      <Route path="/admin/scan" element={<AdminRoute page={AdminScan} />} />

      <Route element={<PublicShell />}>
        <Route path="/" element={<Home />} />
        <Route path="/events" element={<Events />} />
        <Route path="/events/1" element={<EventDetail />} />
        <Route path="/events/1/speakers" element={<EventDetail />} />
        <Route path="/events/1/speakers/:slug" element={<SpeakerDetail />} />
        <Route path="/events/1/schedule" element={<EventDetail />} />
        <Route path="/events/1/gallery" element={<EventDetail />} />
        <Route path="/events/1/experience" element={<EventDetail />} />
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
        <Route path="/sponsor" element={<Sponsor />} />
        <Route path="/nominate" element={<Nominate />} />
        <Route path="*" element={<NotFound />} />
      </Route>
    </Routes>
  )
}
