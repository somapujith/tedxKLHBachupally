// Per-route SEO metadata for a client-rendered SPA.
//
// index.html carries the defaults a non-rendering crawler (Facebook, WhatsApp,
// Slack, X) can see without executing JavaScript. This module overwrites them
// per route for users and for Googlebot, which does render. Both layers are
// needed: the static one because scrapers never boot React, the runtime one
// because a single static title cannot describe sixteen different pages.
//
// Every fact here traces to src/data/event.js. When the date, venue or price
// changes there, the strings below and the JSON-LD in index.html must follow.

import { speakers, isRevealed } from '../data/event.js'

export const SITE_URL = 'https://www.tedxklhbachupally.in'
const SITE_NAME = 'TEDxKLH Bachupally'

// Titles stay under ~60 characters and descriptions under ~155, which is where
// Google truncates on desktop. Longer is not penalised, it is simply cut — and
// a description that ends mid-sentence earns fewer clicks.
export const PAGE_SEO = {
  '/': {
    title: 'TEDxKLH Bachupally 2026 | Technology Evolves, Humanity Leads',
    description:
      'An independently organized TEDx event at KL University, Hyderabad — Sat, Aug 22, 2026. 7 speakers, one stage, ₹599. Reserve your seat.',
  },
  '/register': {
    title: 'Register for TEDxKLH Bachupally 2026 | ₹599',
    description:
      'Claim your seat at TEDxKLH Bachupally, Sat Aug 22, 2026. ₹599 per pass, 250 seats, KL University Bachupally Campus, Hyderabad. Register now.',
  },
  // The page renders all names, roles and bios from src/data/event.js, so
  // this description matches what a crawler actually finds — and so do the
  // JSON-LD `performer` entries in index.html.
  '/speakers': {
    title: 'Speakers | TEDxKLH Bachupally 2026',
    description:
      '7 speakers across Health, Business, Technology & Arts take the TEDxKLH stage, Aug 22, 2026 in Hyderabad.',
  },
  '/theme': {
    title: 'Theme 2026: Technology Evolves, Humanity Leads | TEDxKLH',
    description:
      "TEDxKLH Bachupally 2026's theme: Technology Evolves, Humanity Leads. What stays uniquely human as AI, automation and culture change fast.",
  },
  '/schedule': {
    title: 'Schedule — TEDxKLH Bachupally, 22 August 2026',
    description:
      'The full running order for TEDxKLH Bachupally 2026: 12 talks, ceremonies and breaks, 9:30 AM to 4:00 PM at KLH Bachupally Campus, Hyderabad.',
  },
  // Canonical of the three About URLs. /about-ted and /about-tedx render the
  // same component and point their canonical here, so Google consolidates the
  // signals instead of splitting them across three identical pages.
  '/about-tedxklh': {
    title: 'About TEDxKLH Bachupally | Student-Run TEDx Event',
    description:
      'TEDxKLH Bachupally is a student-run, independently organized TEDx event at KL University, Hyderabad. Learn about TED, TEDx, and our first edition.',
  },
  '/about-ted': { canonical: '/about-tedxklh' },
  '/about-tedx': { canonical: '/about-tedxklh' },
  '/team': {
    title: 'Meet the Team | TEDxKLH Bachupally 2026',
    description:
      'Meet the student organisers, curators and crew behind TEDxKLH Bachupally 2026 — hospitality, sponsorship, marketing, production and web.',
  },
  '/partners': {
    title: 'Partners & Sponsors | TEDxKLH Bachupally 2026',
    description:
      "KL University is our presenting partner. Meet the sponsors and partners making TEDxKLH Bachupally's first edition possible in Hyderabad.",
  },
  '/sponsor': {
    title: 'Sponsor TEDxKLH Bachupally 2026',
    description:
      'Sponsorship tiers for TEDxKLH Bachupally 2026 in Hyderabad. Put your brand in front of 250 attendees on 22 August 2026.',
  },
  '/volunteer': {
    title: 'Volunteer with TEDxKLH Bachupally 2026',
    description:
      'Twelve months of work for one day on stage. See open volunteer roles — curation, production, design, hospitality — at TEDxKLH Bachupally.',
  },
  // Nominations are paused, so the page is one banner. Same reasoning as
  // /schedule: indexable again the moment it carries a real form.
  '/nominate': {
    title: 'Nominate a Speaker — TEDxKLH Bachupally 2026',
    description:
      'Know someone with an idea worth spreading? Nominate a speaker for TEDxKLH Bachupally 2026 at KLH Bachupally Campus, Hyderabad.',
    noindex: true,
  },
  '/blog': {
    title: 'Blog | TEDxKLH Bachupally 2026',
    description:
      "Notes from behind the red circle — curation, production and stories behind TEDxKLH Bachupally's first edition, live Aug 22, 2026.",
  },
  '/contact': {
    title: 'Contact TEDxKLH Bachupally | Get in Touch',
    description:
      'Questions about TEDxKLH Bachupally 2026 — tickets, partnerships, press or volunteering? Email tedxklhb@klh.edu.in or write to us here.',
  },
}

// One entry per REVEALED speaker, keyed the same way as PAGE_SEO so seoFor
// and the prerenderer can treat `/speakers/:slug` like any static route.
// Filtering by `isRevealed` here — not just in the page components — matters
// twice over: the prerenderer (scripts/prerender.mjs) only writes static HTML
// for routes in this object, so an unrevealed speaker's bio never ships to
// disk or to Googlebot before its reveal moment; and seoFor() below falls
// through to the generic noindex 404 metadata for anyone who guesses the
// slug early, instead of `applySeo` announcing the name in the browser tab
// while the page body renders NotFound.
export const SPEAKER_SEO = Object.fromEntries(
  speakers
    .filter((s) => isRevealed(s))
    .map((s) => [
      `/speakers/${s.slug}`,
      {
        title: `${s.name} | TEDxKLH Bachupally 2026`,
        description: `${s.name}, ${s.role}, speaks at TEDxKLH Bachupally, Sat Aug 22, 2026 in Hyderabad. ${s.highlight}.`,
      },
    ]),
)

const FALLBACK = PAGE_SEO['/']

// Resolve the metadata for a pathname. Unknown paths (the 404) get the site
// defaults plus noindex — an indexed 404 is a wasted result that trains Google
// to distrust the sitemap.
export function seoFor(pathname) {
  const path = pathname !== '/' && pathname.endsWith('/') ? pathname.slice(0, -1) : pathname
  const entry = PAGE_SEO[path] || SPEAKER_SEO[path]

  if (!entry) {
    return { ...FALLBACK, canonical: `${SITE_URL}${path}`, noindex: true }
  }

  // A canonical-only entry is an alias: it inherits the target's copy, and
  // points its canonical at the target rather than at itself.
  if (entry.canonical && !entry.title) {
    const target = PAGE_SEO[entry.canonical] || FALLBACK
    return { ...target, canonical: `${SITE_URL}${entry.canonical}` }
  }

  return { ...entry, canonical: `${SITE_URL}${entry.canonical || path}` }
}

// --- DOM writes ---------------------------------------------------------------
// Plain DOM rather than a helmet library: this is ~40 lines against a new
// dependency, and there is no server render to reconcile with.

function setMeta(selector, attr, name, content) {
  if (typeof document === 'undefined') return
  let el = document.head.querySelector(selector)
  if (!el) {
    el = document.createElement('meta')
    el.setAttribute(attr, name)
    document.head.appendChild(el)
  }
  el.setAttribute('content', content)
}

function setCanonical(href) {
  if (typeof document === 'undefined') return
  let el = document.head.querySelector('link[rel="canonical"]')
  if (!el) {
    el = document.createElement('link')
    el.setAttribute('rel', 'canonical')
    document.head.appendChild(el)
  }
  el.setAttribute('href', href)
}

// Applies one route's metadata to the document head.
export function applySeo(pathname) {
  const { title, description, canonical, noindex } = seoFor(pathname)

  document.title = title
  setMeta('meta[name="description"]', 'name', 'description', description)
  setCanonical(canonical)
  setMeta(
    'meta[name="robots"]',
    'name',
    'robots',
    noindex
      ? 'noindex, follow'
      : 'index, follow, max-image-preview:large, max-snippet:-1, max-video-preview:-1',
  )

  // Social cards track the same copy, so a shared link never advertises the
  // home page while pointing at /register.
  setMeta('meta[property="og:title"]', 'property', 'og:title', title)
  setMeta('meta[property="og:description"]', 'property', 'og:description', description)
  setMeta('meta[property="og:url"]', 'property', 'og:url', canonical)
  setMeta('meta[property="og:site_name"]', 'property', 'og:site_name', SITE_NAME)
  setMeta('meta[name="twitter:title"]', 'name', 'twitter:title', title)
  setMeta('meta[name="twitter:description"]', 'name', 'twitter:description', description)
}

// The admin console must never be indexed. It is behind a token, so a crawler
// only ever sees the login screen — but a login screen in the results for
// "TEDxKLH" is noise, and robots.txt alone does not remove a URL that is
// already indexed. This meta does.
export function applyNoindex() {
  if (typeof document === 'undefined') return
  setMeta('meta[name="robots"]', 'name', 'robots', 'noindex, nofollow')
}
