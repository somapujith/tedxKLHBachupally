import '@testing-library/jest-dom'

class MockIntersectionObserver {
  observe() {}
  unobserve() {}
  disconnect() {}
}

class MockResizeObserver {
  observe() {}
  unobserve() {}
  disconnect() {}
}

global.IntersectionObserver = MockIntersectionObserver
global.ResizeObserver = MockResizeObserver

// jsdom implements neither of these, and Layout uses both on mount — Lenis gates
// smooth scrolling on a reduced-motion query, and ScrollToTop scrolls on every
// route change. Without the stubs, every suite that renders the real Layout dies
// before asserting anything.
// Guarded: this same setup file is loaded for the server suites, which declare
// `@vitest-environment node` and therefore have no `window` at all.
if (typeof window !== 'undefined') {
  if (!window.matchMedia) {
    window.matchMedia = (query) => ({
      matches: false, // no reduced-motion preference in tests
      media: query,
      onchange: null,
      addEventListener() {},
      removeEventListener() {},
      addListener() {}, // deprecated, still used by some libraries
      removeListener() {},
      dispatchEvent: () => false,
    })
  }

  window.scrollTo = () => {}
}
