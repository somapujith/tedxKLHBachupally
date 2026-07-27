// Single source of truth for the API origin.
//
// In local dev the frontend and API share an origin (Vite proxy / same host), so
// the base is empty and every request stays a relative "/api/..." path. In the
// split deployment — frontend on Vercel, Express API on Render — VITE_API_BASE_URL
// is set to the Render origin (e.g. https://tedx-api.onrender.com) at build time,
// and apiUrl() prefixes it onto every path.
//
// A trailing slash on the env value is stripped so apiUrl('/api/x') never produces
// a double slash. An already-absolute path (http...) is passed through untouched.
const RAW_BASE = import.meta.env.VITE_API_BASE_URL || ''
const BASE = RAW_BASE.replace(/\/+$/, '')

export function apiUrl(path) {
  if (/^https?:\/\//i.test(path)) return path
  return BASE ? `${BASE}${path}` : path
}
