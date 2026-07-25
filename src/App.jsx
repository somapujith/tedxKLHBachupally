import { Routes, Route } from 'react-router-dom'
import Layout from './components/Layout'
import Home from './pages/Home'
import Events from './pages/Events'
import EventDetail from './pages/EventDetail'
import SpeakerDetail from './pages/SpeakerDetail'
import Theme from './pages/Theme'
import About from './pages/About'
import Team from './pages/Team'
import Blog from './pages/Blog'
import Partners from './pages/Partners'
import Sponsor from './pages/Sponsor'
import Register from './pages/Register'
import { Volunteer, Nominate } from './pages/ClosedPages'
import NotFound from './pages/NotFound'

export default function App() {
  return (
    <Layout>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/events" element={<Events />} />
        <Route path="/events/1" element={<EventDetail />} />
        <Route path="/events/1/speakers" element={<EventDetail />} />
        <Route path="/events/1/speakers/:slug" element={<SpeakerDetail />} />
        <Route path="/events/1/schedule" element={<EventDetail />} />
        <Route path="/events/1/gallery" element={<EventDetail />} />
        <Route path="/events/1/experience" element={<EventDetail />} />
        <Route path="/theme" element={<Theme />} />
        <Route path="/about-tedxklh" element={<About />} />
        <Route path="/about-ted" element={<About />} />
        <Route path="/about-tedx" element={<About />} />
        <Route path="/team" element={<Team />} />
        <Route path="/blog" element={<Blog />} />
        <Route path="/partners" element={<Partners />} />
        <Route path="/register" element={<Register />} />
        <Route path="/volunteer" element={<Volunteer />} />
        <Route path="/sponsor" element={<Sponsor />} />
        <Route path="/nominate" element={<Nominate />} />
        <Route path="*" element={<NotFound />} />
      </Routes>
    </Layout>
  )
}
