// Post-build step: write a real HTML file per public route, each with its own
// <title>, description, canonical, social tags and JSON-LD already in the head.
//
// Why this exists at all, given the SPA already sets these at runtime:
//
//   1. Social crawlers do not execute JavaScript. Instagram, WhatsApp, iMessage,
//      LinkedIn and Slack read the raw HTML response and nothing else. Instagram
//      is this event's main channel, so a share of /register that advertises the
//      home page is a direct cost in ticket sales — and no amount of runtime
//      <meta> writing can fix it.
//   2. Googlebot does render JS, but the render pass sits in a queue that can
//      take days on a brand-new domain with no authority. The event is weeks
//      away. Static HTML removes that variable: the metadata is correct in the
//      first byte, on the first crawl.
//
// Vercel's SPA rewrite in vercel.json only fires when no static file matches the
// path, so dist/register/index.html is served for /register in preference to the
// fallback. React still hydrates and takes over normally.
//
// src/lib/seo.js is imported directly: it is plain JavaScript with no JSX and no
// asset imports, deliberately, so plain Node can read it. Keep it that way.

import { readFileSync, writeFileSync, mkdirSync } from 'node:fs'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { PAGE_SEO, SPEAKER_SEO, SITE_URL, seoFor } from '../src/lib/seo.js'
import { speakers, isRevealed } from '../src/data/event.js'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const dist = resolve(root, 'dist')
let template = readFileSync(resolve(dist, 'index.html'), 'utf8')

// The JSON-LD `performer` array and public/sitemap.xml (copied into dist/ by
// Vite before this script runs) are both hand-authored and both list every
// speaker unconditionally — neither one is aware of the reveal schedule the
// way SPEAKER_SEO is. Rewriting both here, off the same gated source SPEAKER_SEO
// already reads from, closes that gap: an unrevealed speaker's name can't leak
// into structured data or the sitemap ahead of their reveal moment, without
// hand-editing either file every time the schedule advances.
const revealedSpeakers = speakers.filter((s) => isRevealed(s))

function rewritePerformerList(html) {
  const performerJson = JSON.stringify(revealedSpeakers.map((s) => ({ '@type': 'Person', name: s.name })), null, 14)
    .replace(/^/gm, '  ') // re-indent to match the surrounding template
    .trim()
  return html.replace(/"performer":\s*\[[\s\S]*?\]/, `"performer": ${performerJson}`)
}

function rewriteSitemap() {
  const file = resolve(dist, 'sitemap.xml')
  const xml = readFileSync(file, 'utf8')

  const speakerUrlBlock = (slug) =>
    `  <url>\n` +
    `    <loc>${SITE_URL}/speakers/${slug}</loc>\n` +
    `    <lastmod>${new Date().toISOString().slice(0, 10)}</lastmod>\n` +
    `    <changefreq>weekly</changefreq>\n` +
    `    <priority>0.7</priority>\n` +
    `  </url>\n`

  // Strip every existing `/speakers/<slug>` entry (revealed or not — they're
  // about to be regenerated from scratch) but leave the bare `/speakers`
  // listing page and everything else untouched.
  const stripped = xml.replace(
    new RegExp(`  <url>\\n\\s*<loc>${SITE_URL}/speakers/[a-z-]+</loc>[\\s\\S]*?</url>\\n`, 'g'),
    '',
  )

  const inserted = stripped.replace(
    new RegExp(`(  <url>\\n\\s*<loc>${SITE_URL}/speakers</loc>[\\s\\S]*?</url>\\n)`),
    `$1${revealedSpeakers.map((s) => speakerUrlBlock(s.slug)).join('')}`,
  )

  writeFileSync(file, inserted)
  console.log(`rewrote   sitemap.xml    -> ${revealedSpeakers.length} of ${speakers.length} speaker URLs (revealed only)`)
}

template = rewritePerformerList(template)
rewriteSitemap()

// Only routes that render their own content. Alias entries (canonical-only) are
// skipped because vercel.json 301s them, and noindex routes are skipped because
// a placeholder page has nothing worth pre-rendering. Per-speaker routes come
// from SPEAKER_SEO, generated straight off src/data/event.js, so a new speaker
// is prerendered automatically without touching this script.
const ROUTES = [
  ...Object.entries(PAGE_SEO)
    .filter(([, meta]) => meta.title && !meta.noindex)
    .map(([path]) => path),
  ...Object.keys(SPEAKER_SEO),
]

// Escape before interpolating into an attribute. Titles carry apostrophes and
// ampersands ("Partners & Sponsors"), and an unescaped & is invalid HTML that
// some crawlers will truncate the attribute on.
function attr(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

// Breadcrumbs give Google the site's shape and render as a path in the result
// instead of a bare URL. The home page is its own root, so it gets none.
function breadcrumb(path, title) {
  if (path === '/') return ''
  const name = title.split(/\s*[|—]\s*/)[0]
  const json = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'Home', item: `${SITE_URL}/` },
      { '@type': 'ListItem', position: 2, name, item: `${SITE_URL}${path}` },
    ],
  }
  return `\n    <script type="application/ld+json">${JSON.stringify(json)}</script>`
}

// Replace rather than append: the template already carries the home page's tags,
// and two <title> elements or two canonicals is worse than none.
function inject(html, { title, description, canonical }, path) {
  let out = html
    .replace(/<title>[\s\S]*?<\/title>/, `<title>${attr(title)}</title>`)
    .replace(
      /<meta name="description" content="[^"]*" \/>/,
      `<meta name="description" content="${attr(description)}" />`,
    )
    .replace(
      /<link rel="canonical" href="[^"]*" \/>/,
      `<link rel="canonical" href="${attr(canonical)}" />`,
    )

  for (const [pattern, value] of [
    [/<meta property="og:title" content="[^"]*" \/>/, `<meta property="og:title" content="${attr(title)}" />`],
    [/<meta property="og:description" content="[^"]*" \/>/, `<meta property="og:description" content="${attr(description)}" />`],
    [/<meta property="og:url" content="[^"]*" \/>/, `<meta property="og:url" content="${attr(canonical)}" />`],
    [/<meta name="twitter:title" content="[^"]*" \/>/, `<meta name="twitter:title" content="${attr(title)}" />`],
    [/<meta name="twitter:description" content="[^"]*" \/>/, `<meta name="twitter:description" content="${attr(description)}" />`],
  ]) {
    out = out.replace(pattern, value)
  }

  return out.replace('</head>', `${breadcrumb(path, title)}\n  </head>`)
}

let written = 0
for (const path of ROUTES) {
  const meta = seoFor(path)
  const html = inject(template, meta, path)

  // '/' is dist/index.html itself; every other route becomes a directory with an
  // index.html, which is what a static host resolves an extensionless path to.
  const file = path === '/' ? resolve(dist, 'index.html') : resolve(dist, `.${path}`, 'index.html')
  mkdirSync(dirname(file), { recursive: true })
  writeFileSync(file, html)
  written += 1
  console.log(`prerendered ${path.padEnd(16)} -> ${file.replace(dist, 'dist')}`)
}

// A silent zero here would ship a site whose every page claims to be the home
// page — loud failure is the only safe outcome.
if (written !== ROUTES.length) {
  console.error(`prerender wrote ${written} of ${ROUTES.length} routes`)
  process.exit(1)
}
console.log(`\nprerendered ${written} routes`)
