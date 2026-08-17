// Guards the two SEO rules that are invisible until Google gets them wrong:
// every indexable URL must self-canonicalise, and the three /about-* aliases
// must consolidate onto one canonical instead of competing as duplicates.
import { describe, it, expect, beforeEach } from 'vitest'
import { PAGE_SEO, SITE_URL, seoFor, applySeo, applyNoindex } from '../lib/seo.js'

const INDEXABLE = Object.entries(PAGE_SEO)
  .filter(([, v]) => v.title && !v.noindex)
  .map(([path]) => path)

describe('seoFor', () => {
  it('gives every indexable route a unique title and description', () => {
    const titles = INDEXABLE.map((p) => seoFor(p).title)
    const descriptions = INDEXABLE.map((p) => seoFor(p).description)
    expect(new Set(titles).size).toBe(titles.length)
    expect(new Set(descriptions).size).toBe(descriptions.length)
  })

  it('keeps titles and descriptions inside Google truncation limits', () => {
    for (const path of INDEXABLE) {
      const { title, description } = seoFor(path)
      expect(title.length, `${path} title`).toBeLessThanOrEqual(65)
      expect(description.length, `${path} description`).toBeLessThanOrEqual(160)
    }
  })

  it('self-canonicalises each real route to its absolute URL', () => {
    expect(seoFor('/').canonical).toBe(`${SITE_URL}/`)
    expect(seoFor('/register').canonical).toBe(`${SITE_URL}/register`)
  })

  it('folds the duplicate about pages onto one canonical', () => {
    const target = `${SITE_URL}/about-tedxklh`
    expect(seoFor('/about-tedxklh').canonical).toBe(target)
    expect(seoFor('/about-ted').canonical).toBe(target)
    expect(seoFor('/about-tedx').canonical).toBe(target)
    // The aliases inherit the copy rather than falling back to the home page.
    expect(seoFor('/about-ted').title).toBe(seoFor('/about-tedxklh').title)
  })

  it('ignores a trailing slash so /register/ is not a second URL', () => {
    expect(seoFor('/register/')).toEqual(seoFor('/register'))
  })

  it('noindexes unknown paths — an indexed 404 is a wasted result', () => {
    expect(seoFor('/no-such-page').noindex).toBe(true)
  })

  it('noindexes the placeholder pages while they carry no content', () => {
    expect(seoFor('/nominate').noindex).toBe(true)
  })

  it('indexes /schedule now that it carries the real running order', () => {
    expect(seoFor('/schedule').noindex).toBeUndefined()
  })
})

describe('applySeo', () => {
  beforeEach(() => {
    document.head.innerHTML = ''
    document.title = ''
  })

  const head = (sel) => document.head.querySelector(sel)?.getAttribute('content')

  it('writes title, description, canonical and robots into the head', () => {
    applySeo('/register')
    const expected = seoFor('/register')
    expect(document.title).toBe(expected.title)
    expect(head('meta[name="description"]')).toBe(expected.description)
    expect(document.head.querySelector('link[rel="canonical"]').getAttribute('href')).toBe(
      expected.canonical,
    )
    expect(head('meta[name="robots"]')).toContain('index, follow')
  })

  it('keeps the social card copy in step with the page copy', () => {
    applySeo('/speakers')
    const { title, canonical } = seoFor('/speakers')
    expect(head('meta[property="og:title"]')).toBe(title)
    expect(head('meta[property="og:url"]')).toBe(canonical)
    expect(head('meta[name="twitter:title"]')).toBe(title)
  })

  it('replaces rather than duplicates tags across navigations', () => {
    applySeo('/')
    applySeo('/contact')
    expect(document.head.querySelectorAll('meta[name="description"]')).toHaveLength(1)
    expect(document.head.querySelectorAll('link[rel="canonical"]')).toHaveLength(1)
    expect(document.title).toBe(seoFor('/contact').title)
  })

  it('emits noindex for a route flagged as such', () => {
    applySeo('/nominate')
    expect(head('meta[name="robots"]')).toBe('noindex, follow')
  })

  it('locks the admin console out of the index entirely', () => {
    applyNoindex()
    expect(head('meta[name="robots"]')).toBe('noindex, nofollow')
  })
})
